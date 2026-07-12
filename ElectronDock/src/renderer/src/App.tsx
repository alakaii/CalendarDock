import { useEffect } from 'react'
import { useUIStore } from './store/ui.slice'
import { useSettingsStore } from './store/settings.slice'
import { useInactivityTimer } from './hooks/useInactivityTimer'
import { useTheme } from './hooks/useTheme'
import AppShell from './components/shell/AppShell'
import StandbyOverlay from './components/standby/StandbyOverlay'
import CameraWatcher from './components/shell/CameraWatcher'
import DisplayPowerManager from './components/shell/DisplayPowerManager'
import VirtualKeyboard from './components/shell/VirtualKeyboard'

export default function App() {
  const mode                  = useUIStore((s) => s.mode)
  const loadSettings          = useSettingsStore((s) => s.loadFromMain)
  const standbyTimeoutMinutes = useSettingsStore((s) => s.standbyTimeoutMinutes)

  // Always honor the user's explicit standby timeout. Earlier a pair of
  // camera-wake standby overrides (since removed) hijacked this value when
  // cameraWakeEnabled was true, which made the manual setting in the UI
  // silently ineffective ("I set 2 min but it sat on calendar for 30").
  // Camera now only drives status (passive/active dayMode); timing is what
  // the user typed.
  const standbyTimeoutMs = standbyTimeoutMinutes * 60_000

  // Load settings from main process on startup
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Apply light/dark theme based on settings + time-of-day
  useTheme()

  // Always-active inactivity timer — switches to standby after timeout
  useInactivityTimer(standbyTimeoutMs)

  return (
    <>
      <DisplayPowerManager />
      <CameraWatcher />
      {mode === 'standby' ? <StandbyOverlay /> : <AppShell />}
      <VirtualKeyboard />
    </>
  )
}
