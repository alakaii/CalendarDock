import { ipcMain } from 'electron'
import { dropboxService } from '../services/dropbox.service'
import { photoQueueService } from '../services/photoQueue.service'
import { settingsService } from '../services/settings.service'

export function registerDropboxHandlers(): void {
  ipcMain.handle('dropbox:connect', async (_e, { appKey }: { appKey: string }) => {
    return dropboxService.connect(appKey)
  })

  ipcMain.handle('dropbox:disconnect', () => {
    dropboxService.disconnect()
  })

  // "Sync Now" button triggers a fresh initial fill via the queue manager
  ipcMain.handle('dropbox:sync-now', async () => {
    await photoQueueService._doInitialFill()
  })

  ipcMain.handle('dropbox:get-status', () => {
    return dropboxService.getStatus()
  })

  ipcMain.handle('dropbox:set-config', (_e, cfg: {
    folderPaths?: string[]
    photoCount?:  number
    enabled?:     boolean
  }) => {
    if (cfg.folderPaths !== undefined) settingsService.setDropboxFolderPaths(cfg.folderPaths)
    if (cfg.photoCount  !== undefined) settingsService.setDropboxPhotoCount(cfg.photoCount)
    if (cfg.enabled     !== undefined) settingsService.setDropboxEnabled(cfg.enabled)
  })
}
