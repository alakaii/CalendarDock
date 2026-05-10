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
}
