import { create } from 'zustand'
import type { AppPage } from '../../../preload/types'

type AppMode = 'app' | 'standby'
export type DayMode = 'passive' | 'active'
export type CalView = 'timeGridWeek' | 'dayGridMonth'

interface UIState {
  mode: AppMode
  activePage: AppPage
  dayMode: DayMode
  chipHiddenIds: Set<string>
  /**
   * Manual deep-sleep override. True after the user taps "Deep Sleep Now" in
   * Camera Wake settings — makes DisplayPowerManager treat the system as if
   * inside the deep-sleep time window, so the backlight goes off immediately
   * on entering standby instead of waiting passiveBacklightOffMinutes.
   * Auto-clears the next time mode flips back to exactly 'app' (a touch wake).
   * StandbyOverlay MUST call setMode('app') — an invalid mode value would
   * skip this auto-clear and leave every later standby cutting the backlight
   * immediately.
   */
  forceDeepSleep: boolean
  /** Reactive calendar display state — updated by CalendarView, read by AppHeader */
  calendarDate: Date
  calendarView: CalView
  /** cause is an optional low-noise label for the journal (e.g. 'inactivity-timer'). */
  setMode: (mode: AppMode, cause?: string) => void
  setPage: (page: AppPage) => void
  setDayMode: (mode: DayMode) => void
  setForceDeepSleep: (force: boolean) => void
  toggleChipHidden: (calendarId: string) => void
  setCalendarDate: (date: Date) => void
  setCalendarView: (view: CalView) => void
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'app',
  activePage: 'calendar',
  dayMode: 'passive',
  chipHiddenIds: new Set(),
  forceDeepSleep: false,
  calendarDate: new Date(),
  calendarView: 'timeGridWeek',
  // Mode change auto-clears the manual deep-sleep override on wake to 'app'.
  // Anything else (going back into standby on its own from the inactivity
  // timer) leaves the flag alone — but it should already be false there,
  // since only the explicit button sets it true.
  setMode: (mode: AppMode, cause?: string) =>
    set((s) => {
      if (mode === s.mode) return {}
      console.warn(`[standby] ${mode === 'standby' ? 'enter' : 'exit'} (cause: ${cause ?? 'unspecified'})`)
      if (mode === 'app' && s.forceDeepSleep) {
        console.warn('[standby] forceDeepSleep cleared (cause: wake-to-app)')
        return { mode, forceDeepSleep: false }
      }
      return { mode }
    }),
  setPage: (page) => set({ activePage: page, mode: 'app' }),
  setDayMode: (dayMode) =>
    set((s) => {
      if (dayMode === s.dayMode) return {}
      console.warn(`[standby] dayMode ${dayMode} (room ${dayMode === 'active' ? 'occupied' : 'empty'})`)
      return { dayMode }
    }),
  setForceDeepSleep: (forceDeepSleep) => {
    console.warn(`[standby] forceDeepSleep ${forceDeepSleep ? 'set' : 'cleared'}`)
    set({ forceDeepSleep })
  },
  toggleChipHidden: (calendarId) =>
    set((s) => {
      const next = new Set(s.chipHiddenIds)
      next.has(calendarId) ? next.delete(calendarId) : next.add(calendarId)
      return { chipHiddenIds: next }
    }),
  setCalendarDate: (calendarDate) => set({ calendarDate }),
  setCalendarView: (calendarView) => set({ calendarView }),
}))
