import { BrowserWindow } from 'electron'
import { registerArtHandlers } from './art.handler'
import { registerDropboxHandlers } from './dropbox.handler'
import { registerAuthHandlers } from './auth.handler'
import { registerCalendarHandlers } from './calendar.handler'
import { registerCamerasHandlers } from './cameras.handler'
import { registerListsHandlers } from './lists.handler'
import { registerLogHandlers } from './log.handler'
import { registerPhotosHandlers } from './photos.handler'
import { registerRachioHandlers } from './rachio.handler'
import { registerRingHandlers } from './ring.handler'
import { registerRinnaiHandlers } from './rinnai.handler'
import { registerSettingsHandlers } from './settings.handler'
import { registerSystemHandlers } from './system.handler'
import { registerTasksHandlers } from './tasks.handler'
import { registerTeslaHandlers } from './tesla.handler'
import { registerUpdatesHandlers } from './updates.handler'
import { registerWeatherHandlers } from './weather.handler'

export function registerIpcHandlers(win: BrowserWindow): void {
  registerArtHandlers()
  registerAuthHandlers()
  registerDropboxHandlers()
  registerCalendarHandlers()
  registerCamerasHandlers()
  registerListsHandlers()
  registerLogHandlers()
  registerPhotosHandlers()
  registerRachioHandlers()
  registerRingHandlers()
  registerRinnaiHandlers()
  registerSettingsHandlers(win)
  registerSystemHandlers(win)
  registerTasksHandlers()
  registerTeslaHandlers()
  registerUpdatesHandlers(win)
  registerWeatherHandlers()
}
