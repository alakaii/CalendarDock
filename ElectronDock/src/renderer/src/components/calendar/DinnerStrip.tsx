import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
 * Tapping any day cell opens a centered modal with a large input — much
 * better for typing on the kiosk's touchscreen + virtual keyboard than a
 * cramped inline input would be. The 🍽️ DINNER label on the left still
 * routes to the full Meals page for editing the weekly rotation.
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

  const [editingDate, setEditingDate] = useState<Date | null>(null)

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

  function weeklyDefaultFor(d: Date): string {
    return (mealPlan[`${d.getDay()}-dinner`] ?? '').trim()
  }

  function dateOverrideFor(d: Date): string {
    return (mealPlan[`${dateKey(d)}-dinner`] ?? '').trim()
  }

  return (
    <>
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
          <span className="text-[20px] leading-none mb-0.5">🍽️</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>
            Dinner
          </span>
        </button>

        {/* 7 day columns, equal-width, today is accented */}
        <div className="flex-1 flex">
          {days.map((d, i) => {
            const isToday = i === 0
            const value   = dinnerFor(d)
            return (
              <button
                key={dateKey(d)}
                onClick={() => setEditingDate(d)}
                className="flex-1 flex flex-col items-center justify-center px-3 py-2 min-w-0 transition-colors hover:bg-amber-500/10 active:bg-amber-500/15"
                style={{
                  borderRight: i < days.length - 1 ? '1px solid rgba(245,158,11,0.15)' : 'none',
                  background: isToday ? 'rgba(245,158,11,0.18)' : 'transparent',
                }}
                title={value ? `${isToday ? 'Tonight' : DAY_SHORT[d.getDay()]}: ${value} (tap to edit)` : `Tap to plan dinner`}
              >
                <span
                  className="text-[11px] font-bold uppercase tracking-wide leading-none mb-1"
                  style={{ color: isToday ? '#f59e0b' : 'var(--text-secondary)' }}
                >
                  {isToday ? 'Tonight' : `${DAY_SHORT[d.getDay()]} ${d.getDate()}`}
                </span>
                <span
                  className="text-sm leading-snug truncate w-full text-center"
                  style={{
                    color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontStyle: value ? 'normal' : 'italic',
                    opacity: value ? 1 : 0.5,
                  }}
                >
                  {value || '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {editingDate && (
        <DinnerEditModal
          date={editingDate}
          isToday={dateKey(editingDate) === dateKey(now)}
          weeklyDefault={weeklyDefaultFor(editingDate)}
          override={dateOverrideFor(editingDate)}
          onSaveOverride={(next) => {
            setMealCell(`${dateKey(editingDate)}-dinner`, next)
            setEditingDate(null)
          }}
          onClearOverride={() => {
            setMealCell(`${dateKey(editingDate)}-dinner`, '')
            setEditingDate(null)
          }}
          onClose={() => setEditingDate(null)}
        />
      )}
    </>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────

function DinnerEditModal({
  date,
  isToday,
  weeklyDefault,
  override,
  onSaveOverride,
  onClearOverride,
  onClose,
}: {
  date:           Date
  isToday:        boolean
  weeklyDefault:  string
  override:       string
  onSaveOverride: (next: string) => void
  onClearOverride:() => void
  onClose:        () => void
}) {
  // Seed the input with the override if there is one; otherwise the weekly
  // default — so a tap with a default of "Tacos" lets you edit "Tacos" without
  // retyping. If they save it unchanged, it becomes an override that just
  // happens to equal the default — harmless.
  const initial = override || weeklyDefault
  const [draft, setDraft] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Autofocus + select all so the existing text is replaceable in one tap
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
  }, [])

  // Close on Escape (anywhere) — Enter to save handled on the input itself
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dayLabel = isToday
    ? `Tonight · ${DAY_LONG[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`
    : `${DAY_LONG[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`

  const trimmed   = draft.trim()
  const unchanged = trimmed === initial.trim()
  const hasOverride = override.length > 0

  const submit = () => {
    if (unchanged) { onClose(); return }
    if (!trimmed) {
      // Empty input → clear the override (falls back to weekly default)
      onClearOverride()
    } else {
      onSaveOverride(trimmed)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--card-border)',
          width: 'min(560px, 92vw)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — close button top-right, content centered */}
        <div className="relative px-8 pt-8 pb-2 flex flex-col items-center text-center">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-[40px] leading-none mb-2">🍽️</span>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
            Dinner
          </span>
          <span className="text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
            {dayLabel}
          </span>
        </div>

        {/* Input */}
        <div className="px-8 pt-4">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit() }
            }}
            placeholder="What's for dinner?"
            className="w-full text-xl rounded-xl outline-none text-center"
            style={{
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              border: '2px solid #f59e0b',
              padding: '14px 16px',
              caretColor: '#f59e0b',
            }}
          />
          {weeklyDefault && (
            <p className="mt-3 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              Weekly default for {DAY_LONG[date.getDay()]}: <span className="font-medium">{weeklyDefault}</span>
            </p>
          )}
        </div>

        {/* Action row */}
        <div className="px-8 py-6 flex items-center justify-end gap-2 flex-wrap">
          {hasOverride && (
            <button
              onClick={onClearOverride}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
              style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
              title="Clear this date's override and use the weekly default"
            >
              Use weekly default
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
            style={{ background: '#f59e0b', color: '#fff' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
