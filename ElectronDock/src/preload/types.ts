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

// ---- Calendar view settings ----

export type CalendarSwipeDirection = 'horizontal' | 'vertical' | 'both'

// ---- Sidebar layout ----

export type SidebarSlot =
  | { kind: 'item';  pageId: AppPage }
  | { kind: 'group'; id: string; items: AppPage[] }

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
export type StandbyElementId = 'time' | 'weather' | 'events' | 'water'

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

export interface StandbyWaterFields {
  timeRemaining:          boolean
  domesticTemperature:    boolean
  recircTemperature:      boolean
  outletTemperature:      boolean
  inletTemperature:       boolean
}

export interface StandbyLayout {
  time:    StandbyElementConfig
  weather: StandbyElementConfig
  events:  StandbyElementConfig
  water:   StandbyElementConfig
  /** Priority order — index 0 = highest (rendered first / closest to corner edge) */
  priority:      StandbyElementId[]
  weatherFields: StandbyWeatherFields
  waterFields:   StandbyWaterFields
}

// ---- New for UI redesign ----

export type AppPage = 'calendar' | 'chores' | 'meals' | 'photos' | 'lists' | 'settings' | 'cameras' | 'sprinklers' | 'waterheater'

export type ChoresMode = 'local' | 'google'
export type ListsMode  = 'local' | 'google'
export type ListsFilter = 'all' | 'selected'

export interface ChoresList {
  id: string
  name: string
  googleTaskListId?: string
  googleAccountId?: string
}

export type BridgeStatus = 'running' | 'stopped' | 'not-found' | 'docker-unavailable'

// ---- Wyze Cameras ----

export interface WyzeCamera {
  id: string
  name: string
  rtspUrl: string
}

// ---- Ring ----

export interface RingCameraInfo {
  /** Ring's numeric device id, stringified */
  id: string
  name: string
  /** e.g. 'doorbell_v3', 'stickup_cam_lunar' — useful for an icon hint */
  deviceType: string
  hasBattery: boolean
  /** 0–100 if known */
  batteryLevel: number | null
  /** True when the camera is reachable on Ring's network */
  online: boolean
}

export type RingConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'needs-2fa'
  | 'connected'
  | 'error'

export interface RingStatus {
  state: RingConnectionState
  email: string
  /** Last error message, if state is 'error' */
  errorMessage: string
  /** When state is 'needs-2fa', the prompt sent by Ring (e.g. "Code sent to ***1234") */
  twoFactorPrompt: string
}

// ---- Rachio ----

export interface RachioZone {
  id: string
  zoneNumber: number
  name: string
  enabled: boolean
}

export interface RachioSchedule {
  id: string
  name: string
  enabled: boolean
  startTimeMs: number      // ms since midnight (local time)
  totalDurationSec: number
  nextRunDate: number | null // Unix ms timestamp
  lastRunDate: number | null // Unix ms timestamp
  type: string              // e.g. 'FIXED_SCHEDULE', 'FLEX_DAILY'
  summary: string           // e.g. 'Mon, Wed, Fri'
}

export interface RachioDevice {
  id: string
  name: string
  status: string
  zones: RachioZone[]
  activeZoneId?: string
}

// ---- Rinnai ----

