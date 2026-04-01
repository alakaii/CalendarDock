import { BrowserWindow, shell, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createWindow(): BrowserWindow {
  // Use the primary display's actual resolution — works correctly on the
  // 1920×1080 kiosk and still opens a sensible window in dev on other machines
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    kiosk: !is.dev,      // True kiosk mode in production: fullscreen + no OS chrome
    fullscreen: !is.dev, // Belt-and-suspenders alongside kiosk
    autoHideMenuBar: true,
    backgroundColor: '#111827', // gray-900 — prevents white flash on load
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,    // Required for preload with require
      webSecurity: true,
      zoomFactor: 1.0,   // Native 1:1 pixel ratio — no browser zoom
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  // Open external links in the system browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
