import { contextBridge, ipcRenderer } from 'electron'
import type { CalendarDockAPI } from './types'

const api: CalendarDockAPI = {
  auth: {
    startFlow: () => ipcRenderer.invoke('auth:start-flow'),
    removeAccount: (accountId) => ipcRenderer.invoke('auth:remove-account', { accountId }),
    listAccounts: () => ipcRenderer.invoke('auth:list-accounts'),
    onReauthRequired: (cb) => {
      ipcRenderer.on('auth:reauth-required', (_event, data) => cb(data))
    }
  },

  calendar: {
    listCalendars: (accountId) => ipcRenderer.invoke('calendar:list-calendars', { accountId }),
    fetchEvents: (payload) => ipcRenderer.invoke('calendar:fetch-events', payload),
    createEvent: (payload) => ipcRenderer.invoke('calendar:create-event', payload)
  },

  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    setCalendarVisible: (calendarId, visible) =>
      ipcRenderer.invoke('settings:set-calendar-visible', { calendarId, visible }),
    setCalendarColor: (calendarId, color) =>
      ipcRenderer.invoke('settings:set-calendar-color', { calendarId, color }),
    setWeatherLocation: (location) =>
      ipcRenderer.invoke('settings:set-weather-location', { location }),
    setWeatherUnits: (units) =>
      ipcRenderer.invoke('settings:set-weather-units', { units }),
    setWeatherApiKey: (apiKey) =>
      ipcRenderer.invoke('settings:set-weather-api-key', { apiKey }),
    setStandbyTimeout: (minutes) =>
      ipcRenderer.invoke('settings:set-standby-timeout', { minutes }),
    browseFolderDialog: () => ipcRenderer.invoke('settings:browse-folder-dialog'),
    setPhotoFolder: (folderPath) =>
      ipcRenderer.invoke('settings:set-photo-folder', { folderPath }),
    setFamilyName: (name) =>
      ipcRenderer.invoke('settings:set-family-name', { name }),
    setThemeMode: (mode) =>
      ipcRenderer.invoke('settings:set-theme-mode', { mode }),
    setLaunchOnStartup: (enabled) =>
      ipcRenderer.invoke('settings:set-launch-on-startup', { enabled }),
    setMealCell: (key, value) =>
      ipcRenderer.invoke('settings:set-meal-cell', { key, value }),
    setSlideshowSettings: (s) =>
      ipcRenderer.invoke('settings:set-slideshow', s),
    setStandbyLayout: (l) =>
      ipcRenderer.invoke('settings:set-standby-layout', l),
    setStandbyExitGesture: (g) =>
      ipcRenderer.invoke('settings:set-standby-exit-gesture', g)
  },

  lists: {
    addList: (name) => ipcRenderer.invoke('lists:add-list', { name }),
    removeList: (listId) => ipcRenderer.invoke('lists:remove-list', { listId }),
    addItem: (listId, text) => ipcRenderer.invoke('lists:add-item', { listId, text }),
    toggleItem: (listId, itemId, checked) =>
      ipcRenderer.invoke('lists:toggle-item', { listId, itemId, checked }),
    removeItem: (listId, itemId) =>
      ipcRenderer.invoke('lists:remove-item', { listId, itemId })
  },

  tasks: {
    listTaskLists: (accountId) =>
      ipcRenderer.invoke('tasks:list-task-lists', { accountId }),
    listTasks: (accountId, taskListId, showCompleted) =>
      ipcRenderer.invoke('tasks:list-tasks', { accountId, taskListId, showCompleted }),
    createTask: (accountId, taskListId, title, notes, due) =>
      ipcRenderer.invoke('tasks:create-task', { accountId, taskListId, title, notes, due }),
    setComplete: (accountId, taskListId, taskId, complete) =>
      ipcRenderer.invoke('tasks:set-complete', { accountId, taskListId, taskId, complete }),
    updateTask: (accountId, taskListId, taskId, patch) =>
      ipcRenderer.invoke('tasks:update-task', { accountId, taskListId, taskId, patch }),
    deleteTask: (accountId, taskListId, taskId) =>
      ipcRenderer.invoke('tasks:delete-task', { accountId, taskListId, taskId })
  },

  photos: {
    getList: () => ipcRenderer.invoke('photos:get-list'),
    onListUpdated: (cb) => {
      ipcRenderer.on('photos:list-updated', (_event, list) => cb(list))
    }
  },

  weather: {
    fetch:         () => ipcRenderer.invoke('weather:fetch'),
    fetchForecast: () => ipcRenderer.invoke('weather:fetch-forecast')
  }
}

contextBridge.exposeInMainWorld('api', api)
