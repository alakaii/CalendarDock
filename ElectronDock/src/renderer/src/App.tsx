import { useEffect } from 'react'
import { useUIStore } from './store/ui.slice'
import { useSettingsStore } from './store/settings.slice'
import { useInactivityTimer } from './hooks/useInactivityTimer'
import { useTheme } from './hooks/useTheme'
import AppShell from './components/shell/AppShell'
import StandbyOverlay from './components/standby/StandbyOverlay'
import CameraWatcher from './components/shell/CameraWatcher'
import VirtualKeyboard from './components/shell/VirtualKeyboard'

export default function App() {
  const mode                  = useUIStore((s) => s.mode)
  const dayMode               = useUIStore((s) => s.dayMode)
  const loadSettings          = useSettingsStore((s) => s.loadFromMain)
  const cameraWakeEnabled     = useSettingsStore((s) => s.cameraWakeEnabled)
  const passiveStandbyMinutes = useSettingsStore((s) => s.passiveStandbyMinutes)
  const activeStandbyMinutes  = useSettingsStore((s) => s.activeStandbyMinutes)
  const standbyTimeoutMinutes = useSettingsStore((s) => s.standbyTimeoutMinutes)

  // When camera wake is on, use mode-specific timeouts; otherwise fall back to the manual setting
  const standbyTimeoutMs = cameraWakeEnabled
    ? (dayMode === 'active' ? activeStandbyMinutes : passiveStandbyMinutes) * 60_000
    : standbyTimeoutMinutes * 60_000

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
      <CameraWatcher />
      {mode === 'standby' ? <StandbyOverlay /> : <AppShell />}
      <VirtualKeyboard />
    </>
  )
}
