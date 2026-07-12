import { ipcMain } from 'electron'
import { photosService } from '../services/photos.service'
import { photoQueueService } from '../services/photoQueue.service'
import { icloudService } from '../services/icloud.service'

export function registerPhotosHandlers(): void {
  ipcMain.handle('photos:get-list', async () => {
    return photosService.getList()
  })

  // Called by the slideshow on each auto-advance or manual navigation.
  // Lets the queue manager track viewed count and schedule top-ups.
  ipcMain.handle('photos:advance', () => {
    photoQueueService.advance()
  })

  // Called by CameraWatcher when the app mode changes.
  // Pause downloads while the user is actively using the app.
  ipcMain.handle('photos:set-paused', (_e, { paused }: { paused: boolean }) => {
    photoQueueService.setPaused(paused)
  })

  // Called by CameraWatcher when deep sleep ends (dawn signal).
  // Triggers a fresh index fetch and cache top-up (Dropbox + iCloud).
  ipcMain.handle('photos:wake-from-deep-sleep', () => {
    photoQueueService.wakeFromDeepSleep()
  })

  // "Sync now" button for the iCloud Shared Album source.
  ipcMain.handle('photos:sync-icloud', async () => {
    return icloudService.sync()
  })

  ipcMain.handle('photos:icloud-status', () => {
    return icloudService.getStatus()
  })
}
