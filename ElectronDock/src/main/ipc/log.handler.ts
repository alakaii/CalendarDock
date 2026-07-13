import { ipcMain } from 'electron'
import { logEvent } from '../services/eventlog.service'

type Level = 'error' | 'warn'

// Matches a leading "[word]" prefix so renderer events like
// "[standby] entered (idle timeout)" are attributed to the 'standby' source
// rather than a generic 'renderer' bucket.
const PREFIX_RE = /^\s*\[([a-zA-Z][\w-]*)\]\s?(.*)$/s

export function registerLogHandlers(): void {
  ipcMain.handle('log:renderer', (_e, { level, args }: { level: Level; args: string[] }) => {
    const msg = args.join(' ')

    // Tee meaningful renderer events into the Activity buffer. Parse the inner
    // [prefix] as the source; fall back to 'renderer' for unbracketed lines.
    const m = PREFIX_RE.exec(msg)
    if (m) logEvent(m[1], m[2])
    else   logEvent('renderer', msg)

    // Still write through to journald. console.* is monkey-patched by the
    // eventlog service, but it skips the 'renderer' source so this line is
    // NOT double-captured.
    if (level === 'error') console.error('[renderer]', msg)
    else                   console.warn ('[renderer]', msg)
  })
}
