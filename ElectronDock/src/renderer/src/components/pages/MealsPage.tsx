import { useState, useRef } from 'react'
import { useSettingsStore } from '../../store/settings.slice'

// dayOfWeek: 0=Sun, 1=Mon, 2=Tue … 6=Sat (matches JS Date.getDay())
const DAYS: { short: string; long: string; dow: number }[] = [
  { short: 'Mon', long: 'Monday',    dow: 1 },
  { short: 'Tue', long: 'Tuesday',   dow: 2 },
  { short: 'Wed', long: 'Wednesday', dow: 3 },
  { short: 'Thu', long: 'Thursday',  dow: 4 },
  { short: 'Fri', long: 'Friday',    dow: 5 },
  { short: 'Sat', long: 'Saturday',  dow: 6 },
  { short: 'Sun', long: 'Sunday',    dow: 0 },
]

const SLOTS = ['breakfast', 'lunch', 'dinner'] as const
type Slot = typeof SLOTS[number]

const SLOT_LABELS: Record<Slot, string> = {
  breakfast: '🌅 Breakfast',
  lunch:     '☀️ Lunch',
  dinner:    '🌙 Dinner',
}

function cellKey(dow: number, slot: Slot) {
  return `${dow}-${slot}`
}

function todayDow() {
  return new Date().getDay()
}

// Editable cell that saves on blur/enter
function MealCell({
  value,
  placeholder,
  isToday,
  onChange
}: {
  value: string
  placeholder: string
  isToday: boolean
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const ref                   = useRef<HTMLTextAreaElement>(null)

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  const commit = () => {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
        }}
        rows={2}
        className="w-full resize-none text-sm rounded-lg px-2 py-1.5 outline-none leading-snug"
        style={{
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
          border: '1px solid #3b82f6',
          minHeight: 48
        }}
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      className={`
        w-full min-h-[48px] text-sm rounded-lg px-2 py-1.5 cursor-pointer leading-snug
        transition-colors
      `}
      style={{
        background: isToday ? 'rgba(59,130,246,0.08)' : 'transparent',
        border: '1px solid transparent',
        color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
        opacity: value ? 1 : 0.45,
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && startEdit()}
    >
      {value || placeholder}
    </div>
  )
}

export default function MealsPage() {
  const mealPlan    = useSettingsStore((s) => s.mealPlan)
  const setMealCell = useSettingsStore((s) => s.setMealCell)
  const todayDOW    = todayDow()

  return (
    <div
      className="h-full overflow-auto"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="p-4" style={{ minWidth: 700 }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {/* Slot label column */}
              <th className="w-28" />
              {DAYS.map((d) => (
                <th
                  key={d.dow}
                  className="pb-2 text-center text-xs font-bold uppercase tracking-widest"
                  style={{
                    color: d.dow === todayDOW ? '#3b82f6' : 'var(--text-secondary)',
                    paddingLeft: 4,
                    paddingRight: 4,
                  }}
                >
                  <span>{d.short}</span>
                  {d.dow === todayDOW && (
                    <span
                      className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                      style={{ background: '#3b82f6', color: '#fff' }}
                    >
                      •
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, si) => (
              <tr key={slot}>
                {/* Slot label */}
                <td
                  className="pr-3 py-2 text-xs font-semibold align-top pt-3"
                  style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                >
                  {SLOT_LABELS[slot]}
                </td>

                {DAYS.map((d) => {
                  const key   = cellKey(d.dow, slot)
                  const val   = mealPlan[key] ?? ''
                  const isToday = d.dow === todayDOW
                  return (
                    <td
                      key={d.dow}
                      className="py-1 px-1 align-top"
                      style={{
                        borderTop: si === 0 ? '1px solid var(--border)' : undefined,
                        borderLeft: '1px solid var(--border)',
                        background: isToday ? 'rgba(59,130,246,0.04)' : 'var(--bg-surface)',
                        minWidth: 100,
                      }}
                    >
                      <MealCell
                        value={val}
                        placeholder="—"
                        isToday={isToday}
                        onChange={(v) => setMealCell(key, v)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Tap any cell to edit. Changes save automatically. Today's column is highlighted in blue.
        </p>
      </div>
    </div>
  )
}
