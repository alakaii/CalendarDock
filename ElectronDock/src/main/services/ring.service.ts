// Ring integration: email/password + 2FA → refresh token, camera list, snapshot polling.
// Snapshots are served over a tiny local HTTP server so the renderer can use plain <img>
// tags with cache-busting query strings (mirrors how Wyze/MJPEG is exposed).
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { settingsService } from './settings.service'
import type { RingCameraInfo, RingStatus, RingConnectionState } from '../../preload/types'

const SNAPSHOT_PORT = 54322

// ── ring-client-api is loaded lazily so its native deps don't crash app startup
//    if the package fails to install (e.g. on a fresh machine without ffmpeg).
//    Types are intentionally loose — the library's surface drifts between versions.
type AnyRingApi    = any
type AnyRingCamera = any
type AnyRestClient = any

let ringApiCtor: any = null
let restClientCtor: any = null

async function loadRingModules(): Promise<{ RingApi: any; RingRestClient: any }> {
  if (!ringApiCtor || !restClientCtor) {
    const mod: any = await import('ring-client-api')
    ringApiCtor = mod.RingApi ?? mod.default?.RingApi
    restClientCtor = mod.RingRestClient ?? mod.default?.RingRestClient
    if (!restClientCtor) {
      // Older versions kept RingRestClient under a sub-path
      try {
        const rest: any = await import('ring-client-api/lib/rest-client')
        restClientCtor = rest.RingRestClient ?? rest.default?.RingRestClient
      } catch { /* leave undefined */ }
    }
    if (!ringApiCtor || !restClientCtor) {
      throw new Error('ring-client-api is installed but RingApi/RingRestClient could not be loaded')
    }
  }
  return { RingApi: ringApiCtor, RingRestClient: restClientCtor }
}

// ── State ────────────────────────────────────────────────────────────────────

interface SnapshotEntry {
  jpeg: Buffer
  fetchedAt: number
}

let state: RingConnectionState = 'disconnected'
let stateError = ''
let twoFactorPrompt = ''
let pendingRestClient: AnyRestClient | null = null
let ringApi: AnyRingApi | null = null
let cameraCache: Map<string, AnyRingCamera> = new Map()
const snapshotCache = new Map<string, SnapshotEntry>()
const inflight     = new Map<string, Promise<Buffer>>()

function snapshotTtlMs(): number {
  const sec = settingsService.get('ringSnapshotIntervalSec') || 30
  return Math.max(5, sec) * 1000
}

// ── HTTP server: serves the most recent snapshot for /ring-snapshot/<cameraId> ──

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const match = req.url?.match(/^\/ring-snapshot\/([^/?]+)/)
  if (!match) {
    res.writeHead(404)
    res.end()
    return
  }
  const cameraId = decodeURIComponent(match[1])
  try {
    const jpeg = await getSnapshotJpeg(cameraId)
    res.writeHead(200, {
      'Content-Type':                 'image/jpeg',
      'Cache-Control':                'no-cache, no-store',
      'Access-Control-Allow-Origin':  '*',
      'Content-Length':               jpeg.length,
    })
    res.end(jpeg)
  } catch (err: any) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end(err?.message ?? 'snapshot failed')
  }
})

server.listen(SNAPSHOT_PORT, '127.0.0.1')

async function getSnapshotJpeg(cameraId: string): Promise<Buffer> {
  const cached = snapshotCache.get(cameraId)
  if (cached && Date.now() - cached.fetchedAt < snapshotTtlMs()) {
    return cached.jpeg
  }
  const existing = inflight.get(cameraId)
  if (existing) return existing

  const camera = cameraCache.get(cameraId)
  if (!camera) throw new Error(`Ring camera ${cameraId} not found`)

  const promise = (async () => {
    const jpeg = await camera.getSnapshot()
    snapshotCache.set(cameraId, { jpeg, fetchedAt: Date.now() })
    return jpeg
  })()
    .finally(() => inflight.delete(cameraId))

  inflight.set(cameraId, promise)
  return promise
}

// ── Status + persistence ─────────────────────────────────────────────────────

function buildStatus(): RingStatus {
  return {
    state,
    email:           settingsService.get('ringAccountEmail') ?? '',
    errorMessage:    stateError,
    twoFactorPrompt,
  }
}

async function initFromStoredToken(): Promise<void> {
  const refreshToken = settingsService.getRingRefreshToken()
  if (!refreshToken) return
  try {
    const { RingApi } = await loadRingModules()
    ringApi = new RingApi({ refreshToken, controlCenterDisplayName: 'CalendarDock' })
    subscribeToRefreshTokenUpdates()
    await refreshCameraCache()
    state = 'connected'
    stateError = ''
  } catch (err: any) {
    state = 'error'
    stateError = err?.message ?? 'Failed to initialize Ring API'
  }
}

