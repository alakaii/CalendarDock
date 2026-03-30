import { useEffect } from 'react'
import { useUIStore } from './store/ui.slice'
import { useSettingsStore } from './store/settings.slice'
import { useInactivityTimer } from './hooks/useInactivityTimer'
import { useTheme } from './hooks/useTheme'
import AppShell from './components/shell/AppShell'
import StandbyOverlay from './components/standby/StandbyOverlay'

export default function App() {
  const mode             = useUIStore((s) => s.mode)
  const standbyTimeoutMs = useSettingsStore((s) => s.standbyTimeoutMinutes * 60 * 1000)
  const loadSettings     = useSettingsStore((s) => s.loadFromMain)

  // Load settings from main process on startup
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Apply light/dark theme based on settings + time-of-day
  useTheme()

  // Always-active inactivity timer — switches to standby after timeout
  useInactivityTimer(standbyTimeoutMs)

  if (mode === 'standby') {
    return <StandbyOverlay />
  }

  return <AppShell />
}
