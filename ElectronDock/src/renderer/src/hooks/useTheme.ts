import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settings.slice'
import type { ThemeMode } from '../../../preload/types'

/** Returns true if the current hour falls in the "dark" period (8pm–7am). */
function isDarkHour(): boolean {
  const h = new Date().getHours()
  return h >= 20 || h < 7
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark')  return true
  if (mode === 'light') return false
  return isDarkHour()
}

function applyTheme(dark: boolean) {
  if (dark) document.documentElement.classList.add('dark')
  else      document.documentElement.classList.remove('dark')
}

export function useTheme() {
  const themeMode = useSettingsStore((s) => s.themeMode)

  useEffect(() => {
    const update = () => applyTheme(resolveDark(themeMode))
    update()
    if (themeMode !== 'auto') return
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [themeMode])
}

/** Returns 'light' | 'dark' — the *effective* theme, with 'auto' resolved. */
export function useEffectiveTheme(): 'light' | 'dark' {
  const themeMode = useSettingsStore((s) => s.themeMode)
  const [dark, setDark] = useState<boolean>(() => resolveDark(themeMode))

  useEffect(() => {
    setDark(resolveDark(themeMode))
    if (themeMode !== 'auto') return
    const id = setInterval(() => setDark(resolveDark(themeMode)), 60_000)
    return () => clearInterval(id)
  }, [themeMode])

  return dark ? 'dark' : 'light'
}
