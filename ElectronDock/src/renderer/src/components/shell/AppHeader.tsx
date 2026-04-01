import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { useSettingsStore } from '../../store/settings.slice'
import { useWeather, useForecast } from '../../hooks/useWeather'
import { useUIStore } from '../../store/ui.slice'
import { calendarBridge } from '../../bridge/calendarBridge'
import type { CalView } from '../../store/ui.slice'
import CalendarPills from './CalendarPills'

// ── Weather emoji map ─────────────────────────────────────────────────────────
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

// ── Seasonal gradient underlay (subtle, by current month) ─────────────────────
function getSeasonalGradient(month: number): string {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  if (month >= 2 && month <= 4) {
    // Spring (Mar–May): soft greens & cherry-blossom pinks
    return 'linear-gradient(120deg, rgba(134,239,172,0.18) 0%, rgba(249,168,212,0.14) 55%, rgba(167,243,208,0.10) 100%)'
  }
  if (month >= 5 && month <= 7) {
    // Summer (Jun–Aug): warm golden amber
    return 'linear-gradient(120deg, rgba(253,224,71,0.16) 0%, rgba(251,146,60,0.13) 55%, rgba(253,224,71,0.08) 100%)'
  }
  if (month >= 8 && month <= 10) {
    // Autumn (Sep–Nov): burnt orange & harvest red
    return 'linear-gradient(120deg, rgba(251,146,60,0.20) 0%, rgba(239,68,68,0.13) 55%, rgba(234,179,8,0.09) 100%)'
  }
  // Winter (Dec, Jan, Feb): cool ice-blue & soft violet
  return 'linear-gradient(120deg, rgba(147,197,253,0.18) 0%, rgba(196,181,253,0.14) 55%, rgba(147,197,253,0.09) 100%)'
}

// ── Clock hook ────────────────────────────────────────────────────────────────
function useTime() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ChevronLeft = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRight = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const pageTitles: Record<string, string> = {
  chores:   'Chores',
  meals:    'Meals',
  photos:   'Photos',
  lists:    'Lists',
  settings: 'Settings',
}

export const HEADER_IMAGE_KEY = 'headerImage'

// ── Component ─────────────────────────────────────────────────────────────────
export default function AppHeader() {
  const units        = useSettingsStore((s) => s.weather.units)
  const activePage   = useUIStore((s) => s.activePage)
  const calendarDate = useUIStore((s) => s.calendarDate)
  const calendarView = useUIStore((s) => s.calendarView)

  const now = useTime()
  const { data: weather } = useWeather()

  // ── Header image (set via Settings → General) ──
  const [headerImage, setHeaderImage] = useState<string | null>(
    () => localStorage.getItem(HEADER_IMAGE_KEY)
  )
  useEffect(() => {
    const handler = () => setHeaderImage(localStorage.getItem(HEADER_IMAGE_KEY))
    window.addEventListener('headerImageChanged', handler)
    return () => window.removeEventListener('headerImageChanged', handler)
  }, [])

  const [forecastOpen, setForecastOpen] = useState(false)
  const { data: forecast, isLoading: forecastLoading } = useForecast(forecastOpen)

  // Close forecast panel on outside click
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

  const timeStr    = format(now, 'h:mm a')
  const unitSuffix = units === 'imperial' ? '°F' : '°C'

  const weatherDisplay = weather
    ? `${weatherEmoji[weather.conditionIcon] ?? '🌡'} ${Math.round(weather.temp)}°${units === 'imperial' ? 'F' : 'C'}`
    : null

  const seasonalGradient = getSeasonalGradient(now.getMonth())

  // Handlers that delegate to the imperative bridge
  const navigate   = (dir: 'prev' | 'next' | 'today') => calendarBridge.navigate?.(dir)
  const changeView = (v: CalView) => calendarBridge.changeView?.(v)

  const isCalendar = activePage === 'calendar'

  return (
    <header
      className="flex items-center px-4 flex-shrink-0 gap-3 relative overflow-hidden"
      style={{
        height: 100,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Header image (bottom layer) ── */}
      {headerImage && (
        <img
          aria-hidden="true"
          src={headerImage}
          alt=""
          className="pointer-events-none absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
      )}

      {/* ── Seasonal gradient underlay (sits above image as colour tint) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: seasonalGradient, zIndex: 1 }}
      />

      {/* ── Left: page title (non-calendar pages only) ── */}
      {!isCalendar && (
        <div className="flex-shrink-0 relative z-20">
          <span className="text-xl font-bold px-1">{pageTitles[activePage] ?? ''}</span>
        </div>
      )}

      {/* ── Centre: calendar filter pills — truly screen-centred via absolute ── */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
        <div className="pointer-events-auto flex items-center justify-center">
          <CalendarPills />
        </div>
      </div>

      {/* Spacer so the right block is pushed to the edge on non-calendar pages */}
      <div className="flex-1" />

      {/* ── Right: calendar nav (calendar page only) + weather + clock ── */}
      <div className="flex items-center gap-3 flex-shrink-0 relative z-20">

        {/* Calendar navigation — only on the calendar page */}
        {isCalendar && (
          <>
            {/* Prev / Month·Year label / Next */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('prev')}
                className="p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Previous"
              >
                <ChevronLeft />
              </button>

              <button
                onClick={() => navigate('today')}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg min-h-[40px] tabular-nums transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
                style={{ color: 'var(--text-primary)', minWidth: 120, textAlign: 'center' }}
                title="Go to today"
              >
                {format(calendarDate, 'MMMM yyyy')}
              </button>

              <button
                onClick={() => navigate('next')}
                className="p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Next"
              >
                <ChevronRight />
              </button>
            </div>

            {/* Week | Month toggle */}
            <div
              className="flex rounded-lg overflow-hidden text-sm"
              style={{ border: '1px solid var(--border)' }}
            >
              {(['timeGridWeek', 'dayGridMonth'] as CalView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => changeView(v)}
                  className="px-4 py-1.5 font-medium transition-colors min-h-[36px]"
                  style={{
                    background: calendarView === v ? '#3b82f6' : 'transparent',
                    color: calendarView === v ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {v === 'timeGridWeek' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div
              className="self-stretch w-px mx-1"
              style={{ background: 'var(--border)', marginTop: 12, marginBottom: 12 }}
            />
          </>
        )}

        {/* Weather (clickable → forecast panel) */}
        {weatherDisplay && (
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setForecastOpen((v) => !v)}
              className="text-base font-medium px-3 py-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
              style={{ color: 'var(--text-secondary)' }}
              title="Click to see 6-day forecast"
            >
              {weatherDisplay}
            </button>

            {/* Forecast drop-down panel */}
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
                        style={{ borderTop: i > 0 ? '1px solid var(--card-border)' : undefined }}
                      >
                        <span
                          className="text-sm font-semibold w-12 flex-shrink-0"
                          style={{ color: i === 0 ? '#3b82f6' : 'var(--text-primary)' }}
                        >
                          {day.dayLabel}
                        </span>
                        <span className="text-xl flex-shrink-0">
                          {weatherEmoji[day.conditionIcon] ?? '🌡'}
                        </span>
                        <span
                          className="text-xs flex-1 truncate capitalize"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {day.conditionDescription}
                        </span>
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

        {/* Clock */}
        <span className="text-lg font-semibold tabular-nums">{timeStr}</span>
      </div>
    </header>
  )
}
