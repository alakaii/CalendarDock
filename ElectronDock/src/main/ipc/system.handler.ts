import { ipcMain, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { is } from '@electron-toolkit/utils'

const execAsync = promisify(exec)

export function registerSystemHandlers(win: BrowserWindow): void {
  ipcMain.handle('system:set-display-power', async (_event, { on }: { on: boolean }) => {
    if (process.platform !== 'linux') return
    // Wayland kiosks can't use `xset dpms` (the X server isn't there in the
    // first place). The app drives /sys/class/backlight/ via a tiny sudo'd
    // helper deployed by the self-update / kiosk-bootstrap scripts. The
    // sudoers rule (calendardock-kiosk-update) only allows these two exact
    // command lines, so this is the entirety of what we can shell out to:
    const arg = on ? 'on' : 'off'
    try {
      await execAsync(`sudo -n /usr/local/bin/calendardock-display-power ${arg}`)
    } catch (err) {
      // Non-fatal: log so it shows up in journalctl, but don't crash the
      // standby flow. Most likely causes: helper not deployed yet (first
      // install before the kiosk has run a self-update with extraResources),
      // or no /sys/class/backlight on the host.
      console.warn(`[system] setDisplayPower(${arg}) failed:`, err)
    }
  })

  ipcMain.handle('system:enter-fullscreen', () => {
    // Match production startup mode (kiosk + fullscreen). Skip kiosk in dev so
    // the user can still escape the window during development.
    if (!is.dev) win.setKiosk(true)
    win.setFullScreen(true)
  })
}
