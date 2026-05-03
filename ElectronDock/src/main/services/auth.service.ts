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

export const authService = {
  /** Initialize OAuth clients from stored accounts on startup */
  async initialize(): Promise<void> {
    const stored = settingsService.get('accounts') ?? []
    for (const account of stored) {
      try {
        const refreshToken = decryptToken(account.encryptedRefreshToken)
        const client = createOAuthClient()
        client.setCredentials({ refresh_token: refreshToken })
        oauthClients.set(account.id, client)
      } catch (err) {
        console.error(`Failed to restore OAuth client for account ${account.id}:`, err)
      }
    }
  },

  /** Get OAuth client for an account (used by calendar/tasks services) */
  getClient(accountId: string): OAuth2Client | null {
    return oauthClients.get(accountId) ?? null
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
