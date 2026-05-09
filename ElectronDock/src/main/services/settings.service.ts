import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { safeStorage } from 'electron'
import type { AppSettings, AppList, ListItem, MealPlan, SlideshowSettings, StandbyLayout, StandbyExitGesture, ChoresMode, ChoresList, ListsMode, ListsFilter, WyzeCamera, CalendarSwipeDirection, SidebarSlot } from '../../preload/types'

type StoredSettings = AppSettings & {
  // Accounts with encrypted refresh tokens (base64 encoded, DPAPI encrypted)
  accounts: Array<{
    id: string
    email: string
    displayName: string
    photoUrl?: string
    encryptedRefreshToken: string
  }>
  // Dropbox tokens stored encrypted — never sent to renderer
  dropboxEncryptedAccessToken:  string
  dropboxAccessTokenExpiry:     number
  dropboxEncryptedRefreshToken: string
  dropboxAccountId:             string
  // Ring refresh token stored encrypted — never sent to renderer
  ringEncryptedRefreshToken:    string
}

const defaults: StoredSettings = {
  accounts: [],
  dropboxEncryptedAccessToken:  '',
  dropboxAccessTokenExpiry:     0,
  dropboxEncryptedRefreshToken: '',
  dropboxAccountId:             '',
  calendarPreferences: {},
  calendarOrder: [],
  weather: {
    location: '',
    units: 'imperial',
    apiKey: ''
  },
  timezone: '',
  additionalTimezones: [],
  photoFolderPath: '',
  standbyTimeoutMinutes: 10,
  launchOnStartup: false,
  familyName: 'Walker Family Calendar',
  themeMode: 'auto',
  lists: [
    { id: 'chores', name: 'Chores', items: [] }
  ],
  mealPlan: {},
  calendarSwipeWeek:  'horizontal' as const,
  calendarSwipeMonth: 'horizontal' as const,
  sidebarLayout: [
    { kind: 'item', pageId: 'calendar'    },
    { kind: 'item', pageId: 'chores'      },
    { kind: 'item', pageId: 'meals'       },
    { kind: 'item', pageId: 'photos'      },
    { kind: 'item', pageId: 'lists'       },
    { kind: 'item', pageId: 'cameras'     },
    { kind: 'item', pageId: 'sprinklers'  },
    { kind: 'item', pageId: 'waterheater' },
  ] as SidebarSlot[],
  slideshow: {
    durationSec: 8,
    sortOrder: 'filename' as const,
    transition: 'fade' as const,
    transitionDurationMs: 1500
  },
  standbyLayout: {
    time:    { corner: 'top-left' as const,     enabled: true  },
    weather: { corner: 'top-left' as const,     enabled: true  },
    events:  { corner: 'top-left' as const,     enabled: true  },
    water:   { corner: 'bottom-right' as const, enabled: true  },
    priority: ['time', 'weather', 'events', 'water'] as const,
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
    }
  },
  standbyExitGesture: 'double-tap' as const,
  choresMode: 'local' as const,
  choresLists: [{ id: 'chores', name: 'Chores' }],
  listsMode: 'google' as const,
  listsFilter: 'all' as const,
  listsSelectedIds: [],
  cameras: [],
  rachioApiKey: '',
  rinnaiEmail: '',
  rinnaiPassword: '',
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
  ringEncryptedRefreshToken: '',
  ringAccountEmail:          '',
  ringSnapshotIntervalSec:   30,
}

const store = new Store<StoredSettings>({
  name: 'settings',
  defaults
})

