import { create } from 'zustand'
import type { AppSettings, ThemeMode, SlideshowSettings, StandbyLayout, StandbyExitGesture, ChoresMode, ChoresList, ListsMode, ListsFilter, WyzeCamera, CalendarSwipeDirection, SidebarSlot } from '../../../preload/types'

interface SettingsState extends AppSettings {
  loadFromMain: () => Promise<void>
  setCalendarVisible: (calendarId: string, visible: boolean) => void
  setAllCalendarsVisible: (calendarIds: string[], visible: boolean) => void
  setCalendarColor: (calendarId: string, color: string) => void
  setCalendarColorOverride: (calendarId: string, mode: 'light' | 'dark', color: string) => void
  setCalendarOrder: (ids: string[]) => void
  setMealsFontSize: (size: number) => void
  setFamilyName: (name: string) => void
  setThemeMode: (mode: ThemeMode) => void
  setTimezone: (tz: string) => void
  setAdditionalTimezones: (zones: string[]) => void
  setMealCell: (key: string, value: string) => void
  setSlideshowSettings: (s: SlideshowSettings) => void
  setCalendarSwipe: (view: 'week' | 'month', direction: CalendarSwipeDirection) => void
  setSidebarLayout: (layout: SidebarSlot[]) => void
  setStandbyLayout: (l: StandbyLayout) => void
  setStandbyExitGesture: (g: StandbyExitGesture) => void
  // List mutations (optimistic)
  addList: (name: string) => Promise<void>
  removeList: (listId: string) => void
  addItem: (listId: string, text: string) => Promise<void>
  toggleItem: (listId: string, itemId: string, checked: boolean) => void
  removeItem: (listId: string, itemId: string) => void
  // Chores / Lists config
  setChoresMode: (mode: ChoresMode) => void
  setChoresLists: (lists: ChoresList[]) => void
  setListsMode: (mode: ListsMode) => void
  setListsFilter: (filter: ListsFilter) => void
  setListsSelectedIds: (ids: string[]) => void
  // Integrations
  setCameras: (cameras: WyzeCamera[]) => void
  setRachioApiKey: (key: string) => void
  setRinnaiCredentials: (email: string, password: string) => void
  setMealsGoogleTaskList:  (accountId: string, taskListId: string) => void
  setFridgeGoogleTaskList: (accountId: string, taskListId: string) => void
  setCameraWakeEnabled:    (enabled: boolean) => void
  setDeepSleepSchedule:   (start: string, end: string) => void
  setCameraWakeCalibration:(background: number[], threshold: number) => void
  setCameraWakeThreshold:  (threshold: number) => void
  setPassiveDaySettings:   (standbyMinutes: number, backlightOffMinutes: number) => void
  setActiveDaySettings:    (standbyMinutes: number, sustainSeconds: number, holdMinutes: number) => void
  setWyzeBridgeConfig: (email: string, password: string, host: string, apiId: string, apiKey: string) => void
  setRingSnapshotInterval: (seconds: number) => void
  setTeslaConnectionMode: (mode: 'fleet' | 'local') => void
}

