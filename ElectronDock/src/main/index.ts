import { config as loadDotEnv } from 'dotenv'
import { resolve as resolvePath } from 'path'

// Load .env from project root before anything else
loadDotEnv({ path: resolvePath(__dirname, '../../.env'), quiet: true })

import { app, BrowserWindow, protocol, powerSaveBlocker } from 'electron'
import { createWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { authService } from './services/auth.service'
import { photosService } from './services/photos.service'
import { settingsService } from './services/settings.service'
import { photoQueueService } from './services/photoQueue.service'
import { wyzeBridgeService } from './services/wyze-bridge.service'
import { ringService } from './services/ring.service'
import { is } from '@electron-toolkit/utils'

// ── Kiosk / touchscreen flags (must be set before app.ready) ────────────────
// Enable capacitive touch events in Chromium
app.commandLine.appendSwitch('touch-events', 'enabled')
app.commandLine.appendSwitch('enable-touch-drag-drop')
// Disable pinch-to-zoom (prevents accidental zoom on touchscreen)
app.commandLine.appendSwitch('disable-pinch')
// Use the primary display at native resolution
app.commandLine.appendSwitch('force-device-scale-factor', '1')
// Smooth scrolling on touch
app.commandLine.appendSwitch('enable-features', 'SmoothScrolling')
// Disable the "Press Escape to exit fullscreen" overlay in production
if (!is.dev) {
  app.commandLine.appendSwitch('disable-features', 'ExitFullscreenOnEscape')
}

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
    // Prevent display sleep and app suspension — 24/7 kiosk operation
    powerSaveBlocker.start('prevent-display-sleep')
    powerSaveBlocker.start('prevent-app-suspension')

    const win = createWindow()

    // Register custom photo protocol handler
    protocol.handle('cdphoto', async (request) => {
      const { photosProtocolHandler } = await import('./protocol')
      return photosProtocolHandler(request)
    })

    // Register all IPC handlers
    registerIpcHandlers(win)

    // Auto-start Wyze bridge if credentials are configured
    const wyzeEmail = settingsService.get('wyzeBridgeEmail') ?? ''
    const wyzePass  = settingsService.get('wyzeBridgePassword') ?? ''
    wyzeBridgeService.ensureRunning(wyzeEmail, wyzePass).catch(() => {})

    // Revive Ring connection if a refresh token is stored
    ringService.ensureInitialized().catch(() => {})

    // Restore saved OAuth clients
    await authService.initialize()

    // Initialize rolling photo cache queue (handles both local and Dropbox modes)
    await photoQueueService.initialize(win)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    photoQueueService.stop()
    photosService.stopWatcher()
    if (process.platform !== 'darwin') app.quit()
  })
}
