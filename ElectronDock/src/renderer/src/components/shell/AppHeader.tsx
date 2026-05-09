import { useState, useEffect, useRef } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { useSettingsStore } from '../../store/settings.slice'
import { useWeather, useForecast } from '../../hooks/useWeather'
import { useUIStore } from '../../store/ui.slice'
import { calendarBridge } from '../../bridge/calendarBridge'
import type { CalView } from '../../store/ui.slice'
import { getSeasonalGradient } from '../../utils/seasonalGradient'
import {
  systemTimezone,
  timeInZone,
  offsetForZone,
  diffHours,
  formatDiffHours,
} from '../../utils/timezones'

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

const TodayCalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    <circle cx="12" cy="15.5" r="2.2" fill="currentColor" stroke="none" />
  </svg>
)

function shortZoneLabel(tz: string): string {
  const last = tz.split('/').pop() ?? tz
  return last.replace(/_/g, ' ').toUpperCase()
}

function weekRangeText(date: Date): string {
  const start = startOfWeek(date)
  const end   = endOfWeek(date)
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} – ${format(end, 'd')}`
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

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
  const units             = useSettingsStore((s) => s.weather.units)
  const timezone          = useSettingsStore((s) => s.timezone)
  const additionalZones   = useSettingsStore((s) => s.additionalTimezones)
  const activePage        = useUIStore((s) => s.activePage)
  const calendarDate      = useUIStore((s) => s.calendarDate)
  const calendarView      = useUIStore((s) => s.calendarView)

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
  const [clocksOpen,   setClocksOpen]   = useState(false)
  const { data: forecast, isLoading: forecastLoading } = useForecast(forecastOpen)

  // Close forecast modal on Escape
  useEffect(() => {
    if (!forecastOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setForecastOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [forecastOpen])

  // Close clocks modal on Escape
  useEffect(() => {
    if (!clocksOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setClocksOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clocksOpen])

  const baseTz     = timezone || systemTimezone()
  const timeStr    = timezone
    ? now.toLocaleTimeString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true })
    : format(now, 'h:mm a')
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
      className="flex items-center px-4 flex-shrink-0 gap-3 relative"
      style={{
        height: 100,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-primary)',
        // overflow visible so the weather forecast popup can extend below
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

      {/* ── Seasonal gradient underlay ── */}
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
                className="px-3 py-1 text-sm font-semibold rounded-lg min-h-[40px] tabular-nums transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 flex flex-col items-center justify-center leading-tight"
                style={{ color: 'var(--text-primary)', minWidth: 140 }}
                title="Go to today"
              >
                <span>{format(calendarDate, 'MMMM yyyy')}</span>
                {calendarView === 'timeGridWeek' && (
                  <span className="text-[11px] font-normal opacity-70">
                    {weekRangeText(calendarDate)}
                  </span>
                )}
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

            {/* Today — focuses current week / month */}
            <button
              onClick={() => navigate('today')}
              className="p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Today"
              title="Jump to current week / month"
            >
              <TodayCalendarIcon />
            </button>

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

        {/* Weather (clickable → centered forecast modal) */}
        {weatherDisplay && (
          <button
            onClick={() => setForecastOpen((v) => !v)}
            className="text-base font-medium px-3 py-2 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
            style={{ color: 'var(--text-secondary)' }}
            title="Click to see 6-day forecast"
          >
            {weatherDisplay}
          </button>
        )}

        {/* Clock — click to see all configured clocks in centered modal */}
        <button
          onClick={() => setClocksOpen((v) => !v)}
          className="text-lg font-semibold tabular-nums px-2 py-1 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
          style={{ color: 'var(--text-primary)' }}
          title="Click to see other clocks"
        >
          {timeStr}
        </button>
      </div>

      {/* ── Centered clocks modal ── */}
      {clocksOpen && (() => {
        const allClocks = [{ tz: baseTz, isHome: true }, ...additionalZones.map((tz) => ({ tz, isHome: false }))]
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setClocksOpen(false)}
          >
            <div
              className="rounded-2xl shadow-2xl"
              style={{
                background: 'var(--bg-surface)',
                border:     '1px solid var(--card-border)',
                width:      'min(1100px, 92vw)',
                maxHeight:  '85vh',
                color:      'var(--text-primary)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--card-border)' }}
              >
                <h3 className="text-xl font-semibold">World Clocks</h3>
                <button
                  onClick={() => setClocksOpen(false)}
                  className="p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${Math.min(allClocks.length, 6)}, minmax(0, 1fr))` }}
                >
                  {allClocks.map(({ tz, isHome }) => {
                    const d = isHome ? 0 : diffHours(tz, baseTz, now)
                    return (
                      <div
                        key={tz + (isHome ? ':home' : '')}
                        className="rounded-xl p-4 flex flex-col items-center text-center gap-3"
                        style={{
                          background: isHome ? 'rgba(59,130,246,0.10)' : 'var(--bg-base)',
                          border:     isHome ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--card-border)',
                        }}
                      >
                        <span
                          className="text-sm font-semibold tracking-wide uppercase truncate w-full"
                          style={{ color: isHome ? '#3b82f6' : 'var(--text-secondary)' }}
                          title={tz}
                        >
                          {isHome ? 'HOME' : shortZoneLabel(tz)}
                        </span>
                        <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {timeInZone(tz, now)}
                        </span>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {offsetForZone(tz, now)}
                          {!isHome && <> · <span style={{ color: d > 0 ? '#22c55e' : d < 0 ? '#f59e0b' : 'var(--text-secondary)' }}>{formatDiffHours(d)}</span></>}
                        </span>
                        {!isHome && (
                          <span
                            className="text-[11px] truncate w-full"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {tz}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {additionalZones.length === 0 && (
                  <p className="mt-6 text-xs italic text-center" style={{ color: 'var(--text-secondary)' }}>
                    Add more clocks in Settings → Clocks.
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Centered forecast modal ── */}
      {forecastOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setForecastOpen(false)}
        >
          <div
            className="rounded-2xl shadow-2xl"
            style={{
              background: 'var(--bg-surface)',
              border:     '1px solid var(--card-border)',
              width:      'min(1100px, 92vw)',
              maxHeight:  '85vh',
              color:      'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--card-border)' }}
            >
              <h3 className="text-xl font-semibold">6-Day Forecast</h3>
              <button
                onClick={() => setForecastOpen(false)}
                className="p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {forecastLoading ? (
                <p className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                  Loading…
                </p>
              ) : forecast && forecast.length > 0 ? (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${forecast.length}, minmax(0, 1fr))` }}
                >
                  {forecast.map((day, i) => (
                    <div
                      key={day.date}
                      className="rounded-xl p-4 flex flex-col items-center text-center gap-3"
                      style={{
                        background: i === 0 ? 'rgba(59,130,246,0.10)' : 'var(--bg-base)',
                        border:     i === 0 ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--card-border)',
                      }}
                    >
                      <span
                        className="text-sm font-semibold tracking-wide uppercase"
                        style={{ color: i === 0 ? '#3b82f6' : 'var(--text-secondary)' }}
                      >
                        {day.dayLabel}
                      </span>
                      <span className="text-6xl leading-none">
                        {weatherEmoji[day.conditionIcon] ?? '🌡'}
                      </span>
                      <span
                        className="text-xs capitalize"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {day.conditionDescription}
                      </span>
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                          {day.high}{unitSuffix}
                        </span>
                        <span className="text-base" style={{ color: 'var(--text-secondary)' }}>
                          / {day.low}°
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                  Forecast unavailable
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
