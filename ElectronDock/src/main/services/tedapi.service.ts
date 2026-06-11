// Tesla Powerwall — local Gateway access via TEDAPI (direct Wi-Fi connect).
//
// This is the "Direct connect (Wi-Fi)" alternative to the Fleet API (cloud)
// path in tesla.service.ts. PW3 firmware locks the TEDAPI endpoint to clients
// associated to the Powerwall's own access point (TeslaPW_… → 192.168.91.1),
// so this only works when the machine running CalendarDock is on that AP.
//
// Protocol (ported from jasonacox/pypowerwall's tedapi module):
//   GET  https://<host>/tedapi/din   → device id (text, HTTP Basic auth)
//   POST https://<host>/tedapi/v1    → protobuf request, protobuf response
// Auth is HTTP Basic with username "Tesla_Energy_Device" and the Gateway
// Wi-Fi password. The cert is self-signed, so TLS verification is disabled.
//
// We hand-roll the tiny slice of protobuf we need (no dependency): the request
// nests a fixed GraphQL "DeviceControllerQuery" plus an opaque `code` blob
// (both extracted verbatim into tedapi-query.ts); the response carries a JSON
// string we pull back out and map to the same TeslaEnergyStatus shape the
// Fleet API path produces — TEDAPI's meterAggregates use the *same* sign
// convention as the cloud (battery negative = charging, site positive =
// importing), so no sign flips are needed.

import https from 'https'
import { gunzipSync } from 'zlib'
import type { TeslaEnergyStatus } from '../../preload/types'
import { STATUS_QUERY, STATUS_CODE_HEX } from './tedapi-query'

const TEDAPI_USER = 'Tesla_Energy_Device'
const REQUEST_TIMEOUT_MS = 6000

// Self-signed gateway cert — accept it. keepAlive so back-to-back din+status
// reuse one socket.
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true })

// ── Minimal protobuf writer ──────────────────────────────────────────────────
// Only the field types we emit: varint (int32), length-delimited (string/bytes/
// nested message). Field numbers come from pypowerwall's tedapi.proto.

class PbWriter {
  private chunks: Buffer[] = []

  private varint(n: number): void {
    const bytes: number[] = []
    let value = n
    while (value >= 0x80) {
      bytes.push((value % 0x80) | 0x80)
      value = Math.floor(value / 0x80)
    }
    bytes.push(value)
    this.chunks.push(Buffer.from(bytes))
  }

  private tag(field: number, wire: number): void {
    this.varint(field * 8 + wire)
  }

  int32(field: number, value: number): this {
    this.tag(field, 0)
    this.varint(value)
    return this
  }

  bytes(field: number, buf: Buffer): this {
    this.tag(field, 2)
    this.varint(buf.length)
    this.chunks.push(buf)
    return this
  }

  string(field: number, s: string): this {
    return this.bytes(field, Buffer.from(s, 'utf8'))
  }

  message(field: number, w: PbWriter): this {
    return this.bytes(field, w.finish())
  }

  finish(): Buffer {
    return Buffer.concat(this.chunks)
  }
}

// ── Minimal protobuf reader ──────────────────────────────────────────────────
// Parses one message into field-number → values. Unknown fields are skipped,
// so firmware adding fields never breaks us.

type PbValue = Buffer | number
type PbFields = Map<number, PbValue[]>

function readVarint(buf: Buffer, pos: number): [number, number] {
  let result = 0
  let shift = 1
  let p = pos
  for (;;) {
    if (p >= buf.length) throw new Error('truncated varint')
    const b = buf[p++]
    result += (b & 0x7f) * shift
    if ((b & 0x80) === 0) break
    shift *= 128
  }
  return [result, p]
}

function parseMessage(buf: Buffer): PbFields {
  const out: PbFields = new Map()
  let pos = 0
  while (pos < buf.length) {
    let key: number
    ;[key, pos] = readVarint(buf, pos)
    const field = Math.floor(key / 8)
    const wire = key % 8
    let val: PbValue
    if (wire === 0) {
      ;[val, pos] = readVarint(buf, pos)
    } else if (wire === 2) {
      let len: number
      ;[len, pos] = readVarint(buf, pos)
      val = buf.subarray(pos, pos + len)
      pos += len
    } else if (wire === 1) {
      val = buf.subarray(pos, pos + 8)
      pos += 8
    } else if (wire === 5) {
      val = buf.subarray(pos, pos + 4)
      pos += 4
    } else {
      throw new Error(`unsupported wire type ${wire}`)
    }
    const arr = out.get(field)
    if (arr) arr.push(val)
    else out.set(field, [val])
  }
  return out
}

