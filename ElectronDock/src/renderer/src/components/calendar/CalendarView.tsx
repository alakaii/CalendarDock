import { useState, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, DateClickArg, EventInput } from '@fullcalendar/core'
import { format } from 'date-fns'
import { useCalendars } from '../../hooks/useCalendars'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useSettingsStore } from '../../store/settings.slice'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import EventPopover from './EventPopover'
import AddEventModal from './AddEventModal'
import type { CalendarEvent } from '../../../../preload/types'

type CalView = 'dayGridMonth' | 'timeGridWeek'

export default function CalendarView() {
  const calendarRef  = useRef<FullCalendar>(null)
  const containerRef = useRef<HTMLDivElement>(null!)
  const [currentDate, setCurrentDate]   = useState(new Date())
  const [view, setView]                 = useState<CalView>('timeGridWeek')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [addEventDate, setAddEventDate]   = useState<string | null>(null)

  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)
  const { data: calendars = [] } = useCalendars()
  const { data: events = [] }    = useCalendarEvents(currentDate, calendars)

  // Filter out hidden calendars
  const visibleEvents = events.filter((ev) => calendarPreferences[ev.calendarId]?.visible !== false)

  // Pick black or white text based on the event background luminance
  function contrastColor(hex: string): string {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16) || 0
    const g = parseInt(h.slice(2, 4), 16) || 0
    const b = parseInt(h.slice(4, 6), 16) || 0
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.55 ? '#1a1a2e' : '#ffffff'
  }

  // Convert to FullCalendar format
  const fcEvents: EventInput[] = visibleEvents.map((ev) => {
    const cal = calendars.find((c) => c.id === ev.calendarId)
    const colorOverride = calendarPreferences[ev.calendarId]?.colorOverride
    const bg = colorOverride ?? cal?.backgroundColor ?? '#4285F4'
    return {
      id: ev.id,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay,
      backgroundColor: bg,
      borderColor: bg,
      textColor: contrastColor(bg),
      extendedProps: { event: ev }
    }
  })

  const handleNavigate = useCallback((dir: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (dir === 'prev') api.prev()
    else if (dir === 'next') api.next()
    else api.today()
    setCurrentDate(api.getDate())
  }, [])

  const handleViewChange = (v: CalView) => {
    setView(v)
    calendarRef.current?.getApi().changeView(v)
  }

  useSwipeGesture(containerRef, {
    onSwipeLeft:  () => handleNavigate('next'),
    onSwipeRight: () => handleNavigate('prev')
  })

  const handleEventClick = (arg: EventClickArg) => {
    setSelectedEvent(arg.event.extendedProps.event as CalendarEvent)
  }

  const handleDateClick = (arg: DateClickArg) => {
    setAddEventDate(arg.dateStr)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-surface)' }}>

      {/* Internal calendar toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {/* Month / week label + Today */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {view === 'dayGridMonth'
              ? format(currentDate, 'MMMM yyyy')
              : format(currentDate, 'MMMM yyyy')
            }
          </span>
          <button
            onClick={() => handleNavigate('today')}
            className="text-xs px-2.5 py-1 rounded-md font-semibold"
            style={{ color: '#3b82f6' }}
          >
            Today
          </button>
        </div>

        {/* View toggle: Week | Month */}
        <div
          className="flex rounded-lg overflow-hidden text-sm"
          style={{ border: '1px solid var(--border)' }}
        >
          {(['timeGridWeek', 'dayGridMonth'] as CalView[]).map((v) => (
            <button
              key={v}
              onClick={() => handleViewChange(v)}
              className="px-4 py-1.5 font-medium transition-colors min-h-[36px]"
              style={{
                background: view === v ? '#3b82f6' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {v === 'timeGridWeek' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-1">
          {(['prev', 'next'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => handleNavigate(dir)}
              className="p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              style={{ color: 'var(--text-secondary)' }}
              aria-label={dir === 'prev' ? 'Previous' : 'Next'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d={dir === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* FullCalendar */}
      <div ref={containerRef} className="flex-1 overflow-hidden p-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={false}
          events={fcEvents}
          height="100%"
          eventDisplay="block"
          dayMaxEvents={4}
          nowIndicator={true}
          scrollTime="08:00:00"
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short', hour12: true }}
        />
      </div>

      {selectedEvent && (
        <EventPopover
          event={selectedEvent}
          calendars={calendars}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {addEventDate && (
        <AddEventModal
          defaultDate={addEventDate}
          calendars={calendars}
          onClose={() => setAddEventDate(null)}
        />
      )}
    </div>
  )
}
