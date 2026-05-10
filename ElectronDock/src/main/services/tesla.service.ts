// Tesla Powerwall — Fleet API (cloud).
//
// Why we're not using the local Gateway:
//   PW3 firmware locks /tedapi/ to clients on the Powerwall's own SSID
//   (192.168.91.0/24), so home-LAN requests get 403. The legacy
//   /api/login/Basic + /api/meters/aggregates path tested DEAD on this
//   install (the email+last5-of-serial credential convention failed).
//
// Auth shape:
//   Standard OAuth2 authorization-code flow on a fixed loopback
//   (http://localhost:8585/callback — must match the redirect URI
//   registered on developer.tesla.com).
//   Refresh token is long-lived; access tokens are 8h.
//
// API shape we use:
//   GET /api/1/products                     -> discover energy_site_id
//   GET /api/1/energy_sites/{id}/live_status -> instant power flow
//
// Polling cadence:
//   Caller (TeslaPage) controls interval. v1 default is 10 minutes —
//   /live_status is "Data" tier ($0.002/call), so 10-min polling lands
//   under the $10/mo developer credit.

import { createServer, type Server } from 'http'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'
import { shell } from 'electron'
import { settingsService } from './settings.service'
import type { TeslaEnergyStatus, TeslaConnectionStatus, TeslaVehicleConfig } from '../../preload/types'

// Fixed redirect — must match the developer app's "Allowed Redirect URI".
const REDIRECT_PORT = 8585
const REDIRECT_URI  = `http://localhost:${REDIRECT_PORT}/callback`

const AUTH_BASE = 'https://auth.tesla.com/oauth2/v3'

// User-OAuth scopes. Energy is what we use today; the vehicle scopes are
// included so a future vehicle tile can reuse the same refresh token without
// forcing the user back through sign-in.
const SCOPES = [
  'openid',
  'offline_access',
  'energy_device_data',
  'vehicle_device_data',
  'vehicle_location',
].join(' ')

function fleetBase(region: 'na' | 'eu'): string {
  return `https://fleet-api.prd.${region}.vn.cloud.tesla.com`
}

// ── OAuth helpers ───────────────────────────────────────────────────────────

// Mirror the Google/Dropbox helpers: on snap-confined Linux, openExternal
// frequently routes through xdg-open and lands in a non-browser. Spawn a
// known browser binary directly when available.
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
        } catch { /* try next */ }
      }
    }
  }
  shell.openExternal(url)
}

function waitForCode(expectedState: string, timeoutMs = 5 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let server: Server | null = null
    const closeAndReject = (err: Error) => { server?.close(); server = null; reject(err) }
    const closeAndResolve = (code: string) => { server?.close(); server = null; resolve(code) }

    server = createServer((req, res) => {
      const u   = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`)
      if (u.pathname !== '/callback') {
        res.writeHead(404); res.end('not found'); return
      }
      const code  = u.searchParams.get('code')
      const state = u.searchParams.get('state')
      const err   = u.searchParams.get('error')

      const html = (msg: string) =>
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:60px;color:#0f172a">' +
        msg + '</body></html>'

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })

      if (err) {
        res.end(html(`<h2>Tesla sign-in error</h2><p>${err}</p><p>You can close this tab.</p>`))
        closeAndReject(new Error(`Tesla auth error: ${err}`))
        return
      }
      if (state !== expectedState) {
        res.end(html('<h2>State mismatch</h2><p>Possible CSRF — sign-in aborted.</p>'))
        closeAndReject(new Error('Tesla auth state mismatch'))
        return
      }
      if (!code) {
        res.end(html('<h2>No code received</h2>'))
        closeAndReject(new Error('No code in Tesla callback'))
        return
      }
      res.end(html(
        '<h2 style="color:#22c55e">&#10003; CalendarDock connected to Tesla.</h2>' +
        '<p>You can close this tab and return to CalendarDock.</p>'
      ))
      closeAndResolve(code)
    })

    server.listen(REDIRECT_PORT, '127.0.0.1')
    server.on('error', closeAndReject)

    setTimeout(() => closeAndReject(new Error('Tesla sign-in timed out after 5 minutes')), timeoutMs)
  })
}

// ── Token cache (in-memory, derived from persisted refresh token) ───────────

interface AccessTokenCache {
  token:     string
  /** ms since epoch — refresh ~5 min before expiry */
  expiresAt: number
}

let accessCache: AccessTokenCache | null = null
/** Clear the in-memory access token (e.g. on disconnect or 401). */
function invalidateAccessToken(): void { accessCache = null }

async function refreshAccessToken(): Promise<string> {
  const refreshToken = settingsService.getTeslaFleetRefreshToken()
  if (!refreshToken) throw new Error('Tesla not connected — sign in from Settings → Powerwall.')

  const clientId = settingsService.get('teslaFleetClientId')
  if (!clientId) throw new Error('Tesla Fleet client_id is not set (set TESLA_FLEET_CLIENT_ID in .env).')

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     clientId,
    refresh_token: refreshToken,
  })

  const r = await fetch(`${AUTH_BASE}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '<unreadable>')
    throw new Error(`Tesla token refresh failed: ${r.status} — ${text.slice(0, 200)}`)
  }
  const data = await r.json() as { access_token: string; expires_in: number; refresh_token?: string }
  // Tesla sometimes rotates refresh tokens. Persist the new one if present.
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    settingsService.setTeslaFleetRefreshToken(data.refresh_token)
  }

  accessCache = {
    token:     data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 28800) * 1000),
  }
  return data.access_token
}

