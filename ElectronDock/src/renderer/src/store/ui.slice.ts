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
  /** Reactive calendar display state — updated by CalendarView, read by AppHeader */
  calendarDate: Date
  calendarView: CalView
  setMode: (mode: AppMode) => void
  setPage: (page: AppPage) => void
  setDayMode: (mode: DayMode) => void
  toggleChipHidden: (calendarId: string) => void
  setCalendarDate: (date: Date) => void
  setCalendarView: (view: CalView) => void
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'app',
  activePage: 'calendar',
  dayMode: 'passive',
  chipHiddenIds: new Set(),
  calendarDate: new Date(),
  calendarView: 'timeGridWeek',
  setMode: (mode) => set({ mode }),
  setPage: (page) => set({ activePage: page, mode: 'app' }),
  setDayMode: (dayMode) => set({ dayMode }),
  toggleChipHidden: (calendarId) =>
    set((s) => {
      const next = new Set(s.chipHiddenIds)
      next.has(calendarId) ? next.delete(calendarId) : next.add(calendarId)
      return { chipHiddenIds: next }
    }),
  setCalendarDate: (calendarDate) => set({ calendarDate }),
  setCalendarView: (calendarView) => set({ calendarView }),
}))
