import { config as loadDotEnv } from 'dotenv'
import { resolve as resolvePath } from 'path'
import { existsSync } from 'fs'
import { homedir } from 'os'

import { app, BrowserWindow, protocol, powerSaveBlocker, session } from 'electron'

// Load credentials from the first .env that exists. In dev this is the
// project root; on the kiosk it's a stable user-config path that survives
// .deb upgrades. Bundling secrets inside the .deb would expose them in the
// public repo's release artifacts, so we keep them out of the package.
const envCandidates = [
  resolvePath(homedir(), '.config', 'calendardock', 'credentials.env'),
  app.isPackaged
    ? resolvePath(app.getPath('userData'), 'credentials.env')
    : resolvePath(__dirname, '../../.env'),
]
for (const path of envCandidates) {
  if (existsSync(path)) {
    loadDotEnv({ path, quiet: true })
    break
  }
}
import { createWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { authService } from './services/auth.service'
import { photosService } from './services/photos.service'
import { settingsService } from './services/settings.service'
import { photoQueueService } from './services/photoQueue.service'
import { icloudService } from './services/icloud.service'
import { wyzeBridgeService } from './services/wyze-bridge.service'
import { ringService } from './services/ring.service'
import { bootstrapCredentialsFromEnv } from './services/credentials-bootstrap.service'
import { initEventLog } from './services/eventlog.service'
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
    // Start the Activity event log first so it can tee bracketed console
    // lines from every service that inits below into its ring buffer.
    initEventLog()

    // Prevent display sleep and app suspension — 24/7 kiosk operation
    powerSaveBlocker.start('prevent-display-sleep')
    powerSaveBlocker.start('prevent-app-suspension')

    // Auto-grant camera/microphone permission requests from the renderer.
    // Without this, navigator.mediaDevices.getUserMedia() returns a black
    // stream (the Camera Wake calibration's "camera is black" symptom).
    // We're a packaged kiosk app — the renderer is our own bundle, not a
    // remote site, so there's nothing untrusted to gate.
    const grantedPermissions = new Set(['media', 'mediaKeySystem', 'display-capture'])
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(grantedPermissions.has(permission))
    })
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
      return grantedPermissions.has(permission)
    })

    const win = createWindow()

    // Register custom photo protocol handler
    protocol.handle('cdphoto', async (request) => {
      const { photosProtocolHandler } = await import('./protocol')
      return photosProtocolHandler(request)
    })

    // Register all IPC handlers
    registerIpcHandlers(win)

    // Pull SSH-deployed credentials from credentials.env into settings
    // (only fills empty fields, never overrides anything set via the UI).
    bootstrapCredentialsFromEnv()

    // Auto-start Wyze bridge if credentials are configured
    const wyzeEmail  = settingsService.get('wyzeBridgeEmail')    ?? ''
    const wyzePass   = settingsService.get('wyzeBridgePassword') ?? ''
    const wyzeApiId  = settingsService.get('wyzeBridgeApiId')    ?? ''
    const wyzeApiKey = settingsService.get('wyzeBridgeApiKey')   ?? ''
    wyzeBridgeService.ensureRunning(wyzeEmail, wyzePass, wyzeApiId, wyzeApiKey).catch(() => {})

    // Revive Ring connection if a refresh token is stored
    ringService.ensureInitialized().catch(() => {})

    // Restore saved OAuth clients
    await authService.initialize()

    // Initialize rolling photo cache queue (handles both local and Dropbox modes)
    await photoQueueService.initialize(win)

    // Fold the iCloud Shared Album cache into the slideshow pool (resyncs if stale)
    icloudService.initialize(win).catch((err) => console.warn('[icloud] init failed:', err))

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