function subMessage(fields: PbFields | undefined, field: number): PbFields | undefined {
  const v = fields?.get(field)?.[0]
  return v instanceof Buffer ? parseMessage(v) : undefined
}

function subString(fields: PbFields | undefined, field: number): string | undefined {
  const v = fields?.get(field)?.[0]
  return v instanceof Buffer ? v.toString('utf8') : undefined
}

// ── Request builders ─────────────────────────────────────────────────────────

function envelope(din: string): PbWriter {
  const sender = new PbWriter().int32(3, 1)        // Participant.local = 1
  const recipient = new PbWriter().string(1, din)  // Participant.din
  return new PbWriter()
    .int32(1, 1)                 // deliveryChannel = 1
    .message(2, sender)          // sender
    .message(3, recipient)       // recipient
}

function buildStatusRequest(din: string): Buffer {
  const payload = new PbWriter().int32(1, 1).string(2, STATUS_QUERY)  // PayloadString{value:1,text:query}
  const b = new PbWriter().string(1, '{}')                            // StringValue{value:"{}"}
  const send = new PbWriter()
    .int32(1, 2)                                  // num = 2
    .message(2, payload)                          // payload
    .bytes(3, Buffer.from(STATUS_CODE_HEX, 'hex'))// code
    .message(4, b)                                // b
  const query = new PbWriter().message(1, send)   // QueryType.send
  const env = envelope(din).message(16, query)    // MessageEnvelope.payload
  const tail = new PbWriter().int32(1, 1)
  return new PbWriter().message(1, env).message(2, tail).finish()
}

function buildConfigRequest(din: string): Buffer {
  const send = new PbWriter().int32(1, 1).string(2, 'config.json')  // PayloadConfigSend{num:1,file}
  const config = new PbWriter().message(1, send)                    // ConfigType.send
  const env = envelope(din).message(15, config)                     // MessageEnvelope.config
  const tail = new PbWriter().int32(1, 1)
  return new PbWriter().message(1, env).message(2, tail).finish()
}

// ── Response parsers ─────────────────────────────────────────────────────────

function parseStatusResponse(buf: Buffer): any {
  // Message(1) → MessageEnvelope.payload(16) → QueryType.recv(2) → PayloadString.text(2)
  const root = parseMessage(buf)
  const env = subMessage(root, 1)
  const query = subMessage(env, 16)
  const recv = subMessage(query, 2)
  const text = subString(recv, 2)
  if (!text) throw new Error('TEDAPI status response missing payload')
  return JSON.parse(text)
}

function parseConfigResponse(buf: Buffer): any {
  // Message(1) → MessageEnvelope.config(15) → ConfigType.recv(2) → PayloadConfigRecv.file(1)
  //            → ConfigString.text(100)
  const root = parseMessage(buf)
  const env = subMessage(root, 1)
  const config = subMessage(env, 15)
  const recv = subMessage(config, 2)
  const file = subMessage(recv, 1)
  const text = subString(file, 100)
  if (!text) throw new Error('TEDAPI config response missing payload')
  return JSON.parse(text)
}

// ── HTTP transport ───────────────────────────────────────────────────────────

function authHeader(pwd: string): string {
  return 'Basic ' + Buffer.from(`${TEDAPI_USER}:${pwd}`).toString('base64')
}

function maybeGunzip(buf: Buffer): Buffer {
  // Firmware 25.42.2+ gzip-compresses TEDAPI responses (magic 1f 8b).
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      return gunzipSync(buf)
    } catch {
      /* fall through to raw */
    }
  }
  return buf
}

function request(
  host: string,
  pwd: string,
  path: string,
  method: 'GET' | 'POST',
  body?: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        port: 443,
        path,
        method,
        agent,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Authorization: authHeader(pwd),
          'Content-Type': 'application/octet-string',
          ...(body ? { 'Content-Length': body.length } : {}),
        },
      },
      (res) => {
        const status = res.statusCode ?? 0
        const parts: Buffer[] = []
        res.on('data', (c: Buffer) => parts.push(c))
        res.on('end', () => {
          const raw = maybeGunzip(Buffer.concat(parts))
          if (status === 403) {
            reject(new Error('Powerwall rejected the Gateway password (403). Check the password on the gateway sticker.'))
          } else if (status === 429 || status === 503) {
            reject(new Error('Powerwall is rate-limiting requests — try again in a few minutes.'))
          } else if (status !== 200) {
            reject(new Error(`Powerwall gateway returned HTTP ${status}.`))
          } else {
            resolve(raw)
          }
        })
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error(
        `Timed out reaching the Powerwall gateway at ${host}. The kiosk must be connected to the Powerwall's Wi-Fi (TeslaPW_…).`,
      ))
    })
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH' || err.code === 'ETIMEDOUT') {
        reject(new Error(
          `Can't reach the Powerwall gateway at ${host}. The kiosk must be connected to the Powerwall's Wi-Fi (TeslaPW_…).`,
        ))
      } else {
        reject(err)
      }
    })
    if (body) req.write(body)
    req.end()
  })
}

