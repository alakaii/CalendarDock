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
  /** Per-calendar color override for light theme. Empty/missing = use calendar's default color. */
  colorOverrideLight?: string
  /** Per-calendar color override for dark theme. */
  colorOverrideDark?:  string
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
/**
 * 'fit'   = letterbox the whole photo onto a blurred copy of itself.
 * 'focus' = fill the screen, anchor on detected face / salient region; the
 *           slider keeps the anchor inside `focusSafeZonePercent` of the frame.
 */
export type SlideshowCropMode = 'fit' | 'focus'

export interface SlideshowSettings {
  /** Seconds each slide is shown (3–30) */
  durationSec: number
  /** How photos are ordered */
  sortOrder: SlideshowSortOrder
  /** Visual transition between slides */
  transition: SlideshowTransition
  /** Transition animation duration in milliseconds (500–3000) */
  transitionDurationMs: number
  /** How off-aspect photos are framed */
  cropMode: SlideshowCropMode
  /** Focus-mode safe zone — the focal point must stay within this % of the frame (30–100). */
  focusSafeZonePercent: number
}

// ---- Standby Layout ----

export type StandbyExitGesture = 'single-tap' | 'double-tap'
/**
 * Anchor positions on the standby canvas. Originally just the four corners
 * (hence the name), now extended with the four mid-edge anchors so widgets
 * can sit centered along any side. The name is kept for backwards compat
 * with the values already persisted in electron-store.
 */
export type StandbyCorner =
  | 'top-left'    | 'top-center'    | 'top-right'
  | 'left-center'                   | 'right-center'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
export type StandbyElementId = 'time' | 'weather' | 'events' | 'water' | 'tesla'

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

export interface StandbyTeslaFields {
  /** State-of-charge percentage (always shown if widget is enabled). */
  batteryPercent: boolean
  /** Compact arrow flow: solar/grid/battery → home (or solar → battery, etc.). */
  powerFlow:      boolean
  /** Highlight when the grid is down or in transition. Hidden when 'up'. */
  gridStatus:     boolean
}

export interface StandbyLayout {
  time:    StandbyElementConfig
  weather: StandbyElementConfig
  events:  StandbyElementConfig
  water:   StandbyElementConfig
  tesla:   StandbyElementConfig
  /** Priority order — index 0 = highest (rendered first / closest to corner edge) */
  priority:      StandbyElementId[]
  weatherFields: StandbyWeatherFields
  waterFields:   StandbyWaterFields
  teslaFields:   StandbyTeslaFields
}

// ---- New for UI redesign ----

export type AppPage = 'calendar' | 'chores' | 'meals' | 'photos' | 'lists' | 'settings' | 'cameras' | 'sprinklers' | 'waterheater' | 'tesla'

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

// ---- Tesla Powerwall ----

export interface TeslaEnergyStatus {
  /** Solar production, kW. Always >= 0. */
  solarKw: number
  /** Home/load consumption, kW. Always >= 0. */
  loadKw: number
  /**
   * Battery instantaneous power, kW.
   * Positive = discharging (powering the home).
   * Negative = charging (storing energy).
   */
  batteryKw: number
  /**
   * Grid instantaneous power, kW.
   * Positive = importing from grid.
   * Negative = exporting to grid.
   */
  gridKw: number
  /** Battery state of charge, 0–100 */
  percentage: number
  /** Number of Powerwall units in the site */
  batteryCount: number
  gridStatus: 'up' | 'down' | 'transition'
}

/** Lightweight connection summary for the Settings panel — no network call. */
export interface TeslaConnectionStatus {
  /** True iff a refresh token is persisted. Site info may still be empty until first /products call. */
  connected: boolean
  /** Friendly site name from /products (e.g. "My Home"). Empty until first poll resolves. */
  siteName: string
  /** ms epoch the OAuth flow last completed. 0 if never. */
  connectedAt: number
}

/** Result of a "Test connection" against the local Powerwall gateway. */
export interface TeslaLocalTestResult {
  ok: boolean
  /** Site name from config.json on success (may be empty if unavailable). */
  siteName: string
  /** Human-readable failure reason when ok is false. */
  error: string
}

/**
 * One Tesla vehicle visible on this account, with the user's choice of whether
 * it should appear on this dock. Populated from /products on connect/refresh;
 * the `enabled` flag is preserved across refreshes so the user's filter sticks
 * (extended-family vehicles that share the account but live elsewhere can be
 * toggled off without code changes).
 */
