/**
 * Forwards renderer-side console.error / console.warn (and unhandled errors
 * + promise rejections) to the main process so they show up in `journalctl
 * -u calendardock` on the kiosk. Original console behavior is preserved —
 * the renderer's devtools console still gets every message.
 */

type Level = 'error' | 'warn'

const originalError = console.error.bind(console)
const originalWarn  = console.warn.bind(console)

function formatArg(a: unknown): string {
  if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`
  if (typeof a === 'object' && a !== null) {
    try { return JSON.stringify(a) } catch { return String(a) }
  }
  return String(a)
}

function forward(level: Level, args: unknown[]): void {
  try {
    window.api?.log?.forward(level, args.map(formatArg))
  } catch {
    // Swallow — never let logging break the app
  }
}

let installed = false

export function installRendererLogBridge(): void {
  if (installed) return
  installed = true

  console.error = (...args: unknown[]) => {
    originalError(...args)
    forward('error', args)
  }
  console.warn = (...args: unknown[]) => {
    originalWarn(...args)
    forward('warn', args)
  }

  window.addEventListener('error', (e) => {
    forward('error', [
      `[uncaught] ${e.message}`,
      e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '',
      e.error?.stack ?? '',
    ])
  })

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as unknown
    forward('error', [
      '[unhandled-rejection]',
      r instanceof Error ? (r.stack ?? `${r.name}: ${r.message}`) : String(r),
    ])
  })
}
