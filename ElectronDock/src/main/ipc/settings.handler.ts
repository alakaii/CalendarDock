import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { settingsService } from '../services/settings.service'
import { photosService } from '../services/photos.service'
import type { ThemeMode, SlideshowSettings, StandbyLayout, StandbyExitGesture } from '../../preload/types'

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
}