export interface TeslaVehicleConfig {
  /** Vehicle id_s — stable, what the Fleet API expects in URL paths. */
  id: string
  vin: string
  /** User's name for the car in Tesla (e.g. "Epona"). */
  displayName: string
  /** OWNER vs DRIVER — useful so the picker can hint why a car is on the account. */
  accessType: 'OWNER' | 'DRIVER' | string
  /** When false, this vehicle is hidden from CalendarDock's tiles. */
  enabled: boolean
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

// ---- iCloud Shared Albums ----

export interface IcloudAlbumStatus {
  /** The configured URL (or bare token) for this album. */
  url: string
  /** Parsed album token (the URL fragment). */
  token: string
  /** Human-readable album name (Apple's streamName). '' until the album has synced. */
  name: string
  /** Photos currently cached from this album. */
  photoCount: number
  /** Last sync error for this album ('' = last sync succeeded). */
  error: string
}

export interface IcloudStatus {
  enabled: boolean
  albums: IcloudAlbumStatus[]
  /** ms epoch of the last completed sync attempt. 0 = never. */
  lastSync: number
  /** Total photos cached across all albums. */
  photoCount: number
  /** Aggregate error message from the last sync ('' when all albums succeeded). */
  lastError: string
  isSyncing: boolean
}

export interface IcloudSyncResult {
  ok: boolean
  count: number
  error: string
}

/** Result of a unified "Resync All Photos" run across every source. */
export interface PhotoResyncResult {
  dropbox: {
    /** True when Dropbox isn't the active source / has no folders — nothing was done. */
    skipped: boolean
    ok: boolean
    /** Total photos found in the Dropbox index this run. */
    indexed: number
    /** Photos actually on disk after the refill. */
    cached: number
    error: string
  }
  icloud: {
    /** True when iCloud albums are disabled / none configured — nothing was done. */
    skipped: boolean
    ok: boolean
    /** Total photos cached across all albums. */
    count: number
    error: string
  }
}

// ---- Background art ----
export type ArtMode = 'border' | 'fullscreen'
export type ArtScaleMode = 'fill' | 'fit' | 'stretch'

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
  // Background art mode. 'border' = header/sidebar strip images (default,
  // unchanged behavior). 'fullscreen' = full-bleed art layer behind the UI.
  artMode: ArtMode
  /** Calendar-panel opacity in fullscreen mode, 20–100. Ignored in border mode. */
  uiOpacity: number
  /** How the fullscreen art is scaled onto the 1920×1080 canvas. */
  artScaleMode: ArtScaleMode
  /** Nearest-neighbor scaling for crisp pixel art. */
  artPixelated: boolean
  /** Rounded backdrop chips behind sidebar nav items + header text (fullscreen art only). */
  artIconFill: boolean
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
  // Tesla Powerwall — Fleet API (cloud). Local-gateway path was retired
  // (PW3 firmware locks /tedapi/ to the Powerwall's own SSID, and the
  // legacy /api/login/Basic credential convention failed on this install).
  // Client id/secret come from .env via credentials-bootstrap; the refresh
  // token (encrypted) is set after the in-app OAuth flow.
  teslaFleetClientId:     string
  teslaFleetClientSecret: string
  teslaFleetRegion:       'na' | 'eu'
  /** Discovered & cached from /products on first call after auth. */
  teslaEnergySiteId: string
  /** Site display name from /products (e.g. "My Home"). */
  teslaSiteName: string
  /** ms epoch the OAuth flow last completed. 0 = not connected. */
  teslaConnectedAt: number
  /**
   * Vehicles visible on the account from /products. Order is the order Tesla
   * returned them. The `enabled` flag is preserved across refreshes so the
   * user's filter (e.g. excluding a family-shared car) sticks.
   */
  teslaVehicles: TeslaVehicleConfig[]
  // Tesla Powerwall — connection mode.
  //   'fleet' = Tesla cloud Fleet API (works anywhere with internet).
  //   'local' = direct TEDAPI over the Powerwall's own Wi-Fi (192.168.91.1).
  //             Only works when this machine is associated to the TeslaPW_… AP.
  teslaConnectionMode: 'fleet' | 'local'
  /** Gateway IP/host for direct connect. Default '192.168.91.1'. */
  teslaGatewayHost: string
  /**
   * True once a Gateway Wi-Fi password has been saved. The password itself is
   * encrypted and lives only in the main process — this flag lets the renderer
   * gate the tile in local mode without exposing the secret.
   */
  teslaGatewayConfigured: boolean
  // Meals Google Tasks link (optional)
  mealsGoogleAccountId:  string
  mealsGoogleTaskListId: string
  mealsFontSize: number
  // Fridge panels — both share one optional Google Tasks list
  fridgeGoogleAccountId:  string
  fridgeGoogleTaskListId: string
  // Dropbox (tokens stored encrypted in main process only — not in this object)
  dropboxAppKey:       string
  /**
   * Dropbox folders to pull photos from. The photo index is the deduped union
   * of a recursive listing of each. Multiple entries are needed because
   * recursive list_folder does NOT follow Dropbox shortcut links, so an album
   * of shortcuts must be replaced by its real target folders.
   */
  dropboxFolderPaths:  string[]
  dropboxPhotoCount:   number
  dropboxEnabled:      boolean
  dropboxLastSync:     number
  dropboxAccountEmail: string
  // iCloud Shared Albums (public links). Photos from every listed album are
  // pulled into a local cache and mixed into the same slideshow pool as
  // Dropbox photos. Sync bookkeeping (last sync, counts, errors) lives in the
  // main process — not in this object.
  /** Full shared-album URLs (https://www.icloud.com/sharedalbum/#TOKEN) or bare tokens. */
  icloudAlbumUrls:     string[]
  icloudPhotosEnabled: boolean
  // Camera wake
  cameraWakeEnabled:          boolean
  deepSleepStart:             string    // "HH:MM", default "21:00" — when deep sleep begins
  deepSleepEnd:               string    // "HH:MM", default "06:00" — when deep sleep ends
  cameraWakeThreshold:        number    // 0.0–1.0, set during calibration
  cameraWakePixelNoise:       number    // per-pixel diff floor 0–255, default 20
  cameraWakeBackground:       number[] | null  // 19,200 grayscale values (160×120), null = not calibrated
  passiveBacklightOffMinutes: number   // minutes the room must be empty (in standby) before backlight off, default 15
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
    /** Set or clear (color = '') a per-calendar color override for the given theme mode. */
    setCalendarColorOverride: (calendarId: string, mode: 'light' | 'dark', color: string) => Promise<void>
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
    setArtMode: (mode: ArtMode) => Promise<void>
    setUiOpacity: (opacity: number) => Promise<void>
    setArtScaleMode: (mode: ArtScaleMode) => Promise<void>
    setArtPixelated: (pixelated: boolean) => Promise<void>
    setArtIconFill: (fill: boolean) => Promise<void>
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
    setPassiveDaySettings:   (backlightOffMinutes: number) => Promise<void>
    setActiveDaySettings:    (sustainSeconds: number, holdMinutes: number) => Promise<void>
    setWyzeBridgeConfig: (email: string, password: string, host: string, apiId: string, apiKey: string) => Promise<void>
    setRingSnapshotInterval: (seconds: number) => Promise<void>
    setIcloudAlbumUrls: (urls: string[]) => Promise<void>
    setIcloudPhotosEnabled: (enabled: boolean) => Promise<void>
  }
  art: {
    /** Serving URL (cdphoto://art/…) of the current fullscreen art, or null. */
    getFullscreen:   () => Promise<string | null>
    /** Write uploaded image bytes as the fullscreen art; returns its serving URL. */
    setFullscreen:   (bytes: Uint8Array, ext: string) => Promise<string | null>
    /** Remove any stored fullscreen art file. */
    clearFullscreen: () => Promise<void>
  }
  dropbox: {
    connect:      (appKey: string) => Promise<{ email: string }>
    disconnect:   () => Promise<void>
    syncNow:      () => Promise<void>
    getStatus:    () => Promise<{ connected: boolean; email: string; lastSync: number; isSyncing: boolean }>
    setConfig:    (cfg: { folderPaths?: string[]; photoCount?: number; enabled?: boolean }) => Promise<void>
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
  tesla: {
    getStatus:        () => Promise<TeslaEnergyStatus>
    /** Kicks off the Fleet API OAuth flow on a localhost loopback. Resolves with site info. */
    connect:          () => Promise<TeslaConnectionStatus>
    /** Clears the persisted refresh token + cached site id. */
    disconnect:       () => Promise<void>
    /** Lightweight status for the Settings panel — no network call. */
    getConnectionStatus: () => Promise<TeslaConnectionStatus>
    /** Vehicles visible on the account, with persisted enable/disable flags. */
    listVehicles:     () => Promise<TeslaVehicleConfig[]>
    /** Toggle whether a single vehicle is shown on this dock. Returns the updated list. */
    setVehicleEnabled:(id: string, enabled: boolean) => Promise<TeslaVehicleConfig[]>
    /** Force a re-fetch of /products. Use after adding a new car to the account. */
    refreshProducts:  () => Promise<TeslaVehicleConfig[]>
    /** Switch between 'fleet' (cloud) and 'local' (direct Wi-Fi TEDAPI). */
    setConnectionMode:   (mode: 'fleet' | 'local') => Promise<void>
    /** Save the local gateway host + Wi-Fi password (password encrypted in main). */
    setGatewayConfig:    (host: string, password: string) => Promise<void>
    /** Clear the saved local gateway credentials. */
    clearGatewayConfig:  () => Promise<void>
    /** Try a live local read; resolves with the site name on success. */
    testLocalConnection: () => Promise<TeslaLocalTestResult>
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
    /** Pull all configured iCloud Shared Albums now and merge their photos into the pool. */
    syncIcloud: () => Promise<IcloudSyncResult>
    /** Current iCloud sync status (per-album counts/errors, last sync). */
    getIcloudStatus: () => Promise<IcloudStatus>
    /** Re-check + re-index + refill every configured photo source (Dropbox + iCloud) at once. */
    resyncAll: () => Promise<PhotoResyncResult>
  }
  weather: {
    fetch: () => Promise<WeatherData>
    fetchForecast: () => Promise<WeatherForecastDay[]>
  }
  system: {
    setDisplayPower:  (on: boolean) => Promise<void>
    enterFullscreen: () => Promise<void>
  }
  log: {
    forward: (level: 'error' | 'warn', args: string[]) => Promise<void>
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
