import { useState, useRef } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import {
  useGoogleTasks,
  useCreateTask,
  useSetTaskComplete,
  useDeleteTask
} from '../../hooks/useGoogleTasks'

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

type DayStatus = 'past' | 'today' | 'future'

function cellKey(dow: number, slot: Slot) {
  return `${dow}-${slot}`
}

function todayDow() {
  return new Date().getDay()
}

/** Classify a column as past, today, or future relative to the DAYS array order (Mon → Sun). */
function getDayStatus(dow: number): DayStatus {
  const todayDOW  = todayDow()
  const todayIndex = DAYS.findIndex((d) => d.dow === todayDOW)
  const dayIndex   = DAYS.findIndex((d) => d.dow === dow)
  if (dayIndex === todayIndex) return 'today'
  if (dayIndex < todayIndex)  return 'past'
  return 'future'
}

// ── Editable cell ─────────────────────────────────────────────────────────────

const CELL_BG: Record<DayStatus, string> = {
  past:   'transparent',
  today:  'rgba(59,130,246,0.10)',
  future: 'transparent',
}

function MealCell({
  value,
  placeholder,
  dayStatus,
  onChange
}: {
  value: string
  placeholder: string
  dayStatus: DayStatus
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

  const textOpacity = dayStatus === 'today' ? 1 : dayStatus === 'future' ? 0.85 : 0.45

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
        rows={4}
        className="w-full resize-none text-sm rounded-lg px-2 py-2 outline-none leading-snug"
        style={{
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
          border: '1px solid #3b82f6',
          minHeight: 96
        }}
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      className="w-full text-sm rounded-lg px-2 py-2 cursor-pointer leading-snug transition-colors"
      style={{
        minHeight: 96,
        background: CELL_BG[dayStatus],
        border: '1px solid transparent',
        color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
        opacity: value ? textOpacity : textOpacity * 0.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && startEdit()}
    >
      {value || placeholder}
    </div>
  )
}

// ── Weekly grid tab ───────────────────────────────────────────────────────────

const COL_BG: Record<DayStatus, string> = {
  past:   'rgba(128,128,128,0.06)',
  today:  'rgba(59,130,246,0.06)',
  future: 'rgba(59,130,246,0.02)',
}

const HEADER_COLOR: Record<DayStatus, string> = {
  past:   'var(--text-secondary)',
  today:  '#3b82f6',
  future: 'var(--text-secondary)',
}

const HEADER_OPACITY: Record<DayStatus, number> = {
  past:   0.4,
  today:  1,
  future: 0.8,
}

function WeekGrid() {
  const mealPlan    = useSettingsStore((s) => s.mealPlan)
  const setMealCell = useSettingsStore((s) => s.setMealCell)

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="p-4 pt-8" style={{ minWidth: 700 }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-28" />
              {DAYS.map((d) => {
                const status = getDayStatus(d.dow)
                return (
                  <th
                    key={d.dow}
                    className="pb-2 text-center text-xs font-bold uppercase tracking-widest"
                    style={{
                      color:   HEADER_COLOR[status],
                      opacity: HEADER_OPACITY[status],
                      paddingLeft: 4,
                      paddingRight: 4,
                    }}
                  >
                    <span>{d.short}</span>
                    {status === 'today' && (
                      <span
                        className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                        style={{ background: '#3b82f6', color: '#fff', opacity: 1 }}
                      >
                        •
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, si) => (
              <tr key={slot}>
                <td
                  className="pr-3 py-2 text-xs font-semibold align-top pt-3"
                  style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                >
                  {SLOT_LABELS[slot]}
                </td>
                {DAYS.map((d) => {
                  const key    = cellKey(d.dow, slot)
                  const val    = mealPlan[key] ?? ''
                  const status = getDayStatus(d.dow)
                  return (
                    <td
                      key={d.dow}
                      className="py-1 px-1 align-top"
                      style={{
                        borderTop:  si === 0 ? '1px solid var(--border)' : undefined,
                        borderLeft: '1px solid var(--border)',
                        background: COL_BG[status],
                        minWidth: 100,
                      }}
                    >
                      <MealCell
                        value={val}
                        placeholder="—"
                        dayStatus={status}
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
          Tap any cell to edit. Changes save automatically.
        </p>
      </div>
    </div>
  )
}

// ── Google Tasks tab ──────────────────────────────────────────────────────────

function TasksTab() {
  const mealsGoogleAccountId  = useSettingsStore((s) => s.mealsGoogleAccountId)
  const mealsGoogleTaskListId = useSettingsStore((s) => s.mealsGoogleTaskListId)

  const filter = mealsGoogleAccountId && mealsGoogleTaskListId
    ? { accountId: mealsGoogleAccountId, taskListId: mealsGoogleTaskListId, showCompleted: true }
    : null

  const { data: tasks = [], isLoading } = useGoogleTasks(filter)
  const createTask  = useCreateTask()
  const setComplete = useSetTaskComplete()
  const removeTask  = useDeleteTask()
  const [draft, setDraft] = useState('')

  if (!mealsGoogleAccountId || !mealsGoogleTaskListId) {
    return (
      <div className="flex items-center justify-center h-full px-8">
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          No Google Tasks list linked. Go to Settings → Meals to link one.
        </p>
      </div>
    )
  }

  const handleAdd = () => {
    const title = draft.trim()
    if (!title) return
    createTask.mutate({ accountId: mealsGoogleAccountId, taskListId: mealsGoogleTaskListId, title })
    setDraft('')
  }

  const active = tasks.filter((t) => t.status !== 'completed')
  const done   = tasks.filter((t) => t.status === 'completed')

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {isLoading && (
          <p className="text-sm text-center py-12" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        )}
        {!isLoading && active.length === 0 && done.length === 0 && (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nothing here yet — add something below!
          </p>
        )}
        {active.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl min-h-[56px]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: true })}
              className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
              style={{ borderColor: 'var(--text-secondary)' }}
              aria-label="Mark done"
            />
            <span className="flex-1 text-base" style={{ color: 'var(--text-primary)' }}>
              {t.title}
            </span>
            <button
              onClick={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
              className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {done.length > 0 && (
          <>
            <p className="text-xs font-semibold mt-4 mb-1 px-1" style={{ color: 'var(--text-secondary)' }}>
              COMPLETED ({done.length})
            </p>
            {done.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl min-h-[56px] opacity-50"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <button
                  onClick={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: false })}
                  className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
                  style={{ background: '#22c55e', borderColor: '#22c55e' }}
                  aria-label="Unmark done"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <span className="flex-1 text-base line-through" style={{ color: 'var(--text-secondary)' }}>
                  {t.title}
                </span>
                <button
                  onClick={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
                  className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      <div
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a task…"
          className="flex-1 bg-transparent text-base outline-none placeholder:opacity-40"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim() || createTask.isPending}
          className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MealsPage() {
  const mealsGoogleAccountId  = useSettingsStore((s) => s.mealsGoogleAccountId)
  const mealsGoogleTaskListId = useSettingsStore((s) => s.mealsGoogleTaskListId)

  const hasGoogleList = !!(mealsGoogleAccountId && mealsGoogleTaskListId)
  const [activeTab, setActiveTab] = useState<'week' | 'tasks'>('week')

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* Tabs — only show if a Google Tasks list is linked */}
      {hasGoogleList && (
        <div
          className="flex flex-shrink-0 gap-1 px-4 pt-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {(['week', 'tasks'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-colors min-h-[44px]"
              style={{
                background: activeTab === tab ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              }}
            >
              {tab === 'week' ? '📅 Week' : '✅ Tasks'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(!hasGoogleList || activeTab === 'week') && <WeekGrid />}
        {hasGoogleList && activeTab === 'tasks' && <TasksTab />}
      </div>
    </div>
  )
}
