// Dropbox integration: OAuth2 PKCE, photo index listing, batch downloads
import { createServer } from 'http'
import { spawn } from 'child_process'
import { createHash, randomBytes } from 'crypto'
import { existsSync } from 'fs'
import { shell } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { settingsService } from './settings.service'

// On Linux kiosks where the only browser is snap-confined Firefox, xdg-open
// (which Electron's shell.openExternal uses) often falls through to junk
// handlers (gedit, etc.) and the OAuth flow never starts. Spawn a known
// browser binary directly when one exists; fall back to openExternal.
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

// Fixed loopback port — must be registered in the Dropbox app console:
// Redirect URI → http://127.0.0.1:47391
const DROPBOX_REDIRECT_PORT = 47391

const AUTH_URL      = 'https://www.dropbox.com/oauth2/authorize'
const TOKEN_URL     = 'https://api.dropboxapi.com/oauth2/token'
const LIST_URL      = 'https://api.dropboxapi.com/2/files/list_folder'
const LIST_CONT_URL = 'https://api.dropboxapi.com/2/files/list_folder/continue'
const DOWNLOAD_URL  = 'https://content.dropboxapi.com/2/files/download'
const ACCOUNT_URL   = 'https://api.dropboxapi.com/2/users/get_current_account'
const PHOTO_EXTS    = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'])

// ── Helpers ──────────────────────────────────────────────────────────────────

function generatePKCE() {
  const verifier  = randomBytes(96).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function waitForCode(port: number, timeoutMs = 5 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url  = new URL(req.url!, `http://127.0.0.1:${port}`)
      const code = url.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:2rem"><h2>&#10003; CalendarDock connected to Dropbox!</h2><p>You can close this tab.</p></body></html>')
      server.close()
      if (code) resolve(code)
      else reject(new Error('No code in Dropbox callback'))
    })
    server.listen(port, '127.0.0.1')
    setTimeout(() => { server.close(); reject(new Error('Dropbox auth timed out after 5 minutes')) }, timeoutMs)
  })
}

// ── State ─────────────────────────────────────────────────────────────────────

let isSyncing = false

// ── Service ───────────────────────────────────────────────────────────────────

