import { ipcMain } from 'electron'
import { photosService } from '../services/photos.service'

export function registerPhotosHandlers(): void {
  ipcMain.handle('photos:get-list', async () => {
    return photosService.getList()
  })
}
