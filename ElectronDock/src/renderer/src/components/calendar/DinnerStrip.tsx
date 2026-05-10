import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** YYYY-MM-DD in local time (not UTC — we want "today" to roll at local midnight). */
function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Bottom-of-CalendarView strip showing the next 7 days of planned dinners.
 *
 * Two-layer mealPlan model:
 *   - `${dow}-dinner`        — weekly default (set on the Meals page).
 *                              Repeats every week.
 *   - `${YYYY-MM-DD}-dinner` — date-specific override (set inline here).
 *                              Wins over the weekly default for that one day.
 *
 * This lets the Meals page stay the place to set up "we usually have tacos
 * on Tuesday" while the strip handles "but next Tuesday we're going out."
 *
 * Click the 🌙 DINNER label on the left to jump to Meals (for editing the
 * weekly rotation). Click any day cell to edit *that day's* dinner inline.
 */
export default function DinnerStrip() {
  const mealPlan    = useSettingsStore((s) => s.mealPlan)
  const setMealCell = useSettingsStore((s) => s.setMealCell)
  const setPage     = useUIStore((s) => s.setPage)

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

  /** Date-override wins; otherwise the weekly default for that day-of-week. */
  function dinnerFor(d: Date): string {
    const override = (mealPlan[`${dateKey(d)}-dinner`] ?? '').trim()
    if (override) return override
    return (mealPlan[`${d.getDay()}-dinner`] ?? '').trim()
  }

  return (
    <div
      className="flex-shrink-0 w-full flex items-stretch"
      style={{
        background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(245,158,11,0.14))',
        borderTop: '1px solid rgba(245,158,11,0.35)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Section label on the far left — taps through to Meals for the weekly rotation */}
      <button
        onClick={() => setPage('meals')}
        className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0 transition-colors hover:bg-amber-500/10 active:bg-amber-500/15"
        style={{ borderRight: '1px solid rgba(245,158,11,0.25)', minWidth: 96 }}
        aria-label="Edit weekly meal rotation"
        title="Edit weekly rotation"
      >
        <span className="text-[20px] leading-none mb-0.5">🌙</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>
          Dinner
        </span>
      </button>

      {/* 7 day columns, equal-width, today is accented. Each cell inline-edits
          its own date-specific override on tap. */}
      <div className="flex-1 flex">
        {days.map((d, i) => (
          <DayCell
            key={dateKey(d)}
            date={d}
            isToday={i === 0}
            isLast={i === days.length - 1}
            value={dinnerFor(d)}
            onCommit={(next) => setMealCell(`${dateKey(d)}-dinner`, next)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Per-day cell with click-to-edit ──────────────────────────────────────────

function DayCell({
  date,
  isToday,
  isLast,
  value,
  onCommit,
}: {
  date: Date
  isToday: boolean
  isLast: boolean
  value: string
  onCommit: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const inputRef              = useRef<HTMLInputElement>(null)

  // Keep draft in sync if the underlying value changes externally (e.g. the
  // Meals page edits the weekly default while we're not editing this cell).
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const commit = () => {
    setEditing(false)
    if (draft.trim() !== value.trim()) onCommit(draft.trim())
  }

  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  const dayLabel = isToday ? 'Tonight' : `${DAY_SHORT[date.getDay()]} ${date.getDate()}`

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-3 py-2 min-w-0"
      style={{
        borderRight: isLast ? 'none' : '1px solid rgba(245,158,11,0.15)',
        background: isToday ? 'rgba(245,158,11,0.18)' : 'transparent',
      }}
    >
      <span
        className="text-[11px] font-bold uppercase tracking-wide leading-none mb-1"
        style={{ color: isToday ? '#f59e0b' : 'var(--text-secondary)' }}
      >
        {dayLabel}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          placeholder="—"
          className="w-full text-sm leading-snug text-center rounded outline-none"
          style={{
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            border: '1px solid #f59e0b',
            padding: '2px 4px',
            caretColor: '#f59e0b',
          }}
        />
      ) : (
        <button
          onClick={startEdit}
          className="w-full text-sm leading-snug truncate text-center"
          style={{
            color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontStyle: value ? 'normal' : 'italic',
            opacity: value ? 1 : 0.5,
          }}
          title={value ? `${dayLabel}: ${value} (tap to edit)` : `${dayLabel} — tap to plan dinner`}
        >
          {value || '—'}
        </button>
      )}
    </div>
  )
}
