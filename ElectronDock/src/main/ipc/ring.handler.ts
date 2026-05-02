import { ipcMain } from 'electron'
import { ringService } from '../services/ring.service'

export function registerRingHandlers(): void {
  ipcMain.handle('ring:connect', async (_e, { email, password }: { email: string; password: string }) => {
    return ringService.connect(email, password)
  })

  ipcMain.handle('ring:submit-2fa', async (_e, { code }: { code: string }) => {
    return ringService.submit2fa(code)
  })

  ipcMain.handle('ring:disconnect', async () => {
    await ringService.disconnect()
  })

  ipcMain.handle('ring:get-status', () => {
    return ringService.getStatus()
  })

  ipcMain.handle('ring:list-cameras', async () => {
    return ringService.listCameras()
  })

  ipcMain.handle('ring:snapshot-url', (_e, { cameraId }: { cameraId: string }) => {
    return ringService.snapshotUrl(cameraId)
  })
}
