import { app } from 'electron'
import { join } from 'path'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'

// ============================================================
// Event log service
// ------------------------------------------------------------
// A tiny in-memory ring buffer of "meaningful" bracketed log lines
// ([standby], [backlight], [icloud], [photoQueue], [dropbox], [auth], …)
// plus a rotating JSONL file under userData so the history survives a
// restart. The kiosk has no easy access to `journalctl`, so this feeds
// a human-readable Activity viewer in Settings.
//
// Population is deliberately low-touch:
//   • Renderer events arrive via the log IPC bridge (log.handler.ts),
//     which calls logEvent() directly after parsing their [prefix].
//   • Main-process events are captured by monkey-patching console.warn /
//     console.log at init: any line that *starts* with a [bracket] prefix
//     is teed into the buffer, while still writing through to the original
//     console (so journald keeps getting everything). Unbracketed noise
//     (Chromium / GPU spam) is ignored.
// ============================================================

export interface EventLogEntry {
  /** ms epoch */
  ts: number
  /** lowercased bracket prefix, e.g. 'standby', 'backlight', 'icloud' */
  source: string
  /** message with the leading [prefix] stripped */
  message: string
}

const RING_MAX = 500
/** Rotate the file down to this many lines once it grows past ROTATE_AT. */
const ROTATE_AT = 2000
const ROTATE_KEEP = 1000

/** Sources handled elsewhere (renderer bridge) — don't double-capture from console. */
const CONSOLE_SKIP_SOURCES = new Set(['renderer'])

// Matches a leading "[word]" prefix. Captures the inner token as source.
const PREFIX_RE = /^\s*\[([a-zA-Z][\w-]*)\]\s?(.*)$/s

const ring: EventLogEntry[] = []
let logFilePath = ''
let patched = false
// Recursion guard — while we're inside our own tee we must never re-enter it
// (e.g. if appendFileSync throws and something logs the error).
let inTee = false

function ensureFile(): void {
  if (logFilePath) return
  const dir = app.getPath('userData')
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }
  logFilePath = join(dir, 'eventlog.jsonl')
}

/** On startup: seed the ring from the file tail, then rotate if oversized. */
function loadAndRotate(): void {
  ensureFile()
  let lines: string[] = []
  try {
    if (existsSync(logFilePath)) {
      const raw = readFileSync(logFilePath, 'utf8')
      lines = raw.split('\n').filter((l) => l.trim().length > 0)
    }
  } catch {
    return
  }

  // Seed the ring buffer from the most recent lines so history persists.
  for (const line of lines.slice(-RING_MAX)) {
    try {
      const e = JSON.parse(line) as EventLogEntry
      if (e && typeof e.ts === 'number' && typeof e.message === 'string') {
        ring.push({ ts: e.ts, source: String(e.source || 'system'), message: e.message })
      }
    } catch {
      /* skip malformed line */
    }
  }
  while (ring.length > RING_MAX) ring.shift()

  // Rotate the on-disk file if it has grown too large.
  if (lines.length > ROTATE_AT) {
    try {
      writeFileSync(logFilePath, lines.slice(-ROTATE_KEEP).join('\n') + '\n', 'utf8')
    } catch {
      /* ignore */
    }
  }
}

/** Append a single meaningful event. Safe to call from anywhere in main. */
export function logEvent(source: string, message: string): void {
  const entry: EventLogEntry = {
    ts: Date.now(),
    source: (source || 'system').toLowerCase(),
    message: (message ?? '').toString().trim(),
  }
  if (!entry.message) return

  ring.push(entry)
  while (ring.length > RING_MAX) ring.shift()

  ensureFile()
  try {
    appendFileSync(logFilePath, JSON.stringify(entry) + '\n', 'utf8')
  } catch {
    /* disk full / read-only — the in-memory ring still works */
  }
}

/**
 * Parse a console line's first argument for a leading [bracket] prefix.
 * Returns null when there's no bracket (ignore it — Chromium/GPU noise).
 */
function parseBracketed(line: string): { source: string; message: string } | null {
  const m = PREFIX_RE.exec(line)
  if (!m) return null
  return { source: m[1].toLowerCase(), message: m[2] }
}

function teeFromConsole(args: unknown[]): void {
  if (inTee) return
  if (args.length === 0) return
  const first = args[0]
  if (typeof first !== 'string') return
  const parsed = parseBracketed(first)
  if (!parsed) return
  if (CONSOLE_SKIP_SOURCES.has(parsed.source)) return

  inTee = true
  try {
    // Fold in the remaining console args so the stored message matches
    // what journald sees (e.g. console.warn('[icloud] init failed:', err)).
    const rest = args.slice(1).map((a) => stringifyArg(a)).join(' ')
    const message = rest ? `${parsed.message} ${rest}`.trim() : parsed.message
    logEvent(parsed.source, message)
  } catch {
    /* never let logging break the app */
  } finally {
    inTee = false
  }
}

function stringifyArg(a: unknown): string {
  if (typeof a === 'string') return a
  if (a instanceof Error) return a.message
  try {
    return JSON.stringify(a)
  } catch {
    return String(a)
  }
}

/**
 * Monkey-patch console.warn / console.log so bracketed main-process lines are
 * teed into the buffer. Idempotent. The originals still run (journald).
 */
export function initEventLog(): void {
  if (patched) return
  patched = true

  loadAndRotate()

  const originalWarn = console.warn.bind(console)
  const originalLog = console.log.bind(console)

  console.warn = (...args: unknown[]): void => {
    teeFromConsole(args)
    originalWarn(...args)
  }
  console.log = (...args: unknown[]): void => {
    teeFromConsole(args)
    originalLog(...args)
  }

  logEvent('system', 'CalendarDock started')
}

/** Return buffered events, newest first, optionally filtered by source / capped. */
export function getEvents(opts?: { source?: string; limit?: number }): EventLogEntry[] {
  let out = ring.slice()
  if (opts?.source && opts.source !== 'all') {
    const s = opts.source.toLowerCase()
    out = out.filter((e) => e.source === s)
  }
  out.reverse() // newest first
  if (opts?.limit && opts.limit > 0 && out.length > opts.limit) {
    out = out.slice(0, opts.limit)
  }
  return out
}
