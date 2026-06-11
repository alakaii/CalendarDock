import { ipcMain } from 'electron'
import { teslaService } from '../services/tesla.service'

export function registerTeslaHandlers(): void {
  ipcMain.handle('tesla:get-status', async () => {
    return teslaService.getStatus()
  })

  ipcMain.handle('tesla:connect', async () => {
    return teslaService.connect()
  })

  ipcMain.handle('tesla:disconnect', async () => {
    teslaService.disconnect()
  })

  ipcMain.handle('tesla:get-connection-status', async () => {
    return teslaService.getConnectionStatus()
  })

  ipcMain.handle('tesla:list-vehicles', async () => {
    return teslaService.listVehicles()
  })

  ipcMain.handle('tesla:set-vehicle-enabled', async (_event, { id, enabled }: { id: string; enabled: boolean }) => {
    return teslaService.setVehicleEnabled(id, enabled)
  })

  ipcMain.handle('tesla:refresh-products', async () => {
    return teslaService.refreshProducts()
  })

  ipcMain.handle('tesla:set-connection-mode', async (_event, { mode }: { mode: 'fleet' | 'local' }) => {
    teslaService.setConnectionMode(mode)
  })

  ipcMain.handle('tesla:set-gateway-config', async (_event, { host, password }: { host: string; password: string }) => {
    teslaService.setGatewayConfig(host, password)
  })

  ipcMain.handle('tesla:clear-gateway-config', async () => {
    teslaService.clearGatewayConfig()
  })

  ipcMain.handle('tesla:test-local-connection', async () => {
    return teslaService.testLocalConnection()
  })
}
