import { ipcMain } from 'electron'

type Level = 'error' | 'warn'

export function registerLogHandlers(): void {
  ipcMain.handle('log:renderer', (_e, { level, args }: { level: Level; args: string[] }) => {
    const msg = args.join(' ')
    if (level === 'error') console.error('[renderer]', msg)
    else                   console.warn ('[renderer]', msg)
  })
}
