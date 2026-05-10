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
   * Manual deep-sleep override. True after the user taps "Deep Sleep" in
   * Camera Wake settings — makes CameraWatcher treat the system as if
   * inside the deep-sleep time window, so the backlight goes off
   * immediately on entering standby instead of waiting passiveBacklight­
   * OffMinutes. Auto-clears the next time mode flips back to 'app'.
   */
  forceDeepSleep: boolean
  /** Reactive calendar display state — updated by CalendarView, read by AppHeader */
  calendarDate: Date
  calendarView: CalView
  setMode: (mode: AppMode) => void
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
  setMode: (mode) => set((s) => mode === 'app' && s.forceDeepSleep ? { mode, forceDeepSleep: false } : { mode }),
  setPage: (page) => set({ activePage: page, mode: 'app' }),
  setDayMode: (dayMode) => set({ dayMode }),
  setForceDeepSleep: (forceDeepSleep) => set({ forceDeepSleep }),
  toggleChipHidden: (calendarId) =>
    set((s) => {
      const next = new Set(s.chipHiddenIds)
      next.has(calendarId) ? next.delete(calendarId) : next.add(calendarId)
      return { chipHiddenIds: next }
    }),
  setCalendarDate: (calendarDate) => set({ calendarDate }),
  setCalendarView: (calendarView) => set({ calendarView }),
}))
