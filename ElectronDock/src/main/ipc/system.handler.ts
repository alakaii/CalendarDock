import { ipcMain, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { is } from '@electron-toolkit/utils'

const execAsync = promisify(exec)

export function registerSystemHandlers(win: BrowserWindow): void {
  ipcMain.handle('system:set-display-power', async (_event, { on }: { on: boolean }) => {
    if (process.platform !== 'linux') return
    const arg = on ? 'on' : 'off'

    // PRIMARY: GNOME Mutter DPMS on the session bus. On this hardware the eDP
    // intel_backlight panel is NOT the visible wall screen, so writing
    // /sys/class/backlight/ has no visible effect — driving Mutter's
    // PowerSaveMode is what actually blanks/relights the display. The systemd
    // service already exports DBUS_SESSION_BUS_ADDRESS + XDG_RUNTIME_DIR, so
    // `busctl --user` works from the main process with no sudo. PowerSaveMode:
    // 0 = on, 3 = off. GNOME auto-wakes DPMS on any user input, so a touch
    // while dark relights the panel at the compositor level even before the app
    // processes the tap; the app's wake path then re-asserts PowerSaveMode=0. If
    // phantom-touch relights become a problem later, a periodic re-assert can be
    // added — not now.
    const psm = on ? 0 : 3
    let mutterOk = false
    try {
      await execAsync(
        `busctl --user set-property org.gnome.Mutter.DisplayConfig /org/gnome/Mutter/DisplayConfig org.gnome.Mutter.DisplayConfig PowerSaveMode i ${psm}`,
        { env: process.env }
      )
      mutterOk = true
      console.warn(`[backlight] mutter dpms ${arg} ok`)
    } catch (err) {
      console.warn(`[backlight] mutter dpms ${arg} failed:`, err)
    }

    // SECONDARY: the sudo'd intel_backlight helper deployed by the self-update /
    // kiosk-bootstrap scripts. Harmless here (no visible panel), still correct
    // on hardware where eDP IS the visible panel. The sudoers rule
    // (calendardock-kiosk-update) only allows these two exact command lines.
    let backlightOk = false
    try {
      await execAsync(`sudo -n /usr/local/bin/calendardock-display-power ${arg}`)
      backlightOk = true
      console.warn(`[backlight] setDisplayPower(${arg}) ok`)
    } catch (err) {
      console.warn(`[system] setDisplayPower(${arg}) failed:`, err)
    }

    // Only warn-fail the overall op if BOTH mechanisms failed.
    if (!mutterOk && !backlightOk) {
      console.warn(`[system] setDisplayPower(${arg}) failed: no mechanism succeeded`)
    }
  })

  ipcMain.handle('system:enter-fullscreen', () => {
    // Match production startup mode (kiosk + fullscreen). Skip kiosk in dev so
    // the user can still escape the window during development.
    if (!is.dev) win.setKiosk(true)
    win.setFullScreen(true)
  })
}
