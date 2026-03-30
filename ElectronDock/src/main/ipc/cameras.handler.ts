import { ipcMain } from 'electron'
import { camerasService } from '../services/cameras.service'
import { settingsService } from '../services/settings.service'

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
}
