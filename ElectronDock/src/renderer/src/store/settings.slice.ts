import { create } from 'zustand'
import type { AppSettings, ThemeMode, SlideshowSettings, StandbyLayout, StandbyExitGesture } from '../../../preload/types'

interface SettingsState extends AppSettings {
  loadFromMain: () => Promise<void>
  setCalendarVisible: (calendarId: string, visible: boolean) => void
  setAllCalendarsVisible: (calendarIds: string[], visible: boolean) => void
  setCalendarColor: (calendarId: string, color: string) => void
  setFamilyName: (name: string) => void
  setThemeMode: (mode: ThemeMode) => void
  setMealCell: (key: string, value: string) => void
  setSlideshowSettings: (s: SlideshowSettings) => void
  setStandbyLayout: (l: StandbyLayout) => void
  setStandbyExitGesture: (g: StandbyExitGesture) => void
  // List mutations (optimistic)
  addList: (name: string) => Promise<void>
  removeList: (listId: string) => void
  addItem: (listId: string, text: string) => Promise<void>
  toggleItem: (listId: string, itemId: string, checked: boolean) => void
  removeItem: (listId: string, itemId: string) => void
}

const defaults: AppSettings = {
  accounts: [],
  calendarPreferences: {},
  weather: { location: '', units: 'imperial', apiKey: '' },
  photoFolderPath: '',
  standbyTimeoutMinutes: 10,
  launchOnStartup: false,
  familyName: 'Walker Family Calendar',
  themeMode: 'auto',
  lists: [],
  mealPlan: {},
  slideshow: {
    durationSec: 8,
    sortOrder: 'filename',
    transition: 'fade',
    transitionDurationMs: 1500
  },
  standbyLayout: {
    time:    { corner: 'top-left', enabled: true },
    weather: { corner: 'top-left', enabled: true },
    events:  { corner: 'top-left', enabled: true },
    priority: ['time', 'weather', 'events'],
    weatherFields: {
      temperature: true,
      feelsLike:   false,
      condition:   true,
      humidity:    false,
      city:        true
    }
  },
  standbyExitGesture: 'double-tap' as StandbyExitGesture
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaults,

  loadFromMain: async () => {
    const settings = await window.api.settings.getAll()
    set(settings)
  },

  setCalendarVisible: (calendarId, visible) => {
    window.api.settings.setCalendarVisible(calendarId, visible)
    set((s) => ({
      calendarPreferences: {
        ...s.calendarPreferences,
        [calendarId]: { ...(s.calendarPreferences[calendarId] ?? {}), visible }
      }
    }))
  },

  setAllCalendarsVisible: (calendarIds, visible) => {
    calendarIds.forEach((id) => window.api.settings.setCalendarVisible(id, visible))
    set((s) => {
      const updated = { ...s.calendarPreferences }
      calendarIds.forEach((id) => {
        updated[id] = { ...(updated[id] ?? {}), visible }
      })
      return { calendarPreferences: updated }
    })
  },

  setCalendarColor: (calendarId, color) => {
    window.api.settings.setCalendarColor(calendarId, color)
    set((s) => ({
      calendarPreferences: {
        ...s.calendarPreferences,
        [calendarId]: { ...(s.calendarPreferences[calendarId] ?? {}), colorOverride: color }
      }
    }))
  },

  setFamilyName: (name) => {
    window.api.settings.setFamilyName(name)
    set({ familyName: name })
  },

  setThemeMode: (mode) => {
    window.api.settings.setThemeMode(mode)
    set({ themeMode: mode })
  },

  setMealCell: (key, value) => {
    window.api.settings.setMealCell(key, value)
    set((s) => ({
      mealPlan: value.trim()
        ? { ...s.mealPlan, [key]: value.trim() }
        : Object.fromEntries(Object.entries(s.mealPlan).filter(([k]) => k !== key))
    }))
  },

  setSlideshowSettings: (s) => {
    window.api.settings.setSlideshowSettings(s)
    set({ slideshow: s })
  },

  setStandbyLayout: (l) => {
    window.api.settings.setStandbyLayout(l)
    set({ standbyLayout: l })
  },

  setStandbyExitGesture: (g) => {
    window.api.settings.setStandbyExitGesture(g)
    set({ standbyExitGesture: g })
  },

  addList: async (name) => {
    const newList = await window.api.lists.addList(name)
    set((s) => ({ lists: [...s.lists, newList] }))
  },

  removeList: (listId) => {
    window.api.lists.removeList(listId)
    set((s) => ({ lists: s.lists.filter((l) => l.id !== listId) }))
  },

  addItem: async (listId, text) => {
    const item = await window.api.lists.addItem(listId, text)
    set((s) => ({
      lists: s.lists.map((l) =>
        l.id === listId ? { ...l, items: [...l.items, item] } : l
      )
    }))
  },

  toggleItem: (listId, itemId, checked) => {
    window.api.lists.toggleItem(listId, itemId, checked)
    set((s) => ({
      lists: s.lists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.map((it) => (it.id === itemId ? { ...it, checked } : it)) }
          : l
      )
    }))
  },

  removeItem: (listId, itemId) => {
    window.api.lists.removeItem(listId, itemId)
    set((s) => ({
      lists: s.lists.map((l) =>
        l.id === listId ? { ...l, items: l.items.filter((it) => it.id !== itemId) } : l
      )
    }))
  }
}))
