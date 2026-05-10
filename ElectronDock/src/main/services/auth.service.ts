import * as http from 'http'
import * as net from 'net'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { safeStorage, shell } from 'electron'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { randomUUID } from 'crypto'
import { settingsService } from './settings.service'

// xdg-open is unreliable on snap-confined Linux kiosks. Spawn a known
// browser directly when one exists; fall back to shell.openExternal.
function openInBrowser(url: string): void {
  if (process.platform === 'linux') {
    const candidates = [
      '/snap/bin/firefox',
      '/usr/bin/firefox',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
    ]
    for (const bin of candidates) {
      if (existsSync(bin)) {
        try {
          spawn(bin, [url], { detached: true, stdio: 'ignore' }).unref()
          return
        } catch {
          /* try next */
        }
      }
    }
  }
  shell.openExternal(url)
}

// Scopes needed for Calendar + Tasks access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'openid',
  'email',
  'profile'
]

// In-memory map of active OAuth clients per account
const oauthClients = new Map<string, OAuth2Client>()

function createOAuthClient(redirectUri = 'http://127.0.0.1'): OAuth2Client {
  // Read credentials lazily (at call time) so dotenv has already loaded them
  const clientId = process.env['GOOGLE_CLIENT_ID'] ?? ''
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? ''
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/** Find a random free port on 127.0.0.1 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

/** Start a one-shot HTTP server that captures the OAuth authorization code */
function waitForCode(port: number): { promise: Promise<string>; cancel: () => void } {
  let srv: http.Server | null = null

  const promise = new Promise<string>((resolve, reject) => {
    srv = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        const html = code
          ? '<html><body style="font-family:sans-serif;text-align:center;padding:60px;color:#0f172a">' +
            '<h2 style="color:#22c55e">&#10003; Signed in successfully!</h2>' +
            '<p>You can close this tab and return to CalendarDock.</p></body></html>'
          : '<html><body style="font-family:sans-serif;text-align:center;padding:60px;color:#0f172a">' +
            '<h2>Sign-in cancelled</h2><p>You can close this tab.</p></body></html>'

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
        srv?.close()
        srv = null

        if (error || !code) {
          reject(new Error(error ?? 'No auth code received'))
        } else {
          resolve(code)
        }
      } catch (err) {
        reject(err)
      }
    })

    srv!.listen(port, '127.0.0.1')
    srv!.on('error', reject)
  })

  const cancel = () => { srv?.close(); srv = null }

  return { promise, cancel }
}

/**
 * Wait until Electron's safeStorage layer is actually ready to decrypt.
 *
 * On Linux Wayland kiosks, the systemd unit launches calendardock the
 * moment graphical.target is reached — but gnome-keyring-daemon (or
 * whatever secret-storage backend safeStorage is binding to) isn't
 * always running yet at that exact moment. The very first
 * decryptString() call after a fresh boot fails with "Decryption is
 * not available", the OAuth clients never get restored, and the
 * calendar shows nothing until the user closes + reopens (by which
 * time the keyring is up).
 *
 * Polling isEncryptionAvailable until it flips to true is the cheapest
 * recovery — once it does, decryption works and we can populate the
 * client map exactly as before. Cap at 30s so a totally-broken
 * keyring doesn't block startup forever.
 */
async function waitForSafeStorageReady(timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (safeStorage.isEncryptionAvailable()) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return safeStorage.isEncryptionAvailable()
}

/**
 * Decrypt with a few retries. Even after isEncryptionAvailable goes
 * true, the very first decrypt occasionally races something inside
 * the Linux secret-storage stack and throws. Backoff a couple times
 * before giving up.
 */
async function decryptTokenWithRetry(encrypted: string, attempts = 4): Promise<string> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return decryptToken(encrypted)
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
  }
  throw lastErr
}

