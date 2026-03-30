import Store from 'electron-store'
import { randomUUID } from 'crypto'
import type { AppSettings, AppList, ListItem, MealPlan, SlideshowSettings, StandbyLayout, StandbyExitGesture } from '../../preload/types'

type StoredSettings = AppSettings & {
  // Accounts with encrypted refresh tokens (base64 encoded, DPAPI encrypted)
  accounts: Array<{
    id: string
    email: string
    displayName: string
    photoUrl?: string
    encryptedRefreshToken: string
  }>
}

const defaults: StoredSettings = {
  accounts: [],
  calendarPreferences: {},
  weather: {
    location: '',
    units: 'imperial',
    apiKey: ''
  },
  photoFolderPath: '',
  standbyTimeoutMinutes: 10,
  launchOnStartup: false,
  familyName: 'Walker Family Calendar',
  themeMode: 'auto',
  lists: [
    { id: 'chores', name: 'Chores', items: [] }
  ],
  mealPlan: {},
  slideshow: {
    durationSec: 8,
    sortOrder: 'filename' as const,
    transition: 'fade' as const,
    transitionDurationMs: 1500
  },
  standbyLayout: {
    time:    { corner: 'top-left' as const, enabled: true },
    weather: { corner: 'top-left' as const, enabled: true },
    events:  { corner: 'top-left' as const, enabled: true },
    priority: ['time', 'weather', 'events'] as const,
    weatherFields: {
      temperature: true,
      feelsLike:   false,
      condition:   true,
      humidity:    false,
      city:        true
    }
  },
  standbyExitGesture: 'double-tap' as const
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
  }
}
