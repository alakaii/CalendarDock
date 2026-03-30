import { settingsService } from './settings.service'
import type { WeatherData, WeatherForecastDay } from '../../preload/types'

const BASE_URL     = 'https://api.openweathermap.org/data/2.5/weather'
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const weatherService = {
  async fetch(): Promise<WeatherData> {
    const settings = settingsService.getAll()
    const { location, units, apiKey } = settings.weather

    if (!apiKey) throw new Error('Weather API key not configured')
    if (!location) throw new Error('Weather location not configured')

    const params = new URLSearchParams({
      q: location,
      appid: apiKey,
      units: units === 'imperial' ? 'imperial' : 'metric'
    })

    const res = await fetch(`${BASE_URL}?${params}`)
    if (!res.ok) {
      throw new Error(`Weather API error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()

    return {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      condition: data.weather[0]?.main ?? 'Unknown',
      conditionIcon: data.weather[0]?.icon ?? '01d',
      conditionDescription: data.weather[0]?.description ?? '',
      humidity: data.main.humidity,
      city: data.name,
      fetchedAt: Date.now()
    }
  },

  async fetchForecast(): Promise<WeatherForecastDay[]> {
    const settings = settingsService.getAll()
    const { location, units, apiKey } = settings.weather

    if (!apiKey)    throw new Error('Weather API key not configured')
    if (!location)  throw new Error('Weather location not configured')

    const params = new URLSearchParams({
      q:     location,
      appid: apiKey,
      units: units === 'imperial' ? 'imperial' : 'metric',
      cnt:   '40'  // 5 days × 8 slots/day
    })

    const res = await fetch(`${FORECAST_URL}?${params}`)
    if (!res.ok) {
      throw new Error(`Weather forecast API error: ${res.status} ${res.statusText}`)
    }
    const data = await res.json()

    // Group 3-hour slots by local date string 'yyyy-MM-dd'
    const dayMap = new Map<string, { temps: number[]; icons: string[]; descs: string[] }>()

    for (const item of data.list as Array<{
      dt: number
      main: { temp: number }
      weather: Array<{ icon: string; description: string }>
    }>) {
      // Convert UTC timestamp to local date key
      const d   = new Date(item.dt * 1000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      if (!dayMap.has(key)) dayMap.set(key, { temps: [], icons: [], descs: [] })
      const entry = dayMap.get(key)!
      entry.temps.push(Math.round(item.main.temp))
      entry.icons.push(item.weather[0]?.icon ?? '01d')
      entry.descs.push(item.weather[0]?.description ?? '')
    }

    const todayKey = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()

    const result: WeatherForecastDay[] = []
    for (const [dateKey, entry] of dayMap) {
      if (result.length >= 6) break
      // Prefer a daytime icon (ends with 'd'); fall back to first available
      const dayIcon = entry.icons.find((ic) => ic.endsWith('d')) ?? entry.icons[0]
      const descIdx = entry.icons.indexOf(dayIcon)
      const desc    = entry.descs[descIdx] ?? entry.descs[0] ?? ''

      // Parse date parts directly to avoid timezone issues with new Date('yyyy-MM-dd')
      const [yr, mo, dy] = dateKey.split('-').map(Number)
      const weekDay = DAY_NAMES[new Date(yr, mo - 1, dy).getDay()]

      result.push({
        date:                 dateKey,
        dayLabel:             dateKey === todayKey ? 'Today' : weekDay,
        high:                 Math.max(...entry.temps),
        low:                  Math.min(...entry.temps),
        conditionIcon:        dayIcon,
        conditionDescription: desc
      })
    }

    return result
  }
}
