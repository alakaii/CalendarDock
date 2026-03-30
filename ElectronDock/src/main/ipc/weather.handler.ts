import { ipcMain } from 'electron'
import { weatherService } from '../services/weather.service'

export function registerWeatherHandlers(): void {
  ipcMain.handle('weather:fetch', async () => {
    return weatherService.fetch()
  })

  ipcMain.handle('weather:fetch-forecast', async () => {
    return weatherService.fetchForecast()
  })
}
