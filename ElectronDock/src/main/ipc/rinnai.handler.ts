import { ipcMain } from 'electron'
import { rinnaiService } from '../services/rinnai.service'
import { settingsService } from '../services/settings.service'

export function registerRinnaiHandlers(): void {
  ipcMain.handle('rinnai:get-devices', async () => {
    const email    = settingsService.get('rinnaiEmail')
    const password = settingsService.get('rinnaiPassword')
    if (!email || !password) throw new Error('Rinnai credentials not configured')
    return rinnaiService.getDevices(email, password)
  })

  ipcMain.handle('rinnai:set-temperature', async (_event, { thingName, temp }: { thingName: string; temp: number }) => {
    const email    = settingsService.get('rinnaiEmail')
    const password = settingsService.get('rinnaiPassword')
    if (!email || !password) throw new Error('Rinnai credentials not configured')
    return rinnaiService.setTemperature(email, password, thingName, temp)
  })

  ipcMain.handle('rinnai:set-recirculation', async (_event, {
    thingName, enabled, durationMinutes
  }: { thingName: string; enabled: boolean; durationMinutes?: number }) => {
    const email    = settingsService.get('rinnaiEmail')
    const password = settingsService.get('rinnaiPassword')
    if (!email || !password) throw new Error('Rinnai credentials not configured')
    return rinnaiService.setRecirculation(email, password, thingName, enabled, durationMinutes)
  })
}