// ── DIN cache ────────────────────────────────────────────────────────────────
// The DIN is stable for a given gateway; cache it per host so the steady-state
// poll is a single POST. Cleared automatically on any failure.

let cachedDin: { host: string; din: string } | null = null

async function getDin(host: string, pwd: string): Promise<string> {
  if (cachedDin && cachedDin.host === host) return cachedDin.din
  const raw = await request(host, pwd, '/tedapi/din', 'GET')
  const din = raw.toString('utf8').trim()
  if (!din) throw new Error('Powerwall gateway returned an empty DIN.')
  cachedDin = { host, din }
  return din
}

function clearDinCache(): void {
  cachedDin = null
}

// ── Mapping → TeslaEnergyStatus ──────────────────────────────────────────────

/** Round watts to one decimal of kW — identical to the Fleet path's powerToKw. */
function powerToKw(watts: unknown): number {
  if (typeof watts !== 'number' || !isFinite(watts)) return 0
  return Math.round(watts / 100) / 10
}

function mapGridStatus(status: any): TeslaEnergyStatus['gridStatus'] {
  const alerts = status?.control?.alerts?.active
  if (Array.isArray(alerts) && alerts.includes('SystemConnectedToGrid')) return 'up'
  const gs = status?.esCan?.bus?.ISLANDER?.ISLAND_GridConnection?.ISLAND_GridConnected
  if (gs === 'ISLAND_GridConnected_Connected') return 'up'
  if (gs) return 'down'
  return 'up' // unknown → assume up, matching the Fleet path's default
}

function mapStatus(status: any): TeslaEnergyStatus {
  const meters: any[] = Array.isArray(status?.control?.meterAggregates)
    ? status.control.meterAggregates
    : []
  const power: Record<string, number> = {}
  for (const m of meters) {
    if (m?.location) power[String(m.location).toUpperCase()] = m.realPowerW
  }

  const sys = status?.control?.systemStatus ?? {}
  const full = sys.nominalFullPackEnergyWh
  const remaining = sys.nominalEnergyRemainingWh
  const pct = full && remaining ? (remaining / full) * 100 : 0

  const blocks = status?.control?.batteryBlocks
  const batteryCount = Array.isArray(blocks) ? blocks.length : 0

  return {
    solarKw:      powerToKw(power.SOLAR),
    loadKw:       powerToKw(power.LOAD),
    batteryKw:    powerToKw(power.BATTERY),
    gridKw:       powerToKw(power.SITE),
    percentage:   Math.max(0, Math.min(100, Math.round(pct))),
    batteryCount,
    gridStatus:   mapGridStatus(status),
  }
}

// ── Public surface ───────────────────────────────────────────────────────────

export const tedapiService = {
  /**
   * Single live poll over the local gateway. One POST in steady state (DIN is
   * cached). Throws a user-readable error on auth/network failure.
   */
  async getStatus(host: string, pwd: string): Promise<TeslaEnergyStatus> {
    try {
      const din = await getDin(host, pwd)
      const raw = await request(host, pwd, '/tedapi/v1', 'POST', buildStatusRequest(din))
      return mapStatus(parseStatusResponse(raw))
    } catch (err) {
      // Drop the DIN cache so the next attempt re-handshakes cleanly.
      clearDinCache()
      throw err
    }
  },

  /**
   * Verify the host + password and return the site name (from config.json) so
   * the Settings panel can confirm which gateway it reached. Used by the
   * "Test connection" button — also primes the DIN cache.
   */
  async testConnection(host: string, pwd: string): Promise<{ siteName: string; din: string }> {
    try {
      const din = await getDin(host, pwd)
      // A status fetch proves the full request/response path works.
      await request(host, pwd, '/tedapi/v1', 'POST', buildStatusRequest(din))
      let siteName = ''
      try {
        const cfg = await request(host, pwd, '/tedapi/v1', 'POST', buildConfigRequest(din))
        siteName = parseConfigResponse(cfg)?.site_info?.site_name ?? ''
      } catch {
        /* site name is best-effort */
      }
      return { siteName, din }
    } catch (err) {
      clearDinCache()
      throw err
    }
  },

  /** Forget the cached DIN (e.g. when host/password change). */
  reset(): void {
    clearDinCache()
  },
}
