import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { settingsService } from '../services/settings.service'
import { photosService } from '../services/photos.service'
import type { ThemeMode, SlideshowSettings, StandbyLayout, StandbyExitGesture, ChoresMode, ChoresList, ListsMode, ListsFilter, WyzeCamera, CalendarSwipeDirection, SidebarSlot, ArtMode, ArtScaleMode } from '../../preload/types'

export function registerSettingsHandlers(win: BrowserWindow): void {
  ipcMain.handle('settings:get-all', async () => {
    const settings = settingsService.getAll()
    // Strip sensitive fields before sending to renderer
    return {
      ...settings,
      accounts: settings.accounts.map(({ encryptedRefreshToken: _, ...rest }) => rest),
      weather: {
        ...settings.weather,
        apiKey: settings.weather.apiKey ? '••••••••' : '' // Mask API key
      }
    }
  })

  ipcMain.handle(
    'settings:set-calendar-visible',
    async (_event, { calendarId, visible }: { calendarId: string; visible: boolean }) => {
      settingsService.setCalendarVisible(calendarId, visible)
    }
  )

  ipcMain.handle(
    'settings:set-calendar-color',
    async (_event, { calendarId, color }: { calendarId: string; color: string }) => {
      settingsService.setCalendarColor(calendarId, color)
    }
  )

  ipcMain.handle(
    'settings:set-weather-location',
    async (_event, { location }: { location: string }) => {
      settingsService.setWeatherLocation(location)
    }
  )

  ipcMain.handle(
    'settings:set-weather-units',
    async (_event, { units }: { units: 'imperial' | 'metric' }) => {
      settingsService.setWeatherUnits(units)
    }
  )

  ipcMain.handle(
    'settings:set-weather-api-key',
    async (_event, { apiKey }: { apiKey: string }) => {
      settingsService.setWeatherApiKey(apiKey)
    }
  )

  ipcMain.handle(
    'settings:set-standby-timeout',
    async (_event, { minutes }: { minutes: number }) => {
      settingsService.setStandbyTimeout(minutes)
    }
  )

  ipcMain.handle(
    'settings:set-timezone',
    async (_event, { tz }: { tz: string }) => {
      settingsService.setTimezone(tz)
    }
  )

  ipcMain.handle(
    'settings:set-calendar-color-override',
    async (_event, { calendarId, mode, color }: { calendarId: string; mode: 'light' | 'dark'; color: string }) => {
      settingsService.setCalendarColorOverride(calendarId, mode, color)
    }
  )

  ipcMain.handle(
    'settings:set-additional-timezones',
    async (_event, { zones }: { zones: string[] }) => {
      settingsService.setAdditionalTimezones(zones)
    }
  )

  ipcMain.handle('settings:browse-folder-dialog', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Photo Folder'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(
    'settings:set-photo-folder',
    async (_event, { folderPath }: { folderPath: string }) => {
      settingsService.setPhotoFolder(folderPath)
      photosService.restartWatcher(folderPath, win)
    }
  )

  ipcMain.handle(
    'settings:set-family-name',
    async (_event, { name }: { name: string }) => {
      settingsService.setFamilyName(name)
    }
  )

  ipcMain.handle(
    'settings:set-theme-mode',
    async (_event, { mode }: { mode: ThemeMode }) => {
      settingsService.setThemeMode(mode)
    }
  )

  ipcMain.handle(
    'settings:set-art-mode',
    async (_event, { mode }: { mode: ArtMode }) => {
      settingsService.setArtMode(mode)
    }
  )

  ipcMain.handle(
    'settings:set-ui-opacity',
    async (_event, { opacity }: { opacity: number }) => {
      settingsService.setUiOpacity(opacity)
    }
  )

  ipcMain.handle(
    'settings:set-art-scale-mode',
    async (_event, { mode }: { mode: ArtScaleMode }) => {
      settingsService.setArtScaleMode(mode)
    }
  )

  ipcMain.handle(
    'settings:set-art-pixelated',
    async (_event, { pixelated }: { pixelated: boolean }) => {
      settingsService.setArtPixelated(pixelated)
    }
  )

  ipcMain.handle(
    'settings:set-launch-on-startup',
    async (_event, { enabled }: { enabled: boolean }) => {
      settingsService.setLaunchOnStartup(enabled)
      app.setLoginItemSettings({ openAtLogin: enabled })
    }
  )

  ipcMain.handle(
    'settings:set-meal-cell',
    async (_event, { key, value }: { key: string; value: string }) => {
      settingsService.setMealCell(key, value)
    }
  )

  ipcMain.handle(
    'settings:set-slideshow',
    async (_event, s: SlideshowSettings) => {
      settingsService.setSlideshowSettings(s)
    }
  )

  ipcMain.handle(
    'settings:set-calendar-swipe',
    async (_event, { view, direction }: { view: 'week' | 'month'; direction: CalendarSwipeDirection }) => {
      settingsService.setCalendarSwipe(view, direction)
    }
  )

  ipcMain.handle(
    'settings:set-sidebar-layout',
    async (_event, { layout }: { layout: SidebarSlot[] }) => {
      settingsService.setSidebarLayout(layout)
    }
  )

  ipcMain.handle(
    'settings:set-standby-layout',
    async (_event, l: StandbyLayout) => {
      settingsService.setStandbyLayout(l)
    }
  )

  ipcMain.handle(
    'settings:set-standby-exit-gesture',
    async (_event, g: StandbyExitGesture) => {
      settingsService.setStandbyExitGesture(g)
    }
  )

  ipcMain.handle(
    'settings:set-chores-mode',
    async (_event, { mode }: { mode: ChoresMode }) => {
      settingsService.setChoresMode(mode)
    }
  )

  ipcMain.handle(
    'settings:set-chores-lists',
    async (_event, { lists }: { lists: ChoresList[] }) => {
      settingsService.setChoresLists(lists)
    }
  )

  ipcMain.handle(
    'settings:set-lists-mode',
    async (_event, { mode }: { mode: ListsMode }) => {
      settingsService.setListsMode(mode)
    }
  )

  ipcMain.handle(
    'settings:set-lists-filter',
    async (_event, { filter }: { filter: ListsFilter }) => {
      settingsService.setListsFilter(filter)
    }
  )

  ipcMain.handle(
    'settings:set-lists-selected-ids',
    async (_event, { ids }: { ids: string[] }) => {
      settingsService.setListsSelectedIds(ids)
    }
  )

  ipcMain.handle(
    'settings:set-cameras',
    async (_event, { cameras }: { cameras: WyzeCamera[] }) => {
      settingsService.setCameras(cameras)
    }
  )

  ipcMain.handle(
    'settings:set-rachio-api-key',
    async (_event, { key }: { key: string }) => {
      settingsService.setRachioApiKey(key)
    }
  )

  ipcMain.handle(
    'settings:set-rinnai-credentials',
    async (_event, { email, password }: { email: string; password: string }) => {
      settingsService.setRinnaiCredentials(email, password)
    }
  )

ipcMain.handle(
    'settings:set-meals-google-task-list',
    async (_event, { accountId, taskListId }: { accountId: string; taskListId: string }) => {
      settingsService.setMealsGoogleTaskList(accountId, taskListId)
    }
  )

  ipcMain.handle(
    'settings:set-camera-wake-enabled',
    async (_event, { enabled }: { enabled: boolean }) => {
      settingsService.setCameraWakeEnabled(enabled)
    }
  )

  ipcMain.handle(
    'settings:set-deep-sleep-schedule',
    async (_event, { start, end }: { start: string; end: string }) => {
      settingsService.setDeepSleepSchedule(start, end)
    }
  )

  ipcMain.handle(
    'settings:set-camera-wake-calibration',
    async (_event, { background, threshold }: { background: number[]; threshold: number }) => {
      settingsService.setCameraWakeCalibration(background, threshold)
    }
  )

  ipcMain.handle(
    'settings:set-camera-wake-threshold',
    async (_event, { threshold }: { threshold: number }) => {
      settingsService.setCameraWakeThreshold(threshold)
    }
  )

  ipcMain.handle(
    'settings:set-passive-day',
    async (_event, { standbyMinutes, backlightOffMinutes }: { standbyMinutes: number; backlightOffMinutes: number }) => {
      settingsService.setPassiveDaySettings(standbyMinutes, backlightOffMinutes)
    }
  )

  ipcMain.handle(
    'settings:set-active-day',
    async (_event, { standbyMinutes, sustainSeconds, holdMinutes }: { standbyMinutes: number; sustainSeconds: number; holdMinutes: number }) => {
      settingsService.setActiveDaySettings(standbyMinutes, sustainSeconds, holdMinutes)
    }
  )

  ipcMain.handle(
    'settings:set-calendar-order',
    async (_event, { ids }: { ids: string[] }) => {
      settingsService.setCalendarOrder(ids)
    }
  )

  ipcMain.handle(
    'settings:set-meals-font-size',
    async (_event, { size }: { size: number }) => {
      settingsService.setMealsFontSize(size)
    }
  )

  ipcMain.handle(
    'settings:set-fridge-google-task-list',
    async (_event, { accountId, taskListId }: { accountId: string; taskListId: string }) => {
      settingsService.setFridgeGoogleTaskList(accountId, taskListId)
    }
  )

  ipcMain.handle(
    'settings:set-wyze-bridge-config',
    async (_event, { email, password, host, apiId, apiKey }: { email: string; password: string; host: string; apiId: string; apiKey: string }) => {
      settingsService.setWyzeBridgeConfig(email, password, host, apiId, apiKey)
    }
  )

  ipcMain.handle(
    'settings:set-ring-snapshot-interval',
    async (_event, { seconds }: { seconds: number }) => {
      settingsService.setRingSnapshotInterval(seconds)
    }
  )
}
