import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export function registerSystemHandlers(): void {
  ipcMain.handle('system:set-display-power', async (_event, { on }: { on: boolean }) => {
    try {
      // Force DPMS display power on Ubuntu/Linux kiosk
      await execAsync(`DISPLAY=:0 xset dpms force ${on ? 'on' : 'off'}`)
    } catch (err) {
      // Non-fatal — may not be available in dev / non-Linux environments
      console.warn('[system] setDisplayPower failed:', err)
    }
  })
}
