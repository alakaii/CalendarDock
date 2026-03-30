import { BrowserWindow } from 'electron'
import { registerAuthHandlers } from './auth.handler'
import { registerCalendarHandlers } from './calendar.handler'
import { registerListsHandlers } from './lists.handler'
import { registerPhotosHandlers } from './photos.handler'
import { registerSettingsHandlers } from './settings.handler'
import { registerTasksHandlers } from './tasks.handler'
import { registerWeatherHandlers } from './weather.handler'

export function registerIpcHandlers(win: BrowserWindow): void {
  registerAuthHandlers()
  registerCalendarHandlers()
  registerListsHandlers()
  registerPhotosHandlers()
  registerSettingsHandlers(win)
  registerTasksHandlers()
  registerWeatherHandlers()
}
