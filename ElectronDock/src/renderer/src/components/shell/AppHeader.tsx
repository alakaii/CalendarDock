import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { useSettingsStore } from '../../store/settings.slice'
import { useWeather, useForecast } from '../../hooks/useWeather'
import { useUIStore } from '../../store/ui.slice'
import CalendarPills from './CalendarPills'

const weatherEmoji: Record<string, string> = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '⛅',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧', '09n': '🌧',
  '10d': '🌦', '10n': '🌧',
  '11d': '⛈', '11n': '⛈',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫', '50n': '🌫',
}

function useTime() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return now
}

const CalendarIconSmall = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)

const pageTitles: Record<string, string> = {
  chores:   'Chores',
  meals:    'Meals',
  photos:   'Photos',
  lists:    'Lists',
  settings: 'Settings',
}

export default function AppHeader() {
  const familyName = useSettingsStore((s) => s.familyName)
  const units      = useSettingsStore((s) => s.weather.units)
  const activePage = useUIStore((s) => s.activePage)
  const setPage    = useUIStore((s) => s.setPage)

  const now = useTime()
  const { data: weather } = useWeather()

  const [forecastOpen, setForecastOpen] = useState(false)
  const { data: forecast, isLoading: forecastLoading } = useForecast(forecastOpen)

  // Close panel on click outside
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!forecastOpen) return
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setForecastOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [forecastOpen])

  const timeStr = format(now, 'h:mm a')
  const dateStr = format(now, 'EEE, MMM d')

  const unitSuffix = units === 'imperial' ? '°F' : '°C'

  const weatherDisplay = weather
    ? `${weatherEmoji[weather.conditionIcon] ?? '🌡'} ${Math.round(weather.temp)}°${units === 'imperial' ? 'F' : 'C'}`
    : null

  return (
    <header
      className="flex items-center justify-between px-4 flex-shrink-0 gap-3 relative"
      style={{
        height: 80,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Left: title pill (calendar page) or plain page title */}
      <div className="flex-shrink-0">
        {activePage === 'calendar' ? (
          <button
            onClick={() => setPage('calendar')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-base
                       transition-opacity hover:opacity-80 active:scale-95"
            style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#3b82f6',
              maxWidth: 260,
            }}
          >
            <CalendarIconSmall />
            <span className="truncate">{familyName}</span>
          </button>
        ) : (
          <span className="text-xl font-bold px-1">{pageTitles[activePage] ?? ''}</span>
        )}
      </div>

      {/* Center: date + filter pills (calendar page only) */}
      <div className="flex-1 flex items-center justify-center gap-3 overflow-hidden min-w-0">
        {activePage === 'calendar' && (
          <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
            {dateStr}
          </span>
        )}
        <div className="overflow-hidden flex-1 flex justify-center">
          <CalendarPills />
        </div>
      </div>

      {/* Right: weather (clickable) + clock */}
      <div className="flex items-center gap-4 flex-shrink-0" ref={panelRef}>
        {weatherDisplay && (
          <div className="relative">
            <button
              onClick={() => setForecastOpen((v) => !v)}
              className="text-base font-medium px-3 py-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
              style={{ color: 'var(--text-secondary)' }}
              title="Click to see 6-day forecast"
            >
              {weatherDisplay}
            </button>

            {/* Forecast panel */}
            {forecastOpen && (
              <div
                className="absolute top-full right-0 mt-2 z-50 rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  minWidth: 220,
                }}
              >
                {forecastLoading ? (
                  <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Loading…
                  </div>
                ) : forecast && forecast.length > 0 ? (
                  <div className="py-2">
                    {forecast.map((day, i) => (
                      <div
                        key={day.date}
                        className="flex items-center gap-3 px-4 py-2.5"
                        style={{
                          borderTop: i > 0 ? '1px solid var(--card-border)' : undefined
                        }}
                      >
                        {/* Day label */}
                        <span
                          className="text-sm font-semibold w-12 flex-shrink-0"
                          style={{ color: i === 0 ? '#3b82f6' : 'var(--text-primary)' }}
                        >
                          {day.dayLabel}
                        </span>

                        {/* Condition icon + description */}
                        <span className="text-xl flex-shrink-0">
                          {weatherEmoji[day.conditionIcon] ?? '🌡'}
                        </span>
                        <span
                          className="text-xs flex-1 truncate capitalize"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {day.conditionDescription}
                        </span>

                        {/* High / Low */}
                        <div className="flex items-baseline gap-1 flex-shrink-0 tabular-nums">
                          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {day.high}{unitSuffix}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            / {day.low}°
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Forecast unavailable
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <span className="text-lg font-semibold tabular-nums">{timeStr}</span>
      </div>
    </header>
  )
}