export const settingsService = {
  getAll(): StoredSettings {
    return store.store
  },

  get<K extends keyof StoredSettings>(key: K): StoredSettings[K] {
    return store.get(key)
  },

  set<K extends keyof StoredSettings>(key: K, value: StoredSettings[K]): void {
    store.set(key, value)
  },

  setCalendarVisible(calendarId: string, visible: boolean): void {
    const prefs = store.get('calendarPreferences') ?? {}
    prefs[calendarId] = { ...(prefs[calendarId] ?? {}), visible }
    store.set('calendarPreferences', prefs)
  },

  setCalendarColor(calendarId: string, color: string): void {
    const prefs = store.get('calendarPreferences') ?? {}
    prefs[calendarId] = { ...(prefs[calendarId] ?? {}), colorOverride: color }
    store.set('calendarPreferences', prefs)
  },

  setCalendarOrder(ids: string[]): void {
    store.set('calendarOrder', ids)
  },

  setMealsFontSize(size: number): void {
    store.set('mealsFontSize', size)
  },

  setWeatherLocation(location: string): void {
    const weather = store.get('weather')
    store.set('weather', { ...weather, location })
  },

  setWeatherUnits(units: 'imperial' | 'metric'): void {
    const weather = store.get('weather')
    store.set('weather', { ...weather, units })
  },

  setWeatherApiKey(apiKey: string): void {
    const weather = store.get('weather')
    store.set('weather', { ...weather, apiKey })
  },

  setTimezone(tz: string): void {
    store.set('timezone', tz)
  },

  setAdditionalTimezones(zones: string[]): void {
    store.set('additionalTimezones', zones)
  },

  setStandbyTimeout(minutes: number): void {
    store.set('standbyTimeoutMinutes', minutes)
  },

  setPhotoFolder(folderPath: string): void {
    store.set('photoFolderPath', folderPath)
  },

  setFamilyName(name: string): void {
    store.set('familyName', name)
  },

  setThemeMode(mode: 'auto' | 'light' | 'dark'): void {
    store.set('themeMode', mode)
  },

  setLaunchOnStartup(enabled: boolean): void {
    store.set('launchOnStartup', enabled)
  },

  // ---- Meal plan ----

  setMealCell(key: string, value: string): void {
    const plan = (store.get('mealPlan') ?? {}) as MealPlan
    if (value.trim()) {
      plan[key] = value.trim()
    } else {
      delete plan[key]
    }
    store.set('mealPlan', plan)
  },

  // ---- Lists ----

  getLists(): AppList[] {
    return store.get('lists') ?? []
  },

  addList(name: string): AppList {
    const lists = this.getLists()
    const newList: AppList = { id: randomUUID(), name, items: [] }
    store.set('lists', [...lists, newList])
    return newList
  },

  removeList(listId: string): void {
    const lists = this.getLists().filter((l) => l.id !== listId)
    store.set('lists', lists)
  },

  addItem(listId: string, text: string): ListItem {
    const lists = this.getLists()
    const item: ListItem = { id: randomUUID(), text, checked: false, createdAt: Date.now() }
    const updated = lists.map((l) =>
      l.id === listId ? { ...l, items: [...l.items, item] } : l
    )
    store.set('lists', updated)
    return item
  },

  toggleItem(listId: string, itemId: string, checked: boolean): void {
    const lists = this.getLists()
    const updated = lists.map((l) =>
      l.id === listId
        ? { ...l, items: l.items.map((it) => (it.id === itemId ? { ...it, checked } : it)) }
        : l
    )
    store.set('lists', updated)
  },

  removeItem(listId: string, itemId: string): void {
    const lists = this.getLists()
    const updated = lists.map((l) =>
      l.id === listId ? { ...l, items: l.items.filter((it) => it.id !== itemId) } : l
    )
    store.set('lists', updated)
  },

  setCalendarSwipe(view: 'week' | 'month', direction: CalendarSwipeDirection): void {
    store.set(view === 'week' ? 'calendarSwipeWeek' : 'calendarSwipeMonth', direction)
  },

  setSidebarLayout(layout: SidebarSlot[]): void {
    store.set('sidebarLayout', layout)
  },

  setSlideshowSettings(s: SlideshowSettings): void {
    store.set('slideshow', s)
  },

  setStandbyLayout(l: StandbyLayout): void {
    store.set('standbyLayout', l)
  },

  setStandbyExitGesture(g: StandbyExitGesture): void {
    store.set('standbyExitGesture', g)
  },

  // ---- Accounts ----

  addAccount(account: StoredSettings['accounts'][0]): void {
    const accounts = store.get('accounts') ?? []
    const existing = accounts.findIndex((a) => a.id === account.id)
    if (existing >= 0) {
      accounts[existing] = account
    } else {
      accounts.push(account)
    }
    store.set('accounts', accounts)
  },

  removeAccount(accountId: string): void {
    const accounts = (store.get('accounts') ?? []).filter((a) => a.id !== accountId)
    store.set('accounts', accounts)
  },

  // ---- Chores ----

  setChoresMode(mode: ChoresMode): void {
    store.set('choresMode', mode)
  },

  setChoresLists(lists: ChoresList[]): void {
    store.set('choresLists', lists)
  },

  // ---- Lists page ----

  setListsMode(mode: ListsMode): void {
    store.set('listsMode', mode)
  },

  setListsFilter(filter: ListsFilter): void {
    store.set('listsFilter', filter)
  },

  setListsSelectedIds(ids: string[]): void {
    store.set('listsSelectedIds', ids)
  },

  // ---- Cameras / integrations ----

  setCameras(cameras: WyzeCamera[]): void {
    store.set('cameras', cameras)
  },

  setRachioApiKey(key: string): void {
    store.set('rachioApiKey', key)
  },

  setRinnaiCredentials(email: string, password: string): void {
    store.set('rinnaiEmail', email)
    store.set('rinnaiPassword', password)
  },

  // ---- Dropbox ----

  setDropboxTokens(accessToken: string, refreshToken: string, accountId: string, expiry = 0): void {
    // Always use safeStorage round-trip; it falls back to base64 when no
    // OS keyring is available (Linux autologin), which is still symmetric.
    // The previous canEncrypt branch caused asymmetric set/get on Linux.
    store.set('dropboxEncryptedAccessToken',  safeStorage.encryptString(accessToken).toString('base64'))
    store.set('dropboxEncryptedRefreshToken', safeStorage.encryptString(refreshToken).toString('base64'))
    store.set('dropboxAccessTokenExpiry', expiry)
    store.set('dropboxAccountId', accountId)
  },

  getDropboxTokens(): { accessToken: string; refreshToken: string; accountId: string; accessTokenExpiry: number } | null {
    const encAT = store.get('dropboxEncryptedAccessToken')
    const encRT = store.get('dropboxEncryptedRefreshToken')
    if (!encAT || !encRT) return null
    try {
      const accessToken  = safeStorage.decryptString(Buffer.from(encAT, 'base64'))
      const refreshToken = safeStorage.decryptString(Buffer.from(encRT, 'base64'))
      return {
        accessToken,
        refreshToken,
        accountId:        store.get('dropboxAccountId') as string,
        accessTokenExpiry: store.get('dropboxAccessTokenExpiry') as number,
      }
    } catch {
      return null
    }
  },

  clearDropboxTokens(): void {
    store.set('dropboxEncryptedAccessToken', '')
    store.set('dropboxEncryptedRefreshToken', '')
    store.set('dropboxAccessTokenExpiry', 0)
    store.set('dropboxAccountId', '')
  },

  setDropboxAppKey(key: string): void         { store.set('dropboxAppKey', key) },
  setDropboxAccountEmail(email: string): void { store.set('dropboxAccountEmail', email) },
  setDropboxEnabled(enabled: boolean): void   { store.set('dropboxEnabled', enabled) },
  setDropboxLastSync(ts: number): void        { store.set('dropboxLastSync', ts) },
  setDropboxFolderPath(path: string): void    { store.set('dropboxFolderPath', path) },
  setDropboxPhotoCount(count: number): void   { store.set('dropboxPhotoCount', count) },

  setMealsGoogleTaskList(accountId: string, taskListId: string): void {
    store.set('mealsGoogleAccountId',  accountId)
    store.set('mealsGoogleTaskListId', taskListId)
  },

  setFridgeGoogleTaskList(accountId: string, taskListId: string): void {
    store.set('fridgeGoogleAccountId',  accountId)
    store.set('fridgeGoogleTaskListId', taskListId)
  },

  setCameraWakeEnabled(enabled: boolean): void {
    store.set('cameraWakeEnabled', enabled)
  },

  setDeepSleepSchedule(start: string, end: string): void {
    store.set('deepSleepStart', start)
    store.set('deepSleepEnd',   end)
  },

  setCameraWakeCalibration(background: number[], threshold: number): void {
    store.set('cameraWakeBackground', background)
    store.set('cameraWakeThreshold',  threshold)
  },

  setCameraWakeThreshold(threshold: number): void {
    store.set('cameraWakeThreshold', threshold)
  },

  setPassiveDaySettings(standbyMinutes: number, backlightOffMinutes: number): void {
    store.set('passiveStandbyMinutes',      standbyMinutes)
    store.set('passiveBacklightOffMinutes', backlightOffMinutes)
  },

  setActiveDaySettings(standbyMinutes: number, sustainSeconds: number, holdMinutes: number): void {
    store.set('activeStandbyMinutes',  standbyMinutes)
    store.set('motionSustainSeconds',  sustainSeconds)
    store.set('activeHoldMinutes',     holdMinutes)
  },

  setWyzeBridgeConfig(email: string, password: string, host: string, apiId: string, apiKey: string): void {
    store.set('wyzeBridgeEmail',    email)
    store.set('wyzeBridgePassword', password)
    store.set('wyzeBridgeHost',     host)
    store.set('wyzeBridgeApiId',    apiId)
    store.set('wyzeBridgeApiKey',   apiKey)
  },

  // ---- Ring ----

  setRingRefreshToken(refreshToken: string): void {
    store.set('ringEncryptedRefreshToken', safeStorage.encryptString(refreshToken).toString('base64'))
  },

  getRingRefreshToken(): string {
    const enc = store.get('ringEncryptedRefreshToken') as string
    if (!enc) return ''
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch {
      return ''
    }
  },

  clearRingRefreshToken(): void {
    store.set('ringEncryptedRefreshToken', '')
  },

  setRingAccountEmail(email: string): void {
    store.set('ringAccountEmail', email)
  },

  setRingSnapshotInterval(seconds: number): void {
    store.set('ringSnapshotIntervalSec', Math.max(5, Math.floor(seconds)))
  },
}
