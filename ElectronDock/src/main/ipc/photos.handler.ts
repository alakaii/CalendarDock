import { ipcMain } from 'electron'
import { photosService } from '../services/photos.service'
import { photoQueueService } from '../services/photoQueue.service'
import { icloudService } from '../services/icloud.service'
import { settingsService } from '../services/settings.service'
import type { PhotoResyncResult } from '../../preload/types'

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

  // Unified "Resync All Photos": re-check + re-index + refill every configured
  // source at once. Dropbox (photoQueue, guarded by isWorking) and iCloud
  // (guarded by isSyncing) are independent, so we drive them concurrently.
  // Sources that aren't enabled/configured are skipped and reported as such.
  // Both paths log their own outcomes to the journal as they already do.
  ipcMain.handle('photos:resync-all', async (): Promise<PhotoResyncResult> => {
    const s = settingsService.getAll()
    const dropboxWillSync = !!s.dropboxEnabled && (s.dropboxFolderPaths?.length ?? 0) > 0
    const icloudWillSync  = !!s.icloudPhotosEnabled && (s.icloudAlbumUrls?.length ?? 0) > 0

    console.log(`[photos] Resync-all requested (dropbox=${dropboxWillSync}, icloud=${icloudWillSync})`)

    const dropboxTask = dropboxWillSync
      ? photoQueueService._doInitialFill().then((r) => ({ skipped: false, ...r }))
      : Promise.resolve({ skipped: true, ok: true, indexed: 0, cached: 0, error: '' })

    const icloudTask = icloudWillSync
      ? icloudService.sync().then((r) => ({ skipped: false, ok: r.ok, count: r.count, error: r.error }))
      : Promise.resolve({ skipped: true, ok: true, count: 0, error: '' })

    const [dropbox, icloud] = await Promise.all([dropboxTask, icloudTask])
    console.log(
      `[photos] Resync-all complete — dropbox: ${dropbox.skipped ? 'skipped' : `${dropbox.cached}/${dropbox.indexed}`}` +
      `, icloud: ${icloud.skipped ? 'skipped' : `${icloud.count}`}`
    )
    return { dropbox, icloud }
  })
}
