// Tesla Powerwall — local Gateway API
// The Powerwall+ / Backup Gateway exposes a REST API on the local network at
// https://<gateway-ip>/api/. Auth is a basic email+password POST that returns
// a bearer token. The gateway uses a self-signed certificate, so TLS
// verification has to be disabled for these requests.
import https from 'https'
import type { TeslaEnergyStatus } from '../../preload/types'

interface TokenCache {
  token: string
  /** ms since epoch — tokens are good for ~24h, we refresh after 1h to be safe */
  expiresAt: number
}

let tokenCache: TokenCache | null = null
let cachedHost: string = ''

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: string
  token?: string
  timeoutMs?: number
}

function gatewayRequest<T = unknown>(host: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 8000 } = opts

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }
    if (body) {
      headers['Content-Type']  = 'application/json'
      headers['Content-Length'] = String(Buffer.byteLength(body))
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const req = https.request(
      {
        host,
        port: 443,
        path,
        method,
        headers,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
            reject(new Error(`Tesla gateway ${path} ${res.statusCode}: ${raw.slice(0, 200)}`))
            return
          }
          if (!raw) { resolve(undefined as T); return }
          try { resolve(JSON.parse(raw) as T) }
          catch (e) { reject(new Error(`Tesla gateway ${path} returned non-JSON: ${(e as Error).message}`)) }
        })
      }
    )
    req.on('timeout', () => { req.destroy(new Error(`Tesla gateway ${path} timed out`)) })
    req.on('error', (err) => reject(err))
    if (body) req.write(body)
    req.end()
  })
}

async function getToken(host: string, email: string, password: string): Promise<string> {
  if (cachedHost !== host) {
    tokenCache = null
    cachedHost = host
  }
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const body = JSON.stringify({
    username: 'customer',
    email,
    password,
    force_sm_off: false,
  })
  const res = await gatewayRequest<{ token?: string }>(host, '/api/login/Basic', {
    method: 'POST',
    body,
  })
  if (!res?.token) throw new Error('Tesla gateway login returned no token')

  tokenCache = {
    token: res.token,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  }
  return res.token
}

interface AggregatesResponse {
  site?:    { instant_power: number }
  battery?: { instant_power: number }
  load?:    { instant_power: number }
  solar?:   { instant_power: number }
}

interface SoeResponse {
  percentage: number
}

interface SystemStatusResponse {
  battery_blocks?: Array<unknown>
  nominal_full_pack_energy?: number
  grid_status?: string
}

interface GridStatusResponse {
  grid_status?: string
}

function powerToKw(watts: number | undefined): number {
  if (typeof watts !== 'number' || !isFinite(watts)) return 0
  // Round to 0.1 kW for stable display
  return Math.round(watts / 100) / 10
}

export const teslaService = {
  async getStatus(host: string, email: string, password: string): Promise<TeslaEnergyStatus> {
    if (!host || !email || !password) {
      throw new Error('Tesla Powerwall not configured')
    }

    const token = await getToken(host, email, password)

    // Fan out the four reads in parallel; if any one fails after auth, surface
    // the error so the page can show it. Cached token will be reused on retry.
    const [aggregates, soe, systemStatus, gridStatus] = await Promise.all([
      gatewayRequest<AggregatesResponse>(host, '/api/meters/aggregates', { token }),
      gatewayRequest<SoeResponse>(host, '/api/system_status/soe', { token }),
      gatewayRequest<SystemStatusResponse>(host, '/api/system_status', { token }),
      gatewayRequest<GridStatusResponse>(host, '/api/system_status/grid_status', { token })
        .catch(() => ({ grid_status: undefined as string | undefined })),
    ])

    const solarW   = aggregates.solar?.instant_power
    const loadW    = aggregates.load?.instant_power
    // Sign convention from gateway: positive battery instant_power = discharging
    // (out of battery, into the home). Positive site instant_power = importing
    // from the grid. We keep that convention in the type.
    const batteryW = aggregates.battery?.instant_power
    const siteW    = aggregates.site?.instant_power

    const rawGridStatus = (gridStatus.grid_status ?? systemStatus.grid_status ?? '').toUpperCase()
    let gridState: TeslaEnergyStatus['gridStatus'] = 'up'
    if (rawGridStatus.includes('DOWN'))      gridState = 'down'
    else if (rawGridStatus.includes('TRANS')) gridState = 'transition'

    return {
      solarKw:      powerToKw(solarW),
      loadKw:       powerToKw(loadW),
      batteryKw:    powerToKw(batteryW),
      gridKw:       powerToKw(siteW),
      percentage:   Math.max(0, Math.min(100, Math.round(soe.percentage ?? 0))),
      batteryCount: Array.isArray(systemStatus.battery_blocks) ? systemStatus.battery_blocks.length : 0,
      gridStatus:   gridState,
    }
  },

  /** Used by the Settings panel to validate credentials before saving. */
  async testConnection(host: string, email: string, password: string): Promise<void> {
    // Force a fresh token fetch — the saved one (if any) was for a different host/creds
    tokenCache = null
    cachedHost = ''
    await getToken(host, email, password)
  },
}
