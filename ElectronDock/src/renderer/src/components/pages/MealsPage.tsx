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

const SLOT_ICONS: Record<Slot, string>  = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }
const SLOT_NAMES: Record<Slot, string>  = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

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
        className="w-full resize-none text-base rounded-lg px-2 py-2 outline-none leading-snug text-center"
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
      className="w-full text-base rounded-lg px-2 py-2 cursor-pointer leading-snug transition-colors text-center"
      style={{
        minHeight: 96,
        background: CELL_BG[dayStatus],
        border: '1px solid transparent',
        color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
        opacity: value ? textOpacity : textOpacity * 0.6,
        fontWeight: dayStatus === 'today' ? 700 : 400,
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

// ── Fridge panel ─────────────────────────────────────────────────────────────

function FridgeCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="—"
      className="flex-1 min-w-0 text-base px-3 bg-transparent outline-none"
      style={{
        color: 'var(--text-primary)',
        height: 40,
        caretColor: '#3b82f6',
      }}
    />
  )
}

function FridgePanel({ title, storagePrefix, mealPlan, setMealCell }: {
  title: string
  storagePrefix: string
  mealPlan: Record<string, string>
  setMealCell: (key: string, value: string) => void
}) {
  const accountId  = useSettingsStore((s) => s.fridgeGoogleAccountId)
  const taskListId = useSettingsStore((s) => s.fridgeGoogleTaskListId)
  const isLinked   = !!(accountId && taskListId)

  const [draft, setDraft] = useState('')

  // Google Tasks — enabled only when fully configured
  const filter = isLinked ? { accountId, taskListId, showCompleted: true } : null
  const { data: tasks = [], isLoading } = useGoogleTasks(filter)
  const createTask  = useCreateTask()
  const setComplete = useSetTaskComplete()
  const removeTask  = useDeleteTask()

  const active = tasks.filter((t) => t.status !== 'completed')
  const done   = tasks.filter((t) => t.status === 'completed')

  const handleAdd = () => {
    const text = draft.trim()
    if (!text) return
    createTask.mutate({ accountId, taskListId, title: text })
    setDraft('')
  }

  // Local mode: dynamic row count
  let maxFilledRow = -1
  for (let r = 0; r < 100; r++) {
    if (mealPlan[`${storagePrefix}-r${r}-c0`] || mealPlan[`${storagePrefix}-r${r}-c1`]) {
      maxFilledRow = r
    }
  }
  const rowCount = Math.max(2, maxFilledRow + 2)

  return (
    <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>

      {/* ── Header ── */}
      <h3
        className="text-xs font-bold uppercase tracking-widest py-2 text-center"
        style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        {title}
      </h3>

      {/* ── Local mode: free-text rows ── */}
      {!isLinked && Array.from({ length: rowCount }, (_, row) => (
        <div
          key={row}
          className="flex items-center"
          style={{ borderTop: row > 0 ? '1px solid var(--border)' : undefined }}
        >
          <FridgeCell
            value={mealPlan[`${storagePrefix}-r${row}-c0`] ?? ''}
            onChange={(v) => setMealCell(`${storagePrefix}-r${row}-c0`, v)}
          />
          <div className="flex-shrink-0 w-px self-stretch" style={{ background: 'var(--border)' }} />
          <FridgeCell
            value={mealPlan[`${storagePrefix}-r${row}-c1`] ?? ''}
            onChange={(v) => setMealCell(`${storagePrefix}-r${row}-c1`, v)}
          />
        </div>
      ))}

      {/* ── Google Tasks mode ── */}
      {isLinked && (
        <>
          {isLoading && (
            <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              Loading…
            </div>
          )}
          {!isLoading && active.length === 0 && done.length === 0 && (
            <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              Nothing here yet
            </div>
          )}

          {/* Active tasks */}
          {active.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-3"
              style={{ borderTop: i === 0 ? undefined : '1px solid var(--border)', minHeight: 40 }}
            >
              <button
                onClick={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: true })}
                className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all"
                style={{ borderColor: 'var(--text-secondary)' }}
                aria-label="Mark done"
              />
              <span className="flex-1 text-base" style={{ color: 'var(--text-primary)' }}>{t.title}</span>
              <button
                onClick={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
                className="p-1 rounded opacity-40 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Completed tasks */}
          {done.length > 0 && (
            <>
              <p
                className="px-3 pt-2 pb-0.5 text-xs font-semibold"
                style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}
              >
                DONE ({done.length})
              </p>
              {done.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 px-3 opacity-40"
                  style={{ minHeight: 36 }}
                >
                  <button
                    onClick={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: false })}
                    className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                    style={{ background: '#22c55e', borderColor: '#22c55e' }}
                    aria-label="Unmark done"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <span className="flex-1 text-sm line-through" style={{ color: 'var(--text-secondary)' }}>{t.title}</span>
                  <button
                    onClick={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
                    className="p-1 rounded opacity-40 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Add new item */}
          <div
            className="flex items-center gap-2 px-3"
            style={{ borderTop: '1px solid var(--border)', minHeight: 40 }}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add item…"
              className="flex-1 bg-transparent text-base outline-none placeholder:opacity-40"
              style={{ color: 'var(--text-primary)', caretColor: '#3b82f6' }}
            />
            <button
              onClick={handleAdd}
              disabled={!draft.trim() || createTask.isPending}
              className="text-lg leading-none px-1 transition-opacity disabled:opacity-20"
              style={{ color: '#3b82f6', opacity: draft.trim() ? 0.8 : 0.4 }}
              aria-label="Add item"
            >
              +
            </button>
          </div>
        </>
      )}
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
  const mealPlan        = useSettingsStore((s) => s.mealPlan)
  const setMealCell     = useSettingsStore((s) => s.setMealCell)
  const mealsFontSize   = useSettingsStore((s) => s.mealsFontSize)
  const setMealsFontSize = useSettingsStore((s) => s.setMealsFontSize)

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--bg-base)', fontSize: `${mealsFontSize}rem` }}>
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
                  className="pr-3 py-4 align-middle"
                  style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xl leading-none">{SLOT_ICONS[slot]}</span>
                    <span className="text-sm font-semibold uppercase tracking-wide">{SLOT_NAMES[slot]}</span>
                  </div>
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

        {/* Font size slider */}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>A</span>
          <input
            type="range"
            min={0.75}
            max={1.75}
            step={0.05}
            value={mealsFontSize}
            onChange={(e) => setMealsFontSize(parseFloat(e.target.value))}
            className="w-32"
            style={{ accentColor: '#3b82f6' }}
          />
          <span className="text-base flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>A</span>
          <p className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
            Tap any cell to edit. Changes save automatically.
          </p>
        </div>

        {/* Fridge panels */}
        <div className="flex gap-5 mt-6 mx-12">
          <FridgePanel
            title="House Fridge"
            storagePrefix="fridge-house"
            mealPlan={mealPlan}
            setMealCell={setMealCell}
          />
          <FridgePanel
            title="Garage Fridge"
            storagePrefix="fridge-garage"
            mealPlan={mealPlan}
            setMealCell={setMealCell}
          />
        </div>
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