async function getAccessToken(): Promise<string> {
  // Refresh ~5 min before expiry to absorb clock skew + slow networks
  if (accessCache && Date.now() < accessCache.expiresAt - 5 * 60_000) {
    return accessCache.token
  }
  return refreshAccessToken()
}

// ── Fleet API request helper ────────────────────────────────────────────────

async function fleetGet<T = unknown>(path: string): Promise<T> {
  const region = settingsService.get('teslaFleetRegion')
  const base   = fleetBase(region)
  let token    = await getAccessToken()

  const doFetch = () => fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  let r = await doFetch()
  // One automatic retry on 401: stale access token, force refresh and retry once.
  if (r.status === 401) {
    invalidateAccessToken()
    token = await refreshAccessToken()
    r = await doFetch()
  }
  if (!r.ok) {
    const text = await r.text().catch(() => '<unreadable>')
    throw new Error(`Tesla Fleet ${path} ${r.status}: ${text.slice(0, 200)}`)
  }
  return r.json() as Promise<T>
}

// ── /products discovery (cached) ────────────────────────────────────────────

interface ProductsResponse {
  response: Array<{
    // Energy products
    energy_site_id?: number
    site_name?:      string
    resource_type?:  string
    // Vehicle products
    id_s?:        string
    vin?:         string
    display_name?:string
    access_type?: string
    device_type?: string
  }>
}

interface DiscoveryResult {
  site:     { id: string; siteName: string } | null
  vehicles: TeslaVehicleConfig[]
}

/**
 * One /products call, parsed into both halves: the energy site (we pick the
 * first battery) and the full vehicle list (we don't filter — the user picks
 * via Settings, and that choice is preserved across refreshes by mergeTeslaVehicles).
 */
async function fetchProducts(): Promise<DiscoveryResult> {
  const products = await fleetGet<ProductsResponse>('/api/1/products')
  const items = products.response ?? []

  const battery = items.find((p) => p.energy_site_id != null && p.resource_type === 'battery')
  const site = battery?.energy_site_id
    ? { id: String(battery.energy_site_id), siteName: battery.site_name ?? '' }
    : null

  const vehicles: TeslaVehicleConfig[] = items
    .filter((p) => p.id_s && p.device_type === 'vehicle')
    .map((p) => ({
      id:          p.id_s!,
      vin:         p.vin ?? '',
      displayName: p.display_name ?? '',
      accessType:  p.access_type ?? '',
      // `enabled` will be filled in by mergeTeslaVehicles based on prior state
      enabled:     true,
    }))

  return { site, vehicles }
}

/**
 * Returns the energy_site_id, discovering it via /products on first run if
 * the cached value is empty. Also opportunistically updates the persisted
 * vehicle list when we have to make the call anyway, so the picker in
 * Settings stays in sync without a separate /products spend.
 */
async function getEnergySiteId(): Promise<{ id: string; siteName: string }> {
  const cachedId   = settingsService.get('teslaEnergySiteId')
  const cachedName = settingsService.get('teslaSiteName')
  if (cachedId) return { id: cachedId, siteName: cachedName }

  const { site, vehicles } = await fetchProducts()
  if (!site) throw new Error('No Powerwall found on this Tesla account.')

  settingsService.setTeslaEnergySite(site.id, site.siteName)
  settingsService.mergeTeslaVehicles(vehicles)
  return site
}

// ── /live_status → TeslaEnergyStatus ────────────────────────────────────────

interface LiveStatusResponse {
  response: {
    solar_power?:        number
    battery_power?:      number
    load_power?:         number
    grid_power?:         number
    percentage_charged?: number
    grid_status?:        string
    island_status?:      string
  }
}

interface SiteInfoResponse {
  response: {
    battery_count?: number
  }
}

/** Round watts to one decimal place of kW. Stable display, no jitter at 0. */
function powerToKw(watts: number | null | undefined): number {
  if (typeof watts !== 'number' || !isFinite(watts)) return 0
  return Math.round(watts / 100) / 10
}

function mapGridStatus(raw: string | undefined): TeslaEnergyStatus['gridStatus'] {
  // Fleet API returns "Active" / "Inactive" / "Unknown"; some firmware also
  // surfaces "Transition" during reconnection.
  const v = (raw ?? '').toLowerCase()
  if (v.includes('inactive')) return 'down'
  if (v.includes('trans'))    return 'transition'
  return 'up'
}

// Cache batteryCount across the process lifetime — site_info changes rarely
// (firmware updates / installer changes) and is "Data" tier just like
// live_status, so calling it on every poll would double our spend.
let cachedBatteryCount = 0

