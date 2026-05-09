import { useState } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { useCalendars } from '../../hooks/useCalendars'
import { eventColor } from '../../utils/eventColors'
import type { CalendarEvent } from '../../../../preload/types'
import type { StandbyCorner } from '../../../../preload/types'

interface Props {
  corner: StandbyCorner
}

const CalIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)

export default function TodayEventsDrawer({ corner }: Props) {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()
  const { data: calendars = [] } = useCalendars()

  const isBottom = corner.startsWith('bottom')

  // Pull today's events from TanStack Query cache
  const allCachedData = queryClient.getQueriesData<CalendarEvent[]>({ queryKey: ['events'] })
  const todayEvents: CalendarEvent[] = []
  const today = new Date()

  for (const [, data] of allCachedData) {
    if (!data) continue
    for (const ev of data) {
      try {
        const start = parseISO(ev.start)
        if (isToday(start) || (ev.allDay && ev.start === format(today, 'yyyy-MM-dd'))) {
          if (!todayEvents.find((e) => e.id === ev.id)) {
            todayEvents.push(ev)
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  todayEvents.sort((a, b) => {
    if (a.allDay && !b.allDay) return -1
    if (!a.allDay && b.allDay) return 1
    return a.start.localeCompare(b.start)
  })

  const count = todayEvents.length

  const trigger = (
    <button
      onPointerDown={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
      className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/50 backdrop-blur-md
                 border border-white/20 text-white/90 text-sm font-medium hover:bg-black/60
                 transition-colors min-h-[44px]"
    >
      <CalIcon />
      <span>
        {count === 0 ? 'No events today' : `${count} event${count !== 1 ? 's' : ''} today`}
      </span>
      <span className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-white/20
                       text-xs font-bold flex-shrink-0">
        {expanded ? '−' : '+'}
      </span>
    </button>
  )

  const list = expanded && count > 0 ? (
    <div className="w-72 max-h-[40vh] overflow-y-auto rounded-xl bg-black/50 backdrop-blur-md
                    border border-white/20 p-3 space-y-2">
      {todayEvents.map((ev) => {
        const cal   = calendars.find((c) => c.id === ev.calendarId)
        const color = eventColor(ev.colorId, cal?.backgroundColor)
        return (
          <div key={ev.id} className="flex items-start gap-2 py-1">
            <div
              className="w-1 rounded-full flex-shrink-0 self-stretch min-h-[20px]"
              style={{ backgroundColor: color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{ev.title}</div>
              <div className="text-white/50 text-xs">
                {ev.allDay ? 'All day' : (() => {
                  try { return format(parseISO(ev.start), 'h:mm a') } catch { return '' }
                })()}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-2">
      {/* Bottom corners: list floats above trigger; top corners: list drops below trigger */}
      {isBottom ? (
        <>
          {list}
          {trigger}
        </>
      ) : (
        <>
          {trigger}
          {list}
        </>
      )}
    </div>
  )
}
