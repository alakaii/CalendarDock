import { ipcMain } from 'electron'
import { teslaService } from '../services/tesla.service'
import { settingsService } from '../services/settings.service'

export function registerTeslaHandlers(): void {
  ipcMain.handle('tesla:get-status', async () => {
    const host     = settingsService.get('teslaGatewayHost')
    const email    = settingsService.get('teslaGatewayEmail')
    const password = settingsService.get('teslaGatewayPassword')
    if (!host || !email || !password) throw new Error('Tesla Powerwall not configured')
    return teslaService.getStatus(host, email, password)
  })

  ipcMain.handle('tesla:test-connection', async (_event, { host, email, password }: { host: string; email: string; password: string }) => {
    await teslaService.testConnection(host, email, password)
  })
}
