import { ipcMain } from 'electron'
import { camerasService } from '../services/cameras.service'
import { settingsService } from '../services/settings.service'
import { wyzeBridgeService } from '../services/wyze-bridge.service'

export function registerCamerasHandlers(): void {
  ipcMain.handle('cameras:start-stream', async (_event, { cameraId }: { cameraId: string }) => {
    const cameras = settingsService.get('cameras') ?? []
    const camera = cameras.find((c) => c.id === cameraId)
    if (!camera) throw new Error(`Camera ${cameraId} not found`)
    return camerasService.startStream(cameraId, camera.rtspUrl)
  })

  ipcMain.handle('cameras:stop-stream', async (_event, { cameraId }: { cameraId: string }) => {
    camerasService.stopStream(cameraId)
  })

  ipcMain.handle('cameras:stop-all', async () => {
    camerasService.stopAllStreams()
  })

  ipcMain.handle('cameras:bridge-status', async () => {
    return wyzeBridgeService.checkStatus()
  })

  ipcMain.handle('cameras:bridge-start', async () => {
    const email    = settingsService.get('wyzeBridgeEmail')    ?? ''
    const password = settingsService.get('wyzeBridgePassword') ?? ''
    const apiId    = settingsService.get('wyzeBridgeApiId')    ?? ''
    const apiKey   = settingsService.get('wyzeBridgeApiKey')   ?? ''
    await wyzeBridgeService.start(email, password, apiId, apiKey)
  })

  ipcMain.handle('cameras:bridge-stop', async () => {
    await wyzeBridgeService.stop()
  })

  ipcMain.handle('cameras:bridge-remove', async () => {
    await wyzeBridgeService.remove()
  })
}
