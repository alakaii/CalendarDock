import { ipcMain, BrowserWindow } from 'electron'
import { updatesService } from '../services/updates.service'

export function registerUpdatesHandlers(win: BrowserWindow): void {
  updatesService.init(win)

  ipcMain.handle('updates:check', async () => updatesService.check())

  ipcMain.handle('updates:install', async () => updatesService.install())

  ipcMain.handle('updates:get-schedule', async () => updatesService.getSchedule())

  ipcMain.handle('updates:set-schedule', async (_event, schedule: { enabled: boolean; time: string }) =>
    updatesService.setSchedule(schedule)
  )
}
