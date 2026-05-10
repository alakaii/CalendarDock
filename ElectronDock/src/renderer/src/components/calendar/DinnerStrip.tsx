import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Bottom-of-CalendarView strip showing the next 7 days of planned dinners.
 * mealPlan keys are weekly (`${dow}-dinner`, dow matches JS Date.getDay()),
 * so we read the same map MealsPage edits — no extra storage. Tap anywhere
 * on the strip to jump to Settings → Meals (well, the Meals page) for editing.
 *
 * Color tone is intentionally amber/warm, distinct from the calendar's
 * cool palette, so it reads as a separate widget rather than a calendar row.
 */
export default function DinnerStrip() {
  const mealPlan = useSettingsStore((s) => s.mealPlan)
  const setPage  = useUIStore((s) => s.setPage)

  // Tick once per minute so the "today" highlight rolls forward at midnight
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(iv)
  }, [])

  // Build the next 7 days starting today
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <button
      onClick={() => setPage('meals')}
      className="flex-shrink-0 w-full flex items-stretch transition-colors"
      style={{
        background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(245,158,11,0.14))',
        borderTop: '1px solid rgba(245,158,11,0.35)',
        color: 'var(--text-primary)',
      }}
      aria-label="Open meal plan"
      title="Tap to edit meal plan"
    >
      {/* Section label on the far left — anchors the strip semantically */}
      <div
        className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0"
        style={{ borderRight: '1px solid rgba(245,158,11,0.25)', minWidth: 96 }}
      >
        <span className="text-[20px] leading-none mb-0.5">🌙</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>
          Dinner
        </span>
      </div>

      {/* 7 day columns, equal-width, today is accented */}
      <div className="flex-1 flex">
        {days.map((d, i) => {
          const dow      = d.getDay()
          const dishName = (mealPlan[`${dow}-dinner`] ?? '').trim()
          const isToday  = i === 0
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-center px-3 py-2 min-w-0"
              style={{
                borderRight: i < days.length - 1 ? '1px solid rgba(245,158,11,0.15)' : 'none',
                background: isToday ? 'rgba(245,158,11,0.18)' : 'transparent',
              }}
            >
              <span
                className="text-[11px] font-bold uppercase tracking-wide leading-none mb-1"
                style={{ color: isToday ? '#f59e0b' : 'var(--text-secondary)' }}
              >
                {isToday ? 'Tonight' : `${DAY_SHORT[dow]} ${d.getDate()}`}
              </span>
              <span
                className="text-sm leading-snug truncate w-full text-center"
                style={{
                  color: dishName ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontStyle: dishName ? 'normal' : 'italic',
                  opacity: dishName ? 1 : 0.5,
                }}
                title={dishName || 'No dinner planned'}
              >
                {dishName || '—'}
              </span>
            </div>
          )
        })}
      </div>
    </button>
  )
}