export const teslaService = {
  // ── Public connection lifecycle ───────────────────────────────────────────

  /**
   * Run the OAuth authorization-code flow. Opens the user's browser, listens
   * on the loopback redirect, exchanges the auth code for tokens, persists
   * the refresh token, and discovers the energy_site_id.
   */
  async connect(): Promise<TeslaConnectionStatus> {
    const clientId     = settingsService.get('teslaFleetClientId')
    const clientSecret = settingsService.get('teslaFleetClientSecret')
    if (!clientId || !clientSecret) {
      throw new Error(
        'Tesla Fleet client credentials are not set. Add TESLA_FLEET_CLIENT_ID ' +
        'and TESLA_FLEET_CLIENT_SECRET to .env (or ~/.config/calendardock/credentials.env on the kiosk) and restart.'
      )
    }

    const region = settingsService.get('teslaFleetRegion')
    const state  = randomBytes(16).toString('hex')

    const authUrl = `${AUTH_BASE}/authorize?` + new URLSearchParams({
      client_id:     clientId,
      locale:        'en-US',
      prompt:        'login',
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         SCOPES,
      state,
    }).toString()

    openInBrowser(authUrl)
    const code = await waitForCode(state)

    // Exchange for tokens
    const exchangeBody = new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      audience:      fleetBase(region),
      redirect_uri:  REDIRECT_URI,
    })
    const r = await fetch(`${AUTH_BASE}/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    exchangeBody.toString(),
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '<unreadable>')
      throw new Error(`Tesla token exchange failed: ${r.status} — ${text.slice(0, 200)}`)
    }
    const tokens = await r.json() as { access_token: string; refresh_token: string; expires_in: number }
    if (!tokens.refresh_token) {
      throw new Error('Tesla token exchange returned no refresh_token (offline_access scope missing?).')
    }

    settingsService.setTeslaFleetRefreshToken(tokens.refresh_token)
    accessCache = {
      token:     tokens.access_token,
      expiresAt: Date.now() + ((tokens.expires_in ?? 28800) * 1000),
    }

    // Discover and cache the energy site immediately so the UI can show
    // "Connected — My Home" without waiting for the first poll.
    let siteName = ''
    try {
      const site = await getEnergySiteId()
      siteName = site.siteName
    } catch (err) {
      // Auth succeeded but /products failed — still report connected; the
      // poll will surface the error.
      console.error('[tesla] /products discovery after connect failed:', err)
    }

    return {
      connected:   true,
      siteName,
      connectedAt: settingsService.get('teslaConnectedAt'),
    }
  },

  disconnect(): void {
    settingsService.clearTeslaFleetSession()
    invalidateAccessToken()
    cachedBatteryCount = 0
  },

  getConnectionStatus(): TeslaConnectionStatus {
    const refreshToken = settingsService.getTeslaFleetRefreshToken()
    return {
      connected:   !!refreshToken,
      siteName:    settingsService.get('teslaSiteName'),
      connectedAt: settingsService.get('teslaConnectedAt'),
    }
  },

  // ── Vehicle picker ────────────────────────────────────────────────────────

  /** No network. Returns the persisted list (populated on connect/refresh). */
  listVehicles(): TeslaVehicleConfig[] {
    return settingsService.get('teslaVehicles') ?? []
  },

  setVehicleEnabled(id: string, enabled: boolean): TeslaVehicleConfig[] {
    return settingsService.setTeslaVehicleEnabled(id, enabled)
  },

  /**
   * Force a /products re-fetch — burns one Data-tier call ($0.002).
   * Use after the user adds/removes a car from the Tesla account.
   */
  async refreshProducts(): Promise<TeslaVehicleConfig[]> {
    const { site, vehicles } = await fetchProducts()
    if (site) settingsService.setTeslaEnergySite(site.id, site.siteName)
    return settingsService.mergeTeslaVehicles(vehicles)
  },

  // ── Polled by the renderer (TeslaPage) ────────────────────────────────────

  async getStatus(): Promise<TeslaEnergyStatus> {
    const { id: siteId } = await getEnergySiteId()

    const live = await fleetGet<LiveStatusResponse>(`/api/1/energy_sites/${siteId}/live_status`)
    const r    = live.response

    // Fetch battery_count once per process — it doesn't change between polls.
    if (!cachedBatteryCount) {
      try {
        const info = await fleetGet<SiteInfoResponse>(`/api/1/energy_sites/${siteId}/site_info`)
        cachedBatteryCount = info.response.battery_count ?? 0
      } catch {
        // Non-fatal; leave at 0 and try again next call.
      }
    }

    const pct = typeof r.percentage_charged === 'number' ? r.percentage_charged : 0
    return {
      solarKw:      powerToKw(r.solar_power),
      loadKw:       powerToKw(r.load_power),
      batteryKw:    powerToKw(r.battery_power),
      gridKw:       powerToKw(r.grid_power),
      percentage:   Math.max(0, Math.min(100, Math.round(pct))),
      batteryCount: cachedBatteryCount,
      gridStatus:   mapGridStatus(r.grid_status),
    }
  },
}
