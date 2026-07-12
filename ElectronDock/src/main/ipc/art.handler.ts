import { ipcMain } from 'electron'
import { backgroundArtService } from '../services/background-art.service'

export function registerArtHandlers(): void {
  ipcMain.handle('art:get-fullscreen', async () => backgroundArtService.getUrl())

  ipcMain.handle(
    'art:set-fullscreen',
    async (_event, { bytes, ext }: { bytes: Uint8Array; ext: string }) => {
      backgroundArtService.save(bytes, ext)
      return backgroundArtService.getUrl()
    }
  )

  ipcMain.handle('art:clear-fullscreen', async () => {
    backgroundArtService.clear()
  })
}
