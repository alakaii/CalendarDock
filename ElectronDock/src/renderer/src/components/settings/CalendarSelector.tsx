import { useCallback, useMemo } from 'react'
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
import type { CalendarListItem } from '../../../../preload/types'

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

// ── Single sortable row ───────────────────────────────────────────────────────
interface SortableRowProps {
  cal: CalendarListItem
  accountEmail: string
  isVisible: boolean
  onToggle: () => void
}

function SortableRow({ cal, accountEmail, isVisible, onToggle }: SortableRowProps) {
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

  const color = cal.backgroundColor

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2 px-1 rounded-lg select-none"
    >
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
        style={{ backgroundColor: color, opacity: isVisible ? 1 : 0.35 }}
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

      {/* Visibility checkbox */}
      <button
        onClick={onToggle}
        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          backgroundColor: isVisible ? color : 'transparent',
          borderColor: isVisible ? color : 'var(--text-secondary)',
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
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CalendarSelector() {
  const { data: calendars = [], isLoading, isError, error, refetch } = useCalendars()
  const calendarPreferences    = useSettingsStore((s) => s.calendarPreferences)
  const calendarOrder          = useSettingsStore((s) => s.calendarOrder)
  const setCalendarVisible     = useSettingsStore((s) => s.setCalendarVisible)
  const setAllCalendarsVisible = useSettingsStore((s) => s.setAllCalendarsVisible)
  const setCalendarOrder       = useSettingsStore((s) => s.setCalendarOrder)
  const accounts               = useSettingsStore((s) => s.accounts)

  // calendarId → account email (for secondary label on each row)
  const emailById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cal of calendars) {
      const acc = accounts.find((a) => a.id === cal.accountId)
      if (acc) map[cal.id] = acc.email
    }
    return map
  }, [calendars, accounts])

  // Display order: saved order first, then any newly discovered calendars
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

  // ── Loading / error / empty ───────────────────────────────────────────────

  if (isLoading) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading calendars...</p>
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : String(error)
    const isApiDisabled = msg.includes('has not been used') || msg.includes('disabled') || msg.includes('API')
    return (
      <div className="space-y-3 max-w-lg">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Calendars</h3>
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm font-semibold text-red-500 mb-1">Failed to load calendars</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{msg}</p>
        </div>
        {isApiDisabled && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs font-semibold text-blue-500 mb-1">Enable the Google Calendar API</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
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
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No accounts connected. Add one in Accounts.</p>
  }

  if (calendars.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No calendars found.</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-blue-500 hover:text-blue-400">Retry →</button>
      </div>
    )
  }

  const allIds = calendars.map((c) => c.id)

  return (
    <div>
      {/* Header + global bulk controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Calendars</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>All:</span>
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

      {/* Sortable flat list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {orderedCalendars.map((cal) => (
              <SortableRow
                key={cal.id}
                cal={cal}
                accountEmail={emailById[cal.id] ?? ''}
                isVisible={calendarPreferences[cal.id]?.visible !== false}
                onToggle={() =>
                  setCalendarVisible(cal.id, calendarPreferences[cal.id]?.visible === false)
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="mt-4 text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
        Drag <strong>⠿</strong> to reorder pills left to right. Tap the checkbox to show or hide.
      </p>
    </div>
  )
}
