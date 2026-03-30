import { ipcMain } from 'electron'
import { rachioService } from '../services/rachio.service'
import { settingsService } from '../services/settings.service'

export function registerRachioHandlers(): void {
  ipcMain.handle('rachio:get-devices', async () => {
    const apiKey = settingsService.get('rachioApiKey')
    if (!apiKey) throw new Error('Rachio API key not configured')
    return rachioService.getDevices(apiKey)
  })

  ipcMain.handle('rachio:start-zone', async (_event, { zoneId, durationSec }: { zoneId: string; durationSec: number }) => {
    const apiKey = settingsService.get('rachioApiKey')
    if (!apiKey) throw new Error('Rachio API key not configured')
    return rachioService.startZone(apiKey, zoneId, durationSec)
  })

  ipcMain.handle('rachio:stop-all', async (_event, { deviceId }: { deviceId: string }) => {
    const apiKey = settingsService.get('rachioApiKey')
    if (!apiKey) throw new Error('Rachio API key not configured')
    return rachioService.stopAll(apiKey, deviceId)
  })
}
