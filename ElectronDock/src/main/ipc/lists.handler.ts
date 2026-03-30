import { ipcMain } from 'electron'
import { settingsService } from '../services/settings.service'

export function registerListsHandlers(): void {
  ipcMain.handle('lists:add-list', async (_event, { name }: { name: string }) => {
    return settingsService.addList(name)
  })

  ipcMain.handle('lists:remove-list', async (_event, { listId }: { listId: string }) => {
    settingsService.removeList(listId)
  })

  ipcMain.handle(
    'lists:add-item',
    async (_event, { listId, text }: { listId: string; text: string }) => {
      return settingsService.addItem(listId, text)
    }
  )

  ipcMain.handle(
    'lists:toggle-item',
    async (
      _event,
      { listId, itemId, checked }: { listId: string; itemId: string; checked: boolean }
    ) => {
      settingsService.toggleItem(listId, itemId, checked)
    }
  )

  ipcMain.handle(
    'lists:remove-item',
    async (_event, { listId, itemId }: { listId: string; itemId: string }) => {
      settingsService.removeItem(listId, itemId)
    }
  )
}
