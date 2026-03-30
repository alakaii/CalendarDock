import { create } from 'zustand'
import type { CalendarListItem } from '../../../preload/types'

interface CalendarsState {
  calendars: CalendarListItem[]
  setCalendars: (calendars: CalendarListItem[]) => void
  addCalendars: (calendars: CalendarListItem[]) => void
}

export const useCalendarsStore = create<CalendarsState>((set) => ({
  calendars: [],
  setCalendars: (calendars) => set({ calendars }),
  addCalendars: (newCalendars) =>
    set((s) => {
      const existing = new Map(s.calendars.map((c) => [c.id, c]))
      for (const c of newCalendars) existing.set(c.id, c)
      return { calendars: Array.from(existing.values()) }
    })
}))