export const dropboxService = {

  // ── Auth ────────────────────────────────────────────────────────────────────

  async connect(appKey: string): Promise<{ email: string }> {
    const port        = DROPBOX_REDIRECT_PORT
    const redirectUri = `http://127.0.0.1:${port}`
    const { verifier, challenge } = generatePKCE()

    const authUrl = new URL(AUTH_URL)
    authUrl.searchParams.set('client_id',             appKey)
    authUrl.searchParams.set('response_type',         'code')
    authUrl.searchParams.set('code_challenge',        challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('token_access_type',     'offline')
    authUrl.searchParams.set('redirect_uri',          redirectUri)

    openInBrowser(authUrl.toString())
    const code = await waitForCode(port)

    const body = new URLSearchParams({
      code,
      grant_type:    'authorization_code',
      client_id:     appKey,
      code_verifier: verifier,
      redirect_uri:  redirectUri,
    })
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) throw new Error(`Dropbox token exchange failed: ${res.status}`)
    const tokens = await res.json() as any

    const expiry = Date.now() + ((tokens.expires_in ?? 14400) * 1000)
    settingsService.setDropboxTokens(tokens.access_token, tokens.refresh_token, tokens.account_id ?? '', expiry)
    settingsService.setDropboxAppKey(appKey)

    const email = await this._getAccountEmail(tokens.access_token)
    settingsService.setDropboxAccountEmail(email)

    return { email }
  },

  disconnect(): void {
    settingsService.clearDropboxTokens()
    settingsService.setDropboxAccountEmail('')
    settingsService.setDropboxEnabled(false)
  },

  // ── Token management ────────────────────────────────────────────────────────

  async getAccessToken(): Promise<string> {
    const stored = settingsService.getDropboxTokens()
    if (!stored) throw new Error('Not connected to Dropbox — please reconnect in Settings → Photos.')

    // Reuse valid access token
    if (stored.accessTokenExpiry > 0 && Date.now() < stored.accessTokenExpiry - 60_000) {
      return stored.accessToken
    }

    // Refresh
    const appKey = settingsService.getAll().dropboxAppKey
    const body   = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: stored.refreshToken,
      client_id:     appKey,
    })
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      const rawBody = await res.text().catch(() => '<unreadable>')
      console.error('[dropbox] token refresh failed', {
        status: res.status,
        statusText: res.statusText,
        appKeyPrefix: appKey.slice(0, 6) + '...',
        appKeyLen: appKey.length,
        refreshTokenPrefix: stored.refreshToken.slice(0, 6) + '...',
        refreshTokenLen: stored.refreshToken.length,
        responseBody: rawBody,
      })
      throw new Error(`Dropbox token refresh failed: ${res.status} — ${rawBody.slice(0, 300)}`)
    }
    const data   = await res.json() as any
    const expiry = Date.now() + ((data.expires_in ?? 14400) * 1000)
    settingsService.setDropboxTokens(data.access_token, stored.refreshToken, stored.accountId, expiry)
    return data.access_token
  },

  async _getAccountEmail(accessToken: string): Promise<string> {
    try {
      const res = await fetch(ACCOUNT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return ''
      const data = await res.json() as any
      return data.email ?? ''
    } catch {
      return ''
    }
  },

  // ── File listing ─────────────────────────────────────────────────────────────

  async listAllPhotos(folderPath: string): Promise<string[]> {
    const token  = await this.getAccessToken()
    const photos: string[] = []

    const reqBody = JSON.stringify({ path: folderPath, recursive: true, limit: 2000 })
    let res = await fetch(LIST_URL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    reqBody,
    })
    if (!res.ok) {
      const rawBody = await res.text().catch(() => '<unreadable>')
      console.error('[dropbox] list_folder failed', {
        status: res.status,
        statusText: res.statusText,
        sentPath: folderPath,
        sentBody: reqBody,
        tokenPrefix: token.slice(0, 6) + '...',
        responseBody: rawBody,
      })
      let summary: string | undefined
      try { summary = JSON.parse(rawBody)?.error_summary } catch { /* not json */ }
      throw new Error(`Dropbox list failed: ${summary ?? res.status} — ${rawBody.slice(0, 200)}`)
    }
    let data = await res.json() as any

    while (true) {
      for (const entry of data.entries ?? []) {
        if (entry['.tag'] === 'file') {
          const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()
          if (PHOTO_EXTS.has(ext)) photos.push(entry.path_lower as string)
        }
      }
      if (!data.has_more) break
      res  = await fetch(LIST_CONT_URL, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cursor: data.cursor }),
      })
      data = await res.json() as any
    }

    return photos
  },

  // ── Batch download (used by photoQueueService) ───────────────────────────────

  /**
   * Downloads an array of Dropbox file paths to `cacheDir`.
   * Calls `onProgress(done, total)` after each file finishes.
   * Failures are skipped silently (network blip / deleted file).
   */
  async downloadBatch(
    paths: string[],
    cacheDir: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    if (paths.length === 0) return
    if (isSyncing) {
      console.log('[dropbox] Sync already in progress, queuing after current batch')
    }
    isSyncing = true

    try {
      const token = await this.getAccessToken()
      let downloaded = 0
      const CONCURRENT = 5

      for (let i = 0; i < paths.length; i += CONCURRENT) {
        const batch = paths.slice(i, i + CONCURRENT)
        await Promise.all(batch.map(async (path) => {
          try {
            const r = await fetch(DOWNLOAD_URL, {
              method:  'POST',
              headers: {
                Authorization:     `Bearer ${token}`,
                'Dropbox-API-Arg': JSON.stringify({ path }),
              },
            })
            if (!r.ok) return
            const buf      = Buffer.from(await r.arrayBuffer())
            const filename = path.split('/').pop()!
            await writeFile(join(cacheDir, filename), buf)
            downloaded++
            onProgress?.(downloaded, paths.length)
          } catch {
            // Skip silently — network blip, deleted file, etc.
          }
        }))
      }
      console.log(`[dropbox] downloadBatch: ${downloaded}/${paths.length} files written`)
    } finally {
      isSyncing = false
    }
  },

  // ── Status ────────────────────────────────────────────────────────────────────

  getStatus() {
    const s      = settingsService.getAll()
    const tokens = settingsService.getDropboxTokens()
    return {
      connected: !!tokens?.refreshToken,
      email:     s.dropboxAccountEmail || '',
      lastSync:  s.dropboxLastSync     || 0,
      isSyncing,
    }
  },
}
