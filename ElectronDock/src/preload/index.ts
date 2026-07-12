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
    setCalendarColorOverride: (calendarId, mode, color) =>
      ipcRenderer.invoke('settings:set-calendar-color-override', { calendarId, mode, color }),
    setWeatherLocation: (location) =>
      ipcRenderer.invoke('settings:set-weather-location', { location }),
    setWeatherUnits: (units) =>
      ipcRenderer.invoke('settings:set-weather-units', { units }),
    setWeatherApiKey: (apiKey) =>
      ipcRenderer.invoke('settings:set-weather-api-key', { apiKey }),
    setTimezone: (tz) =>
      ipcRenderer.invoke('settings:set-timezone', { tz }),
    setAdditionalTimezones: (zones) =>
      ipcRenderer.invoke('settings:set-additional-timezones', { zones }),
    setStandbyTimeout: (minutes) =>
      ipcRenderer.invoke('settings:set-standby-timeout', { minutes }),
    browseFolderDialog: () => ipcRenderer.invoke('settings:browse-folder-dialog'),
    setPhotoFolder: (folderPath) =>
      ipcRenderer.invoke('settings:set-photo-folder', { folderPath }),
    setFamilyName: (name) =>
      ipcRenderer.invoke('settings:set-family-name', { name }),
    setThemeMode: (mode) =>
      ipcRenderer.invoke('settings:set-theme-mode', { mode }),
    setArtMode: (mode) =>
      ipcRenderer.invoke('settings:set-art-mode', { mode }),
    setUiOpacity: (opacity) =>
      ipcRenderer.invoke('settings:set-ui-opacity', { opacity }),
    setArtScaleMode: (mode) =>
      ipcRenderer.invoke('settings:set-art-scale-mode', { mode }),
    setArtPixelated: (pixelated) =>
      ipcRenderer.invoke('settings:set-art-pixelated', { pixelated }),
    setArtIconFill: (fill) =>
      ipcRenderer.invoke('settings:set-art-icon-fill', { fill }),
    setLaunchOnStartup: (enabled) =>
      ipcRenderer.invoke('settings:set-launch-on-startup', { enabled }),
    setMealCell: (key, value) =>
      ipcRenderer.invoke('settings:set-meal-cell', { key, value }),
    setSlideshowSettings: (s) =>
      ipcRenderer.invoke('settings:set-slideshow', s),
    setCalendarSwipe: (view, direction) =>
      ipcRenderer.invoke('settings:set-calendar-swipe', { view, direction }),
    setSidebarLayout: (layout) =>
      ipcRenderer.invoke('settings:set-sidebar-layout', { layout }),
    setStandbyLayout: (l) =>
      ipcRenderer.invoke('settings:set-standby-layout', l),
    setStandbyExitGesture: (g) =>
      ipcRenderer.invoke('settings:set-standby-exit-gesture', g),
    setChoresMode: (mode) =>
      ipcRenderer.invoke('settings:set-chores-mode', { mode }),
    setChoresLists: (lists) =>
      ipcRenderer.invoke('settings:set-chores-lists', { lists }),
    setListsMode: (mode) =>
      ipcRenderer.invoke('settings:set-lists-mode', { mode }),
    setListsFilter: (filter) =>
      ipcRenderer.invoke('settings:set-lists-filter', { filter }),
    setListsSelectedIds: (ids) =>
      ipcRenderer.invoke('settings:set-lists-selected-ids', { ids }),
    setCameras: (cameras) =>
      ipcRenderer.invoke('settings:set-cameras', { cameras }),
    setRachioApiKey: (key) =>
      ipcRenderer.invoke('settings:set-rachio-api-key', { key }),
    setRinnaiCredentials: (email, password) =>
      ipcRenderer.invoke('settings:set-rinnai-credentials', { email, password }),