const defaults: AppSettings = {
  accounts: [],
  calendarPreferences: {},
  calendarOrder: [],
  weather: { location: '', units: 'imperial', apiKey: '' },
  timezone: '',
  additionalTimezones: [],
  photoFolderPath: '',
  standbyTimeoutMinutes: 10,
  launchOnStartup: false,
  familyName: 'Walker Family Calendar',
  themeMode: 'auto',
  lists: [],
  mealPlan: {},
  calendarSwipeWeek:  'horizontal',
  calendarSwipeMonth: 'horizontal',
  sidebarLayout: [
    { kind: 'item', pageId: 'calendar'    },
    { kind: 'item', pageId: 'chores'      },
    { kind: 'item', pageId: 'meals'       },
    { kind: 'item', pageId: 'photos'      },
    { kind: 'item', pageId: 'lists'       },
    { kind: 'item', pageId: 'cameras'     },
    { kind: 'item', pageId: 'sprinklers'  },
    { kind: 'item', pageId: 'waterheater' },
    { kind: 'item', pageId: 'tesla'       },
  ],
  slideshow: {
    durationSec: 8,
    sortOrder: 'filename',
    transition: 'fade',
    transitionDurationMs: 1500,
    cropMode: 'fit',
    focusSafeZonePercent: 60,
  },
  standbyLayout: {
    time:    { corner: 'top-left',     enabled: true },
    weather: { corner: 'top-left',     enabled: true },
    events:  { corner: 'top-left',     enabled: true },
    water:   { corner: 'bottom-right', enabled: true },
    tesla:   { corner: 'bottom-left',  enabled: false },
    priority: ['time', 'weather', 'events', 'water', 'tesla'],
    weatherFields: {
      temperature: true,
      feelsLike:   false,
      condition:   true,
      humidity:    false,
      city:        true
    },
    waterFields: {
      timeRemaining:       true,
      domesticTemperature: true,
      recircTemperature:   true,
      outletTemperature:   false,
      inletTemperature:    false,
    },
    teslaFields: {
      batteryPercent: true,
      powerFlow:      true,
      gridStatus:     true,
    }
  },
  standbyExitGesture: 'double-tap' as StandbyExitGesture,
  choresMode: 'local' as ChoresMode,
  choresLists: [{ id: 'chores', name: 'Chores' }],
  listsMode: 'google' as ListsMode,
  listsFilter: 'all' as ListsFilter,
  listsSelectedIds: [],
  cameras: [] as WyzeCamera[],
  rachioApiKey: '',
  rinnaiEmail: '',
  rinnaiPassword: '',
  teslaFleetClientId:     '',
  teslaFleetClientSecret: '',
  teslaFleetRegion:       'na' as const,
  teslaEnergySiteId:      '',
  teslaSiteName:          '',
  teslaConnectedAt:       0,
  teslaVehicles:          [],
  teslaConnectionMode:    'fleet',
  teslaGatewayHost:       '192.168.91.1',
  teslaGatewayConfigured: false,
  mealsGoogleAccountId:  '',
  mealsGoogleTaskListId: '',
  mealsFontSize: 1,
  fridgeGoogleAccountId:  '',
  fridgeGoogleTaskListId: '',
  dropboxAppKey:       '',
  dropboxFolderPath:   '',
  dropboxPhotoCount:   200,
  dropboxEnabled:      false,
  dropboxLastSync:     0,
  dropboxAccountEmail: '',
  cameraWakeEnabled:          false,
  deepSleepStart:             '21:00',
  deepSleepEnd:               '06:00',
  cameraWakeThreshold:        0.15,
  cameraWakePixelNoise:       20,
  cameraWakeBackground:       null,
  passiveStandbyMinutes:      5,
  passiveBacklightOffMinutes: 15,
  activeStandbyMinutes:       30,
  motionSustainSeconds:       6,
  activeHoldMinutes:          20,
  wyzeBridgeEmail:    '',
  wyzeBridgePassword: '',
  wyzeBridgeHost:     'localhost:8554',
  wyzeBridgeApiId:    '',
  wyzeBridgeApiKey:   '',
  ringAccountEmail:        '',
  ringSnapshotIntervalSec: 30,
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
        [calendarId]: {
          ...(s.calendarPreferences[calendarId] ?? { visible: true }),
          colorOverrideLight: color,
          colorOverrideDark:  color,
        }
      }
    }))
  },

  setCalendarColorOverride: (calendarId, mode, color) => {
    window.api.settings.setCalendarColorOverride(calendarId, mode, color)
    set((s) => {
      const key  = mode === 'light' ? 'colorOverrideLight' : 'colorOverrideDark'
      const next = { ...(s.calendarPreferences[calendarId] ?? { visible: true }) }
      if (color) next[key] = color
      else       delete next[key]
      return {
        calendarPreferences: { ...s.calendarPreferences, [calendarId]: next }
      }
    })
  },

  setCalendarOrder: (ids) => {
    window.api.settings.setCalendarOrder(ids)
    set({ calendarOrder: ids })
  },

  setMealsFontSize: (size) => {
    window.api.settings.setMealsFontSize(size)
    set({ mealsFontSize: size })
  },

  setFamilyName: (name) => {
    window.api.settings.setFamilyName(name)
    set({ familyName: name })
  },

  setThemeMode: (mode) => {
    window.api.settings.setThemeMode(mode)
    set({ themeMode: mode })
  },

  setTimezone: (tz) => {
    window.api.settings.setTimezone(tz)
    set({ timezone: tz })
  },

  setAdditionalTimezones: (zones) => {
    window.api.settings.setAdditionalTimezones(zones)
    set({ additionalTimezones: zones })
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

  setCalendarSwipe: (view, direction) => {
    window.api.settings.setCalendarSwipe(view, direction)
    set(view === 'week'
      ? { calendarSwipeWeek: direction }
      : { calendarSwipeMonth: direction })
  },

  setSidebarLayout: (layout) => {
    window.api.settings.setSidebarLayout(layout)
    set({ sidebarLayout: layout })
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
  },

  setChoresMode: (mode) => {
    window.api.settings.setChoresMode(mode)
    set({ choresMode: mode })
  },

  setChoresLists: (lists) => {
    window.api.settings.setChoresLists(lists)
    set({ choresLists: lists })
  },

  setListsMode: (mode) => {
    window.api.settings.setListsMode(mode)
    set({ listsMode: mode })
  },

  setListsFilter: (filter) => {
    window.api.settings.setListsFilter(filter)
    set({ listsFilter: filter })
  },

  setListsSelectedIds: (ids) => {
    window.api.settings.setListsSelectedIds(ids)
    set({ listsSelectedIds: ids })
  },

  setCameras: (cameras) => {
    window.api.settings.setCameras(cameras)
    set({ cameras })
  },

  setRachioApiKey: (key) => {
    window.api.settings.setRachioApiKey(key)
    set({ rachioApiKey: key })
  },

  setRinnaiCredentials: (email, password) => {
    window.api.settings.setRinnaiCredentials(email, password)
    set({ rinnaiEmail: email, rinnaiPassword: password })
  },

setMealsGoogleTaskList: (accountId, taskListId) => {
    window.api.settings.setMealsGoogleTaskList(accountId, taskListId)
    set({ mealsGoogleAccountId: accountId, mealsGoogleTaskListId: taskListId })
  },

  setFridgeGoogleTaskList: (accountId, taskListId) => {
    window.api.settings.setFridgeGoogleTaskList(accountId, taskListId)
    set({ fridgeGoogleAccountId: accountId, fridgeGoogleTaskListId: taskListId })
  },

  setCameraWakeEnabled: (enabled) => {
    window.api.settings.setCameraWakeEnabled(enabled)
    set({ cameraWakeEnabled: enabled })
  },

  setDeepSleepSchedule: (start, end) => {
    window.api.settings.setDeepSleepSchedule(start, end)
    set({ deepSleepStart: start, deepSleepEnd: end })
  },

  setCameraWakeCalibration: (background, threshold) => {
    window.api.settings.setCameraWakeCalibration(background, threshold)
    set({ cameraWakeBackground: background, cameraWakeThreshold: threshold })
  },

  setCameraWakeThreshold: (threshold) => {
    window.api.settings.setCameraWakeThreshold(threshold)
    set({ cameraWakeThreshold: threshold })
  },

  setPassiveDaySettings: (standbyMinutes, backlightOffMinutes) => {
    window.api.settings.setPassiveDaySettings(standbyMinutes, backlightOffMinutes)
    set({ passiveStandbyMinutes: standbyMinutes, passiveBacklightOffMinutes: backlightOffMinutes })
  },

  setActiveDaySettings: (standbyMinutes, sustainSeconds, holdMinutes) => {
    window.api.settings.setActiveDaySettings(standbyMinutes, sustainSeconds, holdMinutes)
    set({ activeStandbyMinutes: standbyMinutes, motionSustainSeconds: sustainSeconds, activeHoldMinutes: holdMinutes })
  },

  setWyzeBridgeConfig: (email, password, host, apiId, apiKey) => {
    window.api.settings.setWyzeBridgeConfig(email, password, host, apiId, apiKey)
    set({
      wyzeBridgeEmail: email, wyzeBridgePassword: password, wyzeBridgeHost: host,
      wyzeBridgeApiId: apiId, wyzeBridgeApiKey: apiKey,
    })
  },

  setRingSnapshotInterval: (seconds) => {
    const clamped = Math.max(5, Math.floor(seconds))
    window.api.settings.setRingSnapshotInterval(clamped)
    set({ ringSnapshotIntervalSec: clamped })
  },

  setTeslaConnectionMode: (mode) => {
    window.api.tesla.setConnectionMode(mode)
    set({ teslaConnectionMode: mode })
  },
}))
