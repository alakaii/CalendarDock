import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCalendars } from '../../hooks/useCalendars'
import { useSettingsStore } from '../../store/settings.slice'
import type { CalendarListItem, CalendarPreference, CalendarSwipeDirection } from '../../../../preload/types'

// ── Drag-handle icon ──────────────────────────────────────────────────────────
const GripIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5.5" cy="4"  r="1.25" />
    <circle cx="5.5" cy="8"  r="1.25" />
    <circle cx="5.5" cy="12" r="1.25" />
    <circle cx="10.5" cy="4"  r="1.25" />
    <circle cx="10.5" cy="8"  r="1.25" />
    <circle cx="10.5" cy="12" r="1.25" />
  </svg>
)

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className="w-4 h-4 transition-transform"
    style={{ transform: open ? 'rotate(180deg)' : undefined }}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

// ── Single sortable row ───────────────────────────────────────────────────────
interface SortableRowProps {
  cal: CalendarListItem
  accountEmail: string
  pref: CalendarPreference | undefined
  expanded: boolean
  onToggleExpand: () => void
  onToggleVisible: () => void
  onSetOverride: (mode: 'light' | 'dark', color: string) => void
}

function SortableRow({
  cal,
  accountEmail,
  pref,
  expanded,
  onToggleExpand,
  onToggleVisible,
  onSetOverride,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  }

  const isVisible    = pref?.visible !== false
  const apiColor     = cal.backgroundColor
  const lightColor   = pref?.colorOverrideLight || apiColor
  const darkColor    = pref?.colorOverrideDark  || apiColor
  const lightCustom  = !!pref?.colorOverrideLight
  const darkCustom   = !!pref?.colorOverrideDark

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg select-none"
    >
      <div className="flex items-center gap-3 py-2 px-1">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 rounded cursor-grab active:cursor-grabbing"
          style={{ color: 'var(--text-secondary)', touchAction: 'none' }}
          aria-label="Drag to reorder"
          tabIndex={0}
        >
          <GripIcon />
        </button>

        {/* Color dot */}
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: apiColor, opacity: isVisible ? 1 : 0.35 }}
        />

        {/* Name + account */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm truncate"
            style={{ color: 'var(--text-primary)', opacity: isVisible ? 1 : 0.4 }}
          >
            {cal.summary}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            {accountEmail}
          </p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="p-1.5 rounded opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={expanded ? 'Hide colors' : 'Show colors'}
        >
          <ChevronIcon open={expanded} />
        </button>

        {/* Visibility checkbox */}
        <button
          onClick={onToggleVisible}
          className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            backgroundColor: isVisible ? apiColor : 'transparent',
            borderColor: isVisible ? apiColor : 'var(--text-secondary)',
          }}
          aria-label={isVisible ? 'Hide calendar' : 'Show calendar'}
        >
          {isVisible && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Color overrides */}
      {expanded && (
        <div
          className="ml-9 mr-1 mb-2 p-3 rounded-lg space-y-2"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              Light
            </span>
            <input
              type="color"
              value={lightColor}
              onChange={(e) => onSetOverride('light', e.target.value)}
              className="w-10 h-8 rounded cursor-pointer flex-shrink-0"
              style={{ background: 'transparent', border: '1px solid var(--border)' }}
            />
            <span className="text-xs font-mono flex-1" style={{ color: 'var(--text-secondary)' }}>
              {lightColor}
            </span>
            {lightCustom && (
              <button
                onClick={() => onSetOverride('light', '')}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border)' }}
                title="Reset to calendar default"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              Dark
            </span>
            <input
              type="color"
              value={darkColor}
              onChange={(e) => onSetOverride('dark', e.target.value)}
              className="w-10 h-8 rounded cursor-pointer flex-shrink-0"
              style={{ background: 'transparent', border: '1px solid var(--border)' }}
            />
            <span className="text-xs font-mono flex-1" style={{ color: 'var(--text-secondary)' }}>
              {darkColor}
            </span>
            {darkCustom && (
              <button
                onClick={() => onSetOverride('dark', '')}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border)' }}
                title="Reset to calendar default"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Swipe direction picker ───────────────────────────────────────────────────
const SWIPE_DIRECTIONS: { value: CalendarSwipeDirection; label: string }[] = [
  { value: 'horizontal', label: 'Left / Right' },
  { value: 'vertical',   label: 'Up / Down' },
  { value: 'both',       label: 'Both' },
]

function SwipeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: CalendarSwipeDirection
  onChange: (v: CalendarSwipeDirection) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {label}
      </label>
      <div className="grid grid-cols-3 gap-2">
        {SWIPE_DIRECTIONS.map((d) => {
          const isSel = value === d.value
          return (
            <button
              key={d.value}
              onClick={() => onChange(d.value)}
              className="px-3 py-2 rounded-lg text-xs font-semibold border transition-colors"
              style={{
                background:  isSel ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor: isSel ? '#3b82f6' : 'var(--border)',
                color:       isSel ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              {d.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CalendarSelector() {
  const { data: calendars = [], isLoading, isError, error, refetch } = useCalendars()
  const calendarPreferences        = useSettingsStore((s) => s.calendarPreferences)
  const calendarOrder              = useSettingsStore((s) => s.calendarOrder)
  const setCalendarVisible         = useSettingsStore((s) => s.setCalendarVisible)
  const setAllCalendarsVisible     = useSettingsStore((s) => s.setAllCalendarsVisible)
  const setCalendarOrder           = useSettingsStore((s) => s.setCalendarOrder)
  const setCalendarColorOverride   = useSettingsStore((s) => s.setCalendarColorOverride)
  const calendarSwipeWeek          = useSettingsStore((s) => s.calendarSwipeWeek)
  const calendarSwipeMonth         = useSettingsStore((s) => s.calendarSwipeMonth)
  const setCalendarSwipe           = useSettingsStore((s) => s.setCalendarSwipe)
  const accounts                   = useSettingsStore((s) => s.accounts)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // calendarId → account email
  const emailById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cal of calendars) {
      const acc = accounts.find((a) => a.id === cal.accountId)
      if (acc) map[cal.id] = acc.email
    }
    return map
  }, [calendars, accounts])

  const orderedCalendars = useMemo(() => {
    if (calendars.length === 0) return []
    const calMap = new Map(calendars.map((c) => [c.id, c]))
    const result: CalendarListItem[] = []
    for (const id of calendarOrder) {
      const cal = calMap.get(id)
      if (cal) result.push(cal)
    }
    const inOrder = new Set(calendarOrder)
    for (const cal of calendars) {
      if (!inOrder.has(cal.id)) result.push(cal)
    }
    return result
  }, [calendars, calendarOrder])

  const sortableIds = useMemo(() => orderedCalendars.map((c) => c.id), [orderedCalendars])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = sortableIds.indexOf(active.id as string)
      const newIndex = sortableIds.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return
      setCalendarOrder(arrayMove(sortableIds, oldIndex, newIndex))
    },
    [sortableIds, setCalendarOrder],
  )

  const labelStyle = { color: 'var(--text-primary)' }
  const subStyle   = { color: 'var(--text-secondary)' }

  // ── Loading / error / empty ───────────────────────────────────────────────

  if (isLoading) {
    return <p className="text-sm" style={subStyle}>Loading calendars...</p>
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : String(error)
    const isApiDisabled = msg.includes('has not been used') || msg.includes('disabled') || msg.includes('API')
    return (
      <div className="space-y-3 max-w-lg">
        <h3 className="text-lg font-semibold" style={labelStyle}>Calendars</h3>
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm font-semibold text-red-500 mb-1">Failed to load calendars</p>
          <p className="text-xs" style={subStyle}>{msg}</p>
        </div>
        {isApiDisabled && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs font-semibold text-blue-500 mb-1">Enable the Google Calendar API</p>
            <p className="text-xs" style={subStyle}>
              Go to <span className="font-mono">console.cloud.google.com</span> → APIs &amp; Services → Library →
              search "Google Calendar API" → Enable. Also enable "Tasks API" for the Lists tab.
            </p>
          </div>
        )}
        <button onClick={() => refetch()} className="text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors">
          Retry →
        </button>
      </div>
    )
  }

  if (accounts.length === 0) {
    return <p className="text-sm" style={subStyle}>No accounts connected. Add one in Accounts.</p>
  }

  if (calendars.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm" style={subStyle}>No calendars found.</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-blue-500 hover:text-blue-400">Retry →</button>
      </div>
    )
  }

  const allIds = calendars.map((c) => c.id)

  return (
    <div className="space-y-8 max-w-xl">
      <h3 className="text-lg font-semibold" style={labelStyle}>Calendars</h3>

      {/* ── Calendar list (sort + visibility + colors) ────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium" style={labelStyle}>Sort &amp; visibility</label>
            <p className="text-xs mt-0.5" style={subStyle}>
              Drag <strong>⠿</strong> to reorder. Tap the chevron to override the calendar's color
              for light or dark mode.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={subStyle}>All:</span>
            <button
              onClick={() => setAllCalendarsVisible(allIds, true)}
              className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
            >
              Show
            </button>
            <button
              onClick={() => setAllCalendarsVisible(allIds, false)}
              className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              Hide
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {orderedCalendars.map((cal) => {
                const pref = calendarPreferences[cal.id]
                return (
                  <SortableRow
                    key={cal.id}
                    cal={cal}
                    accountEmail={emailById[cal.id] ?? ''}
                    pref={pref}
                    expanded={expandedId === cal.id}
                    onToggleExpand={() =>
                      setExpandedId((cur) => (cur === cal.id ? null : cal.id))
                    }
                    onToggleVisible={() =>
                      setCalendarVisible(cal.id, pref?.visible === false)
                    }
                    onSetOverride={(mode, color) =>
                      setCalendarColorOverride(cal.id, mode, color)
                    }
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* ── Swipe direction ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>Swipe to navigate</label>
          <p className="text-xs mt-0.5" style={subStyle}>
            Direction(s) that move to the previous / next week or month.
          </p>
        </div>
        <SwipeRow
          label="Week view"
          value={calendarSwipeWeek}
          onChange={(v) => setCalendarSwipe('week', v)}
        />
        <SwipeRow
          label="Month view"
          value={calendarSwipeMonth}
          onChange={(v) => setCalendarSwipe('month', v)}
        />
      </section>
    </div>
  )
}