export const authService = {
  /** Initialize OAuth clients from stored accounts on startup */
  async initialize(): Promise<void> {
    // Give safeStorage a chance to come up before we start decrypting.
    // On a healthy kiosk this returns ~immediately; on a fresh boot it
    // can take a few seconds while gnome-keyring-daemon spins up.
    const ready = await waitForSafeStorageReady()
    if (!ready) {
      console.error('[auth] safeStorage never became available; OAuth clients will fail to restore')
    }

    const stored = settingsService.get('accounts') ?? []
    for (const account of stored) {
      try {
        const refreshToken = await decryptTokenWithRetry(account.encryptedRefreshToken)
        const client = createOAuthClient()
        client.setCredentials({ refresh_token: refreshToken })
        oauthClients.set(account.id, client)
      } catch (err) {
        console.error(`Failed to restore OAuth client for account ${account.id}:`, err)
      }
    }
  },

  /**
   * Get OAuth client for an account (used by calendar/tasks services).
   *
   * If the client isn't in the in-memory map (because initialize() couldn't
   * decrypt this account's refresh token at startup — typically the kiosk
   * boot race where safeStorage isn't ready yet), try once more here.
   * safeStorage usually warms up within a few seconds, so by the time the
   * renderer makes its first calendar/tasks call, decryption usually works.
   */
  async getClient(accountId: string): Promise<OAuth2Client | null> {
    const cached = oauthClients.get(accountId)
    if (cached) return cached

    const stored = (settingsService.get('accounts') ?? []).find((a) => a.id === accountId)
    if (!stored) return null

    try {
      const refreshToken = await decryptTokenWithRetry(stored.encryptedRefreshToken)
      const client = createOAuthClient()
      client.setCredentials({ refresh_token: refreshToken })
      oauthClients.set(accountId, client)
      return client
    } catch (err) {
      console.error(`[auth] lazy-restore for account ${accountId} failed:`, err)
      return null
    }
  },

  /** Start the Google OAuth flow using a loopback HTTP redirect */
  async startFlow(): Promise<{ accountId: string; email: string }> {
    const port = await getFreePort()
    const redirectUri = `http://127.0.0.1:${port}`

    const client = createOAuthClient(redirectUri)
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Always request refresh token
    })

    const { promise: codePromise, cancel } = waitForCode(port)

    // Open the browser
    openInBrowser(authUrl)

    // Race: auth code vs 5-minute timeout
    let code: string
    try {
      code = await Promise.race([
        codePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            cancel()
            reject(new Error('AUTH_TIMEOUT: Sign-in timed out after 5 minutes'))
          }, 5 * 60 * 1000)
        )
      ])
    } catch (err) {
      cancel()
      throw err
    }

    // Exchange code for tokens
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    if (!tokens.refresh_token) {
      throw new Error(
        'No refresh token received. Revoke CalendarDock access at myaccount.google.com ' +
        '(Security > Third-party apps) then try again.'
      )
    }

    // Fetch user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data: profile } = await oauth2.userinfo.get()

    const accountId = randomUUID()
    const encryptedRefreshToken = encryptToken(tokens.refresh_token)

    settingsService.addAccount({
      id: accountId,
      email: profile.email ?? '',
      displayName: profile.name ?? profile.email ?? '',
      photoUrl: profile.picture ?? undefined,
      encryptedRefreshToken
    })

    oauthClients.set(accountId, client)

    return { accountId, email: profile.email ?? '' }
  },

  /** Remove a Google account and revoke its token */
  async removeAccount(accountId: string): Promise<void> {
    const client = oauthClients.get(accountId)
    if (client && client.credentials?.access_token) {
      try {
        await client.revokeToken(client.credentials.access_token)
      } catch {
        // Ignore revocation errors — token may already be invalid
      }
    }
    oauthClients.delete(accountId)
    settingsService.removeAccount(accountId)
  },

  /** List connected accounts (without sensitive data) */
  listAccounts(): Array<{ id: string; email: string; displayName: string; photoUrl?: string }> {
    const stored = settingsService.get('accounts') ?? []
    return stored.map(({ id, email, displayName, photoUrl }) => ({
      id,
      email,
      displayName,
      photoUrl
    }))
  }
}

// Always round-trip through safeStorage. When the OS keyring isn't available
// (Linux autologin) safeStorage falls back to base64 internally, which is
// still symmetric — calling encryptString and decryptString as a pair always
// recovers the original. The previous canEncrypt-conditional branch caused
// asymmetric encrypt/decrypt that produced malformed tokens.
function encryptToken(token: string): string {
  return safeStorage.encryptString(token).toString('base64')
}

function decryptToken(encrypted: string): string {
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
}