export interface RinnaiDevice {
  thingName: string
  name: string
  setTemp: number
  isHeating: boolean
  recirculationEnabled: boolean
  domesticTemperature?: number
  recirculationTemperature?: number
  outletTemperature?: number
  inletTemperature?: number
}

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
  calendarOrder: string[]
  weather: WeatherConfig
  /** IANA timezone (e.g. 'America/New_York'). Empty string = system local. */
  timezone: string
  /** Extra clocks shown when the user taps the header time. */
  additionalTimezones: string[]
  photoFolderPath: string
  standbyTimeoutMinutes: number
  launchOnStartup: boolean
  familyName: string
  themeMode: ThemeMode
  lists: AppList[]
  mealPlan: MealPlan
  // Calendar view
  calendarSwipeWeek:   CalendarSwipeDirection
  calendarSwipeMonth:  CalendarSwipeDirection
  // Sidebar nav layout (drag-to-reorder, drop-to-group)
  sidebarLayout:       SidebarSlot[]
  slideshow:           SlideshowSettings
  standbyLayout:       StandbyLayout
  standbyExitGesture:  StandbyExitGesture
  choresMode:       ChoresMode
  choresLists:      ChoresList[]
  listsMode:        ListsMode
  listsFilter:      ListsFilter
  listsSelectedIds: string[]  // "<accountId>::<taskListId>"
  cameras:          WyzeCamera[]
  rachioApiKey:     string
  rinnaiEmail:      string
  rinnaiPassword:   string
  // Meals Google Tasks link (optional)
  mealsGoogleAccountId:  string
  mealsGoogleTaskListId: string
  mealsFontSize: number
  // Fridge panels — both share one optional Google Tasks list
  fridgeGoogleAccountId:  string
  fridgeGoogleTaskListId: string
  // Dropbox (tokens stored encrypted in main process only — not in this object)
  dropboxAppKey:       string
  dropboxFolderPath:   string
  dropboxPhotoCount:   number
  dropboxEnabled:      boolean
  dropboxLastSync:     number
  dropboxAccountEmail: string
  // Camera wake
  cameraWakeEnabled:          boolean
  deepSleepStart:             string    // "HH:MM", default "21:00" — when deep sleep begins
  deepSleepEnd:               string    // "HH:MM", default "06:00" — when deep sleep ends
  cameraWakeThreshold:        number    // 0.0–1.0, set during calibration
  cameraWakePixelNoise:       number    // per-pixel diff floor 0–255, default 20
  cameraWakeBackground:       number[] | null  // 19,200 grayscale values (160×120), null = not calibrated
  passiveStandbyMinutes:      number   // standby timeout in passive mode, default 5
  passiveBacklightOffMinutes: number   // minutes in standby before backlight off (passive), default 15
  activeStandbyMinutes:       number   // standby timeout in active mode, default 30
  motionSustainSeconds:       number   // seconds of sustained motion to switch to active, default 6
  activeHoldMinutes:          number   // minutes of no sustained motion before returning to passive, default 20
  // Wyze Bridge
  wyzeBridgeEmail:    string
  wyzeBridgePassword: string
  wyzeBridgeHost:     string
  wyzeBridgeApiId:    string
  wyzeBridgeApiKey:   string
  // Ring (refresh token stored encrypted in main process — not in this object)
  ringAccountEmail:        string
  /** How often (seconds) to refresh each Ring snapshot. Min 5. */
  ringSnapshotIntervalSec: number
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
    setCalendarOrder: (ids: string[]) => Promise<void>
    setMealsFontSize: (size: number) => Promise<void>
    setWeatherLocation: (location: string) => Promise<void>
    setWeatherUnits: (units: 'imperial' | 'metric') => Promise<void>
    setWeatherApiKey: (apiKey: string) => Promise<void>
    setTimezone: (tz: string) => Promise<void>
    setAdditionalTimezones: (zones: string[]) => Promise<void>
    setStandbyTimeout: (minutes: number) => Promise<void>
    browseFolderDialog: () => Promise<string | null>
    setPhotoFolder: (folderPath: string) => Promise<void>
    setFamilyName: (name: string) => Promise<void>
    setThemeMode: (mode: ThemeMode) => Promise<void>
    setLaunchOnStartup: (enabled: boolean) => Promise<void>
    setMealCell: (key: string, value: string) => Promise<void>
    setCalendarSwipe: (view: 'week' | 'month', direction: CalendarSwipeDirection) => Promise<void>
    setSidebarLayout: (layout: SidebarSlot[]) => Promise<void>
    setSlideshowSettings: (s: SlideshowSettings) => Promise<void>
    setStandbyLayout:      (l: StandbyLayout) => Promise<void>
    setStandbyExitGesture: (g: StandbyExitGesture) => Promise<void>
    setChoresMode:       (mode: ChoresMode) => Promise<void>
    setChoresLists:      (lists: ChoresList[]) => Promise<void>
    setListsMode:        (mode: ListsMode) => Promise<void>
    setListsFilter:      (filter: ListsFilter) => Promise<void>
    setListsSelectedIds: (ids: string[]) => Promise<void>
    setCameras:          (cameras: WyzeCamera[]) => Promise<void>
    setRachioApiKey:     (key: string) => Promise<void>
    setRinnaiCredentials:(email: string, password: string) => Promise<void>
    setMealsGoogleTaskList:  (accountId: string, taskListId: string) => Promise<void>
    setFridgeGoogleTaskList: (accountId: string, taskListId: string) => Promise<void>
    setCameraWakeEnabled:    (enabled: boolean) => Promise<void>
    setDeepSleepSchedule:   (start: string, end: string) => Promise<void>
    setCameraWakeCalibration:(background: number[], threshold: number) => Promise<void>
    setCameraWakeThreshold:  (threshold: number) => Promise<void>
    setPassiveDaySettings:   (standbyMinutes: number, backlightOffMinutes: number) => Promise<void>
    setActiveDaySettings:    (standbyMinutes: number, sustainSeconds: number, holdMinutes: number) => Promise<void>
    setWyzeBridgeConfig: (email: string, password: string, host: string, apiId: string, apiKey: string) => Promise<void>
    setRingSnapshotInterval: (seconds: number) => Promise<void>
  }
  dropbox: {
    connect:      (appKey: string) => Promise<{ email: string }>
    disconnect:   () => Promise<void>
    syncNow:      () => Promise<void>
    getStatus:    () => Promise<{ connected: boolean; email: string; lastSync: number; isSyncing: boolean }>
    setConfig:    (cfg: { folderPath?: string; photoCount?: number; enabled?: boolean }) => Promise<void>
    onProgress:   (cb: (pct: number, status: string) => void) => void
  }
  cameras: {
    startStream:    (cameraId: string) => Promise<string>   // returns local MJPEG URL
    stopStream:     (cameraId: string) => Promise<void>
    stopAllStreams:  () => Promise<void>
    bridgeStatus:   () => Promise<BridgeStatus>
    bridgeStart:    () => Promise<void>
    bridgeStop:     () => Promise<void>
    bridgeRemove:   () => Promise<void>
  }
  rachio: {
    getDevices:      () => Promise<RachioDevice[]>
    startZone:       (zoneId: string, durationSec: number) => Promise<void>
    stopAll:         (deviceId: string) => Promise<void>
    getSchedules:    (deviceId: string) => Promise<RachioSchedule[]>
    enableSchedule:  (scheduleId: string) => Promise<void>
    disableSchedule: (scheduleId: string) => Promise<void>
    skipSchedule:    (scheduleId: string) => Promise<void>
  }
  rinnai: {
    getDevices:       () => Promise<RinnaiDevice[]>
    setTemperature:   (thingName: string, temp: number) => Promise<void>
    setRecirculation: (thingName: string, enabled: boolean, durationMinutes?: number) => Promise<void>
  }
  ring: {
    /** Begin login. If 2FA is required, status returns 'needs-2fa' and Ring sends a code. */
    connect:     (email: string, password: string) => Promise<RingStatus>
    /** Submit the 2FA code Ring sent. Resolves to 'connected' or 'error'. */
    submit2fa:   (code: string) => Promise<RingStatus>
    disconnect:  () => Promise<void>
    getStatus:   () => Promise<RingStatus>
    listCameras: () => Promise<RingCameraInfo[]>
    /** URL of an HTTP endpoint that returns the latest snapshot for this camera as a JPEG. */
    snapshotUrl: (cameraId: string) => Promise<string>
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
    /** Signal that the slideshow advanced to the next photo. */
    advance: () => Promise<void>
    /** Pause / resume background downloads (pause while user is active). */
    setPaused: (paused: boolean) => Promise<void>
    /** Dawn signal — end of deep sleep. Refreshes Dropbox index + tops up cache. */
    wakeFromDeepSleep: () => Promise<void>
  }
  weather: {
    fetch: () => Promise<WeatherData>
    fetchForecast: () => Promise<WeatherForecastDay[]>
  }
  system: {
    setDisplayPower:  (on: boolean) => Promise<void>
    enterFullscreen: () => Promise<void>
  }
  updates: {
    check: () => Promise<UpdateCheckResult>
    install: () => Promise<void>
    getSchedule: () => Promise<UpdateSchedule>
    setSchedule: (schedule: UpdateSchedule) => Promise<UpdateSchedule>
    onProgress: (cb: (p: UpdateProgress) => void) => void
  }
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion:  string | null
  hasUpdate:      boolean
  debUrl:         string | null
  publishedAt:    string | null
  unavailableReason?: string
}

export interface UpdateSchedule {
  enabled: boolean
  /** 24h "HH:MM" — local time */
  time: string
}

export type UpdateProgress =
  | { phase: 'downloading'; percent: number }
  | { phase: 'installing' }
  | { phase: 'restarting' }
  | { phase: 'error'; message: string }

declare global {
  interface Window {
    api: CalendarDockAPI
  }
}