function subscribeToRefreshTokenUpdates(): void {
  // Different versions emit this differently — guard each step
  try {
    const stream = (ringApi as any)?.onRefreshTokenUpdated
    if (stream && typeof stream.subscribe === 'function') {
      stream.subscribe((payload: any) => {
        const newToken = payload?.newRefreshToken
        if (newToken) settingsService.setRingRefreshToken(newToken)
      })
    }
  } catch { /* non-fatal */ }
}

async function refreshCameraCache(): Promise<void> {
  if (!ringApi) return
  const cameras = await ringApi.getCameras()
  cameraCache = new Map(cameras.map((c) => [String(c.id), c]))
}

// ── Service surface ──────────────────────────────────────────────────────────

export const ringService = {
  /** Called once at app start. Silently revives the connection if a token is stored. */
  async ensureInitialized(): Promise<void> {
    if (state === 'connected') return
    await initFromStoredToken()
  },

  getStatus(): RingStatus {
    return buildStatus()
  },

  /**
   * Begin login. If 2FA is required (almost always), Ring sends a code to the
   * user and we transition to 'needs-2fa' — the renderer should then prompt
   * for the code and call submit2fa().
   */
  async connect(email: string, password: string): Promise<RingStatus> {
    state = 'connecting'
    stateError = ''
    twoFactorPrompt = ''
    settingsService.setRingAccountEmail(email)

    try {
      const { RingRestClient } = await loadRingModules()
      pendingRestClient = new RingRestClient({ email, password })
      const auth = await pendingRestClient.getCurrentAuth()
      // Rare path: account has no 2FA enabled. Persist the token immediately.
      await this._completeWithToken(auth.refresh_token)
      pendingRestClient = null
      return buildStatus()
    } catch (err: any) {
      // ring-client-api throws a 'PromptFor2faError' when 2FA is required.
      const code = err?.name ?? err?.code ?? ''
      if (code === 'PromptFor2faError' || /2fa|two.factor/i.test(err?.message ?? '')) {
        state = 'needs-2fa'
        twoFactorPrompt = err?.message ?? 'Enter the code Ring sent you'
        return buildStatus()
      }
      state = 'error'
      stateError = err?.message ?? 'Login failed'
      pendingRestClient = null
      return buildStatus()
    }
  },

  async submit2fa(code: string): Promise<RingStatus> {
    if (!pendingRestClient) {
      state = 'error'
      stateError = 'No login in progress — start over'
      return buildStatus()
    }
    try {
      const auth = await pendingRestClient.getAuth(code.trim())
      await this._completeWithToken(auth.refresh_token)
      pendingRestClient = null
      return buildStatus()
    } catch (err: any) {
      state = 'error'
      stateError = err?.message ?? '2FA verification failed'
      return buildStatus()
    }
  },

  async _completeWithToken(refreshToken: string): Promise<void> {
    settingsService.setRingRefreshToken(refreshToken)
    const { RingApi } = await loadRingModules()
    ringApi = new RingApi({ refreshToken, controlCenterDisplayName: 'CalendarDock' })
    subscribeToRefreshTokenUpdates()
    await refreshCameraCache()
    state = 'connected'
    stateError = ''
    twoFactorPrompt = ''
  },

  async disconnect(): Promise<void> {
    if (ringApi) {
      try { ringApi.disconnect() } catch { /* ignore */ }
    }
    ringApi = null
    cameraCache.clear()
    snapshotCache.clear()
    inflight.clear()
    pendingRestClient = null
    settingsService.clearRingRefreshToken()
    settingsService.setRingAccountEmail('')
    state = 'disconnected'
    stateError = ''
    twoFactorPrompt = ''
  },

  async listCameras(): Promise<RingCameraInfo[]> {
    if (!ringApi) return []
    if (cameraCache.size === 0) await refreshCameraCache()
    return Array.from(cameraCache.values()).map((c) => ({
      id:           String(c.id),
      name:         c.name,
      deviceType:   String(c.deviceType ?? ''),
      hasBattery:   Boolean(c.hasBattery),
      batteryLevel: typeof c.batteryLevel === 'number' ? c.batteryLevel : null,
      online:       Boolean((c as any).isOnline?.() ?? true),
    }))
  },

  snapshotUrl(cameraId: string): string {
    return `http://127.0.0.1:${SNAPSHOT_PORT}/ring-snapshot/${encodeURIComponent(cameraId)}`
  },
}
