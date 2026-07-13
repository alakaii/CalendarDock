import { ipcMain } from 'electron'
import { getEvents } from '../services/eventlog.service'

export function registerEventLogHandlers(): void {
  ipcMain.handle('logs:get', async (_e, opts?: { source?: string; limit?: number }) =>
    getEvents(opts)
  )
}
