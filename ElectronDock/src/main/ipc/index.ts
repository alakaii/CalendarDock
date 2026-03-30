import { BrowserWindow } from 'electron'
import { registerAuthHandlers } from './auth.handler'
import { registerCalendarHandlers } from './calendar.handler'
import { registerCamerasHandlers } from './cameras.handler'
import { registerListsHandlers } from './lists.handler'
import { registerPhotosHandlers } from './photos.handler'
import { registerRachioHandlers } from './rachio.handler'
import { registerRinnaiHandlers } from './rinnai.handler'
import { registerSettingsHandlers } from './settings.handler'
import { registerTasksHandlers } from './tasks.handler'
import { registerWeatherHandlers } from './weather.handler'

export function registerIpcHandlers(win: BrowserWindow): void {
  registerAuthHandlers()
  registerCalendarHandlers()
  registerCamerasHandlers()
  registerListsHandlers()
  registerPhotosHandlers()
  registerRachioHandlers()
  registerRinnaiHandlers()
  registerSettingsHandlers(win)
  registerTasksHandlers()
  registerWeatherHandlers()
}
