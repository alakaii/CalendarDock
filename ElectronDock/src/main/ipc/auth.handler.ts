import { ipcMain } from 'electron'
import { authService } from '../services/auth.service'

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:start-flow', async () => {
    return authService.startFlow()
  })

  ipcMain.handle('auth:remove-account', async (_event, { accountId }: { accountId: string }) => {
    return authService.removeAccount(accountId)
  })

  ipcMain.handle('auth:list-accounts', async () => {
    return authService.listAccounts()
  })
}
