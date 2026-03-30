// ============================================================
// Shared types used by both main process and renderer
// No runtime imports — types only
// ============================================================

export interface GoogleAccount {
  id: string
  email: string
  displayName: string
  photoUrl?: string
}

export interface CalendarListItem {
  id: string
  accountId: string
  summary: string
  description?: string
  backgroundColor: string
  foregroundColor: string
  primary: boolean
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader'
}

export interface CalendarEvent {
  id: string
  calendarId: string
  accountId: string
  title: string
  start: string // ISO 8601
  end: string
  allDay: boolean
  description?: string
  location?: string
  colorId?: string
  htmlLink?: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  recurringEventId?: string
}

export interface CreateEventPayload {
  accountId: string
  calendarId: string
  title: string
  start: string
  end: string
  allDay: boolean
  description?: string
}

export interface CalendarPreference {
  visible: boolean
  colorOverride?: string
}

export interface WeatherConfig {
  location: string
  units: 'imperial' | 'metric'
  apiKey: string
}

// ---- Slideshow ----

export type SlideshowSortOrder = 'random' | 'filename' | 'date'
export type SlideshowTransition = 'fade' | 'zoom'

export interface SlideshowSettings {
  /** Seconds each slide is shown (3–30) */
  durationSec: number
  /** How photos are ordered */
  sortOrder: SlideshowSortOrder
  /** Visual transition between slides */
  transition: SlideshowTransition
  /** Transition animation duration in milliseconds (500–3000) */
  transitionDurationMs: number
}

// ---- Standby Layout ----

export type StandbyExitGesture = 'single-tap' | 'double-tap'
export type StandbyCorner      = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type StandbyElementId = 'time' | 'weather' | 'events'

export interface StandbyWeatherFields {
  temperature: boolean
  feelsLike:   boolean
  condition:   boolean
  humidity:    boolean
  city:        boolean
}

export interface StandbyElementConfig {
  corner:  StandbyCorner
  enabled: boolean
}

export interface StandbyLayout {
  time:    StandbyElementConfig
  weather: StandbyElementConfig
  events:  StandbyElementConfig
  /** Priority order — index 0 = highest (rendered first / closest to corner edge) */
  priority:      StandbyElementId[]
  weatherFields: StandbyWeatherFields
}

// ---- New for UI redesign ----

export type AppPage = 'calendar' | 'chores' | 'meals' | 'photos' | 'lists' | 'settings'

export type ThemeMode = 'auto' | 'light' | 'dark'

export interface ListItem {
  id: string
  text: string
  checked: boolean
  createdAt: number
}

export interface AppList {
  id: string
  name: string
  items: ListItem[]
}

// ---- Google Tasks ----

export interface GTaskList {
  id: string
  title: string
  accountId: string
}

export interface GTask {
  id: string
  taskListId: string
  accountId: string
  title: string
  notes?: string
  status: 'needsAction' | 'completed'
  due?: string
  completed?: string
  updated: string
  parent?: string
  position?: string
}

// ---- Meal plan ----
// Keys: "<dayOfWeek>-<slot>" e.g. "1-breakfast" (Monday breakfast)
// dayOfWeek: 0=Sun, 1=Mon … 6=Sat
// slot: 'breakfast' | 'lunch' | 'dinner'
export type MealPlan = Record<string, string>

// ---- Settings ----

export interface AppSettings {
  accounts: GoogleAccount[]
  calendarPreferences: Record<string, CalendarPreference>
  weather: WeatherConfig
  photoFolderPath: string
  standbyTimeoutMinutes: number
  launchOnStartup: boolean
  familyName: string
  themeMode: ThemeMode
  lists: AppList[]
  mealPlan: MealPlan
  slideshow:           SlideshowSettings
  standbyLayout:       StandbyLayout
  standbyExitGesture:  StandbyExitGesture
}

export interface WeatherData {
  temp: number
  feelsLike: number
  condition: string
  conditionIcon: string
  conditionDescription: string
  humidity: number
  city: string
  fetchedAt: number
}

export interface WeatherForecastDay {
  date:                 string  // 'yyyy-MM-dd'
  dayLabel:             string  // 'Mon', 'Today', etc.
  high:                 number
  low:                  number
  conditionIcon:        string
  conditionDescription: string
}

// The typed API surface exposed to the renderer via contextBridge
export interface CalendarDockAPI {
  auth: {
    startFlow: () => Promise<{ accountId: string; email: string }>
    removeAccount: (accountId: string) => Promise<void>
    listAccounts: () => Promise<GoogleAccount[]>
    onReauthRequired: (cb: (data: { accountId: string; email: string }) => void) => void
  }
  calendar: {
    listCalendars: (accountId: string) => Promise<CalendarListItem[]>
    fetchEvents: (payload: {
      entries: Array<{ accountId: string; calendarId: string }>
      timeMin: string
      timeMax: string
    }) => Promise<CalendarEvent[]>
    createEvent: (payload: CreateEventPayload) => Promise<CalendarEvent>
  }
  settings: {
    getAll: () => Promise<AppSettings>
    setCalendarVisible: (calendarId: string, visible: boolean) => Promise<void>
    setCalendarColor: (calendarId: string, color: string) => Promise<void>
    setWeatherLocation: (location: string) => Promise<void>
    setWeatherUnits: (units: 'imperial' | 'metric') => Promise<void>
    setWeatherApiKey: (apiKey: string) => Promise<void>
    setStandbyTimeout: (minutes: number) => Promise<void>
    browseFolderDialog: () => Promise<string | null>
    setPhotoFolder: (folderPath: string) => Promise<void>
    setFamilyName: (name: string) => Promise<void>
    setThemeMode: (mode: ThemeMode) => Promise<void>
    setLaunchOnStartup: (enabled: boolean) => Promise<void>
    setMealCell: (key: string, value: string) => Promise<void>
    setSlideshowSettings: (s: SlideshowSettings) => Promise<void>
    setStandbyLayout:      (l: StandbyLayout) => Promise<void>
    setStandbyExitGesture: (g: StandbyExitGesture) => Promise<void>
  }
  lists: {
    addList: (name: string) => Promise<AppList>
    removeList: (listId: string) => Promise<void>
    addItem: (listId: string, text: string) => Promise<ListItem>
    toggleItem: (listId: string, itemId: string, checked: boolean) => Promise<void>
    removeItem: (listId: string, itemId: string) => Promise<void>
  }
  tasks: {
    listTaskLists: (accountId: string) => Promise<GTaskList[]>
    listTasks: (accountId: string, taskListId: string, showCompleted?: boolean) => Promise<GTask[]>
    createTask: (accountId: string, taskListId: string, title: string, notes?: string, due?: string) => Promise<GTask>
    setComplete: (accountId: string, taskListId: string, taskId: string, complete: boolean) => Promise<GTask>
    updateTask: (accountId: string, taskListId: string, taskId: string, patch: { title?: string; notes?: string; due?: string }) => Promise<GTask>
    deleteTask: (accountId: string, taskListId: string, taskId: string) => Promise<void>
  }
  photos: {
    getList: () => Promise<string[]>
    onListUpdated: (cb: (list: string[]) => void) => void
  }
  weather: {
    fetch: () => Promise<WeatherData>
    fetchForecast: () => Promise<WeatherForecastDay[]>
  }
}

declare global {
  interface Window {
    api: CalendarDockAPI
  }
}
