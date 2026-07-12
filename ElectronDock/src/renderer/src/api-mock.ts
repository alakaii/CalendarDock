/**
 * Browser-mode mock for window.api (Electron IPC).
 * Used when running in browser preview / Vite dev server without Electron.
 */
import type { CalendarDockAPI, AppList, ListItem, GTaskList, GTask, MealPlan } from '../../preload/types'

const noop = async () => {}

function uuid() {
  return Math.random().toString(36).slice(2)
}

// In-memory state for browser preview
let _lists: AppList[] = [
  { id: 'chores', name: 'Chores', items: [] },
]

let _mealPlan: MealPlan = {}

// Mock Google task lists
const _taskLists: GTaskList[] = []
let _tasks: GTask[] = []

const mock: CalendarDockAPI = {
  auth: {
    startFlow: async () => ({ accountId: '', email: '' }),
    removeAccount: noop,
    listAccounts: async () => [],
    onReauthRequired: () => {}
  },
  calendar: {
    listCalendars: async () => [],
    fetchEvents: async () => [],
    createEvent: async () => { throw new Error('Not available in browser preview') }
  },
  settings: {
    getAll: async () => ({
      accounts: [],
      calendarPreferences: {},
      weather: { location: 'New York', units: 'imperial', apiKey: '' },
      photoFolderPath: '',
      standbyTimeoutMinutes: 10,
      launchOnStartup: false,
      familyName: 'Smith',
      themeMode: 'auto',
      lists: _lists,
      mealPlan: _mealPlan,
      slideshow: { durationSec: 8, sortOrder: 'filename' as const, transition: 'fade' as const, transitionDurationMs: 1500 },
      standbyLayout: {
        time:    { corner: 'top-left' as const, enabled: true },
        weather: { corner: 'top-left' as const, enabled: true },
        events:  { corner: 'top-left' as const, enabled: true },
        priority: ['time', 'weather', 'events'] as const,
        weatherFields: { temperature: true, feelsLike: false, condition: true, humidity: false, city: true }
      },
      standbyExitGesture: 'double-tap' as const
    }),
    setCalendarVisible: noop,
    setCalendarColor: noop,
    setWeatherLocation: noop,
    setWeatherUnits: noop,
    setWeatherApiKey: noop,
    setStandbyTimeout: noop,
    browseFolderDialog: async () => null,
    setPhotoFolder: noop,
    setFamilyName: noop,
    setThemeMode: noop,
    setLaunchOnStartup: noop,
    setMealCell: async (key, value) => {
      if (value.trim()) {
        _mealPlan = { ..._mealPlan, [key]: value.trim() }
      } else {
        const { [key]: _, ...rest } = _mealPlan
        _mealPlan = rest
      }
    },
    setSlideshowSettings: noop,
    setStandbyLayout: noop,
    setStandbyExitGesture: noop
  },
  lists: {
    addList: async (name) => {
      const l: AppList = { id: uuid(), name, items: [] }
      _lists = [..._lists, l]
      return l
    },
    removeList: async (listId) => {
      _lists = _lists.filter((l) => l.id !== listId)
    },
    addItem: async (listId, text) => {
      const item: ListItem = { id: uuid(), text, checked: false, createdAt: Date.now() }
      _lists = _lists.map((l) =>
        l.id === listId ? { ...l, items: [...l.items, item] } : l
      )
      return item
    },
    toggleItem: async (listId, itemId, checked) => {
      _lists = _lists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.map((it) => (it.id === itemId ? { ...it, checked } : it)) }
          : l
      )
    },
    removeItem: async (listId, itemId) => {
      _lists = _lists.map((l) =>
        l.id === listId ? { ...l, items: l.items.filter((it) => it.id !== itemId) } : l
      )
    }
  },
  tasks: {
    listTaskLists: async () => _taskLists,
    listTasks: async () => _tasks,
    createTask: async (accountId, taskListId, title, notes, due) => {
      const t: GTask = {
        id: uuid(), taskListId, accountId, title,
        notes, due, status: 'needsAction',
        updated: new Date().toISOString()
      }
      _tasks = [..._tasks, t]
      return t
    },
    setComplete: async (accountId, taskListId, taskId, complete) => {
      const t = _tasks.find((x) => x.id === taskId)
      if (!t) throw new Error('Task not found')
      const updated = { ...t, status: complete ? 'completed' as const : 'needsAction' as const }
      _tasks = _tasks.map((x) => (x.id === taskId ? updated : x))
      return updated
    },
    updateTask: async (accountId, taskListId, taskId, patch) => {
      const t = _tasks.find((x) => x.id === taskId)
      if (!t) throw new Error('Task not found')
      const updated = { ...t, ...patch }
      _tasks = _tasks.map((x) => (x.id === taskId ? updated : x))
      return updated
    },
    deleteTask: async (_accountId, _taskListId, taskId) => {
      _tasks = _tasks.filter((x) => x.id !== taskId)
    }
  },
  photos: {
    getList: async () => [],
    onListUpdated: () => {},
    advance: async () => {},
    setPaused: async () => {},
    wakeFromDeepSleep: async () => {},
    syncIcloud: async () => ({ ok: true, count: 0, error: '' }),
    getIcloudStatus: async () => ({ enabled: false, albums: [], lastSync: 0, photoCount: 0, lastError: '', isSyncing: false }),
  },
  weather: {
    fetch: async () => ({
      temp: 72,
      feelsLike: 70,
      condition: 'Clear',
      conditionIcon: '01d',
      conditionDescription: 'clear sky',
      humidity: 45,
      city: 'New York',
      fetchedAt: Date.now()
    }),
    fetchForecast: async () => {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      const icons = ['01d','02d','10d','03d','01d','13d']
      const descs = ['clear sky','few clouds','light rain','overcast clouds','clear sky','light snow']
      const highs = [72, 68, 65, 61, 70, 55]
      const lows  = [58, 55, 54, 50, 56, 44]
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() + i)
        const yr  = d.getFullYear()
        const mo  = String(d.getMonth() + 1).padStart(2, '0')
        const dy  = String(d.getDate()).padStart(2, '0')
        return {
          date:                 `${yr}-${mo}-${dy}`,
          dayLabel:             i === 0 ? 'Today' : days[d.getDay()],
          high:                 highs[i],
          low:                  lows[i],
          conditionIcon:        icons[i],
          conditionDescription: descs[i]
        }
      })
    }
  }
}

if (!window.api) {
  // @ts-ignore
  window.api = mock
  console.info('[CalendarDock] Running in browser preview mode — Electron APIs mocked')
}
