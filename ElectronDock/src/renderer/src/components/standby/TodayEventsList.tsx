import { useState } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { useCalendars } from '../../hooks/useCalendars'
import { useEffectiveTheme } from '../../hooks/useTheme'
import { useSettingsStore } from '../../store/settings.slice'
import { eventColor } from '../../utils/eventColors'
import type { CalendarEvent } from '../../../../preload/types'

export default function TodayEventsList() {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()
  const { data: calendars = [] } = useCalendars()
  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)
  const theme               = useEffectiveTheme()

  // Pull today's events from any cached event queries
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

  return (
    <div className="bg-black/50 backdrop-blur-md border-t border-white/10">
      {/* Collapsed bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <span className="text-white/80 text-sm font-medium">
          {count === 0
            ? 'No events today'
            : `${count} event${count !== 1 ? 's' : ''} today`}
        </span>
        <button
          onPointerDown={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center
                     text-white/80 hover:bg-white/20 transition-colors text-lg font-bold"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Expanded list */}
      {expanded && todayEvents.length > 0 && (
        <div className="max-h-[40vh] overflow-y-auto px-6 pb-4 space-y-2">
          {todayEvents.map((ev) => {
            const cal   = calendars.find((c) => c.id === ev.calendarId)
            const pref  = calendarPreferences[ev.calendarId]
            const color = eventColor(ev, cal, pref, theme)
            return (
              <div key={ev.id} className="flex items-start gap-3 py-2">
                <div className="w-1 h-full min-h-[20px] rounded-full flex-shrink-0 mt-0.5"
                     style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{ev.title}</div>
                  <div className="text-white/50 text-sm">
                    {ev.allDay ? 'All day' : (() => {
                      try {
                        return format(parseISO(ev.start), 'h:mm a')
                      } catch {
                        return ''
                      }
                    })()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
