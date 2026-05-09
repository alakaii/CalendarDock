import { ipcMain, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { is } from '@electron-toolkit/utils'

const execAsync = promisify(exec)

export function registerSystemHandlers(win: BrowserWindow): void {
  ipcMain.handle('system:set-display-power', async (_event, { on }: { on: boolean }) => {
    try {
      // Force DPMS display power on Ubuntu/Linux kiosk
      await execAsync(`DISPLAY=:0 xset dpms force ${on ? 'on' : 'off'}`)
    } catch (err) {
      // Non-fatal — may not be available in dev / non-Linux environments
      console.warn('[system] setDisplayPower failed:', err)
    }
  })

  ipcMain.handle('system:enter-fullscreen', () => {
    // Match production startup mode (kiosk + fullscreen). Skip kiosk in dev so
    // the user can still escape the window during development.
    if (!is.dev) win.setKiosk(true)
    win.setFullScreen(true)
  })
}
