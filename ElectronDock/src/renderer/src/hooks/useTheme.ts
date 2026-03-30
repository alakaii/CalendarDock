import { useEffect } from 'react'
import { useSettingsStore } from '../store/settings.slice'
import type { ThemeMode } from '../../../preload/types'

/** Returns true if the current hour falls in the "dark" period (8pm–7am). */
function isDarkHour(): boolean {
  const h = new Date().getHours()
  return h >= 20 || h < 7
}

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const themeMode = useSettingsStore((s) => s.themeMode)

  useEffect(() => {
    function update() {
      let dark: boolean
      if (themeMode === 'dark') dark = true
      else if (themeMode === 'light') dark = false
      else dark = isDarkHour() // 'auto'
      applyTheme(dark)
    }

    update()

    if (themeMode !== 'auto') return // no interval needed

    // Re-check once per minute when in auto mode
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [themeMode])
}
