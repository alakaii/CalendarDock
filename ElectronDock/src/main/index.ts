import { config as loadDotEnv } from 'dotenv'
import { resolve as resolvePath } from 'path'

// Load .env from project root before anything else
loadDotEnv({ path: resolvePath(__dirname, '../../.env') })

import { app, BrowserWindow, protocol } from 'electron'
import { createWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { authService } from './services/auth.service'
import { photosService } from './services/photos.service'
import { settingsService } from './services/settings.service'

// Register cdphoto:// before app.ready (photos slideshow protocol)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cdphoto',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

// Single-instance lock — prevent duplicate windows
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  // Focus existing window if user tries to open a second instance
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    const win = createWindow()

    // Register custom photo protocol handler
    protocol.handle('cdphoto', async (request) => {
      const { photosProtocolHandler } = await import('./protocol')
      return photosProtocolHandler(request)
    })

    // Register all IPC handlers
    registerIpcHandlers(win)

    // Restore saved OAuth clients
    await authService.initialize()

    // Start photo watcher if folder is configured
    const settings = settingsService.getAll()
    if (settings.photoFolderPath) {
      photosService.startWatcher(settings.photoFolderPath, win)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    photosService.stopWatcher()
    if (process.platform !== 'darwin') app.quit()
  })
}