setMealsGoogleTaskList: (accountId, taskListId) =>
      ipcRenderer.invoke('settings:set-meals-google-task-list', { accountId, taskListId }),
    setCameraWakeEnabled: (enabled) =>
      ipcRenderer.invoke('settings:set-camera-wake-enabled', { enabled }),
    setDeepSleepSchedule: (start, end) =>
      ipcRenderer.invoke('settings:set-deep-sleep-schedule', { start, end }),
    setCameraWakeCalibration: (background, threshold) =>
      ipcRenderer.invoke('settings:set-camera-wake-calibration', { background, threshold }),
    setCameraWakeThreshold: (threshold) =>
      ipcRenderer.invoke('settings:set-camera-wake-threshold', { threshold }),
    setPassiveDaySettings: (backlightOffMinutes) =>
      ipcRenderer.invoke('settings:set-passive-day', { backlightOffMinutes }),
    setActiveDaySettings: (sustainSeconds, holdMinutes) =>
      ipcRenderer.invoke('settings:set-active-day', { sustainSeconds, holdMinutes }),
    setCalendarOrder: (ids) =>
      ipcRenderer.invoke('settings:set-calendar-order', { ids }),
    setMealsFontSize: (size) =>
      ipcRenderer.invoke('settings:set-meals-font-size', { size }),
    setFridgeGoogleTaskList: (accountId, taskListId) =>
      ipcRenderer.invoke('settings:set-fridge-google-task-list', { accountId, taskListId }),
    setWyzeBridgeConfig: (email, password, host, apiId, apiKey) =>
      ipcRenderer.invoke('settings:set-wyze-bridge-config', { email, password, host, apiId, apiKey }),
    setRingSnapshotInterval: (seconds) =>
      ipcRenderer.invoke('settings:set-ring-snapshot-interval', { seconds }),
    setIcloudAlbumUrls: (urls) =>
      ipcRenderer.invoke('settings:set-icloud-album-urls', { urls }),
    setIcloudPhotosEnabled: (enabled) =>
      ipcRenderer.invoke('settings:set-icloud-photos-enabled', { enabled }),
  },

  art: {
    getFullscreen:   ()            => ipcRenderer.invoke('art:get-fullscreen'),
    setFullscreen:   (bytes, ext)  => ipcRenderer.invoke('art:set-fullscreen', { bytes, ext }),
    clearFullscreen: ()            => ipcRenderer.invoke('art:clear-fullscreen'),
  },

  dropbox: {
    connect:    (appKey) => ipcRenderer.invoke('dropbox:connect', { appKey }),
    disconnect: ()       => ipcRenderer.invoke('dropbox:disconnect'),
    syncNow:    ()       => ipcRenderer.invoke('dropbox:sync-now'),
    getStatus:  ()       => ipcRenderer.invoke('dropbox:get-status'),
    setConfig:  (cfg)    => ipcRenderer.invoke('dropbox:set-config', cfg),
    onProgress: (cb) => {
      ipcRenderer.on('dropbox:progress', (_event, data) => cb(data.pct, data.status))
    },
  },

  cameras: {
    startStream:   (cameraId) => ipcRenderer.invoke('cameras:start-stream', { cameraId }),
    stopStream:    (cameraId) => ipcRenderer.invoke('cameras:stop-stream', { cameraId }),
    stopAllStreams: ()         => ipcRenderer.invoke('cameras:stop-all'),
    bridgeStatus:  () => ipcRenderer.invoke('cameras:bridge-status'),
    bridgeStart:   () => ipcRenderer.invoke('cameras:bridge-start'),
    bridgeStop:    () => ipcRenderer.invoke('cameras:bridge-stop'),
    bridgeRemove:  () => ipcRenderer.invoke('cameras:bridge-remove'),
  },

  rachio: {
    getDevices:      ()                    => ipcRenderer.invoke('rachio:get-devices'),
    startZone:       (zoneId, durationSec) => ipcRenderer.invoke('rachio:start-zone', { zoneId, durationSec }),
    stopAll:         (deviceId)            => ipcRenderer.invoke('rachio:stop-all', { deviceId }),
    getSchedules:    (deviceId)            => ipcRenderer.invoke('rachio:get-schedules', { deviceId }),
    enableSchedule:  (scheduleId)          => ipcRenderer.invoke('rachio:enable-schedule', { scheduleId }),
    disableSchedule: (scheduleId)          => ipcRenderer.invoke('rachio:disable-schedule', { scheduleId }),
    skipSchedule:    (scheduleId)          => ipcRenderer.invoke('rachio:skip-schedule', { scheduleId }),
  },

  rinnai: {
    getDevices:       ()                          => ipcRenderer.invoke('rinnai:get-devices'),
    setTemperature:   (thingName, temp)           => ipcRenderer.invoke('rinnai:set-temperature', { thingName, temp }),
    setRecirculation: (thingName, enabled, durationMinutes) =>
      ipcRenderer.invoke('rinnai:set-recirculation', { thingName, enabled, durationMinutes }),
  },

  tesla: {
    getStatus:           () => ipcRenderer.invoke('tesla:get-status'),
    connect:             () => ipcRenderer.invoke('tesla:connect'),
    disconnect:          () => ipcRenderer.invoke('tesla:disconnect'),
    getConnectionStatus: () => ipcRenderer.invoke('tesla:get-connection-status'),
    listVehicles:        () => ipcRenderer.invoke('tesla:list-vehicles'),
    setVehicleEnabled:   (id, enabled) => ipcRenderer.invoke('tesla:set-vehicle-enabled', { id, enabled }),
    refreshProducts:     () => ipcRenderer.invoke('tesla:refresh-products'),
    setConnectionMode:   (mode) => ipcRenderer.invoke('tesla:set-connection-mode', { mode }),
    setGatewayConfig:    (host, password) => ipcRenderer.invoke('tesla:set-gateway-config', { host, password }),
    clearGatewayConfig:  () => ipcRenderer.invoke('tesla:clear-gateway-config'),
    testLocalConnection: () => ipcRenderer.invoke('tesla:test-local-connection'),
  },

  ring: {
    connect:     (email, password) => ipcRenderer.invoke('ring:connect', { email, password }),
    submit2fa:   (code)            => ipcRenderer.invoke('ring:submit-2fa', { code }),
    disconnect:  ()                => ipcRenderer.invoke('ring:disconnect'),
    getStatus:   ()                => ipcRenderer.invoke('ring:get-status'),
    listCameras: ()                => ipcRenderer.invoke('ring:list-cameras'),
    snapshotUrl: (cameraId)        => ipcRenderer.invoke('ring:snapshot-url', { cameraId }),
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
    getList:           () => ipcRenderer.invoke('photos:get-list'),
    advance:           () => ipcRenderer.invoke('photos:advance'),
    setPaused:         (paused) => ipcRenderer.invoke('photos:set-paused', { paused }),
    wakeFromDeepSleep: () => ipcRenderer.invoke('photos:wake-from-deep-sleep'),
    syncIcloud:        () => ipcRenderer.invoke('photos:sync-icloud'),
    getIcloudStatus:   () => ipcRenderer.invoke('photos:icloud-status'),
    resyncAll:         () => ipcRenderer.invoke('photos:resync-all'),
    onListUpdated: (cb) => {
      ipcRenderer.on('photos:list-updated', (_event, list) => cb(list))
    },
  },

  weather: {
    fetch:         () => ipcRenderer.invoke('weather:fetch'),
    fetchForecast: () => ipcRenderer.invoke('weather:fetch-forecast')
  },

  system: {
    setDisplayPower:  (on) => ipcRenderer.invoke('system:set-display-power', { on }),
    enterFullscreen: ()    => ipcRenderer.invoke('system:enter-fullscreen'),
  },

  log: {
    forward: (level, args) => ipcRenderer.invoke('log:renderer', { level, args }),
  },

  updates: {
    check:       () => ipcRenderer.invoke('updates:check'),
    install:     () => ipcRenderer.invoke('updates:install'),
    getSchedule: () => ipcRenderer.invoke('updates:get-schedule'),
    setSchedule: (schedule) => ipcRenderer.invoke('updates:set-schedule', schedule),
    onProgress: (cb) => {
      ipcRenderer.on('updates:progress', (_event, p) => cb(p))
    },
  },
}

contextBridge.exposeInMainWorld('api', api)
