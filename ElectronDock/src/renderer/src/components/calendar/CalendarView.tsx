import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, DateClickArg, EventInput } from '@fullcalendar/core'
import { useCalendars } from '../../hooks/useCalendars'
import { useEffectiveTheme } from '../../hooks/useTheme'
import { eventColor } from '../../utils/eventColors'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'
import { useDragSwipe, type DragAxis } from '../../hooks/useDragSwipe'
import { calendarBridge } from '../../bridge/calendarBridge'
import EventPopover from './EventPopover'
import AddEventModal from './AddEventModal'
import type { CalendarEvent } from '../../../../preload/types'

type CalView = 'dayGridMonth' | 'timeGridWeek'

export default function CalendarView() {
  const calendarRef  = useRef<FullCalendar>(null)
  const containerRef = useRef<HTMLDivElement>(null!)
  const fcWrapRef    = useRef<HTMLDivElement>(null)

  const [currentDate, setCurrentDate]     = useState(new Date())
  const [view, setView]                   = useState<CalView>('timeGridWeek')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [addEventDate, setAddEventDate]   = useState<string | null>(null)
  // Exact slot height in px, computed from the actual rendered scroller height
  const [slotPx, setSlotPx]               = useState<number | null>(null)

  const calendarPreferences  = useSettingsStore((s) => s.calendarPreferences)
  const calendarSwipeWeek    = useSettingsStore((s) => s.calendarSwipeWeek)
  const calendarSwipeMonth   = useSettingsStore((s) => s.calendarSwipeMonth)
  const theme                = useEffectiveTheme()
  const chipHiddenIds        = useUIStore((s) => s.chipHiddenIds)
  const setCalendarDate      = useUIStore((s) => s.setCalendarDate)
  const setCalendarView      = useUIStore((s) => s.setCalendarView)
  const { data: calendars = [] } = useCalendars()
  const { data: events = [] }    = useCalendarEvents(currentDate, calendars)

  // Filter: settings-level exclusions AND session chip-level hides
  const visibleEvents = events.filter((ev) =>
    calendarPreferences[ev.calendarId]?.visible !== false &&
    !chipHiddenIds.has(ev.calendarId)
  )

  // Dynamically compute the visible hour range.
  // Baseline 7am–7pm; expands by whole hours to contain any visible timed event.
  const { slotMinTime, slotMaxTime, numSlots } = useMemo(() => {
    const pad = (h: number) => `${String(h).padStart(2, '0')}:00:00`
    if (view !== 'timeGridWeek') {
      return { slotMinTime: pad(7), slotMaxTime: pad(19), numSlots: 24 }
    }

    let minH = 7
    let maxH = 19

    for (const ev of visibleEvents) {
      if (ev.allDay) continue
      const start  = new Date(ev.start)
      const end    = new Date(ev.end)
      const startH = start.getHours() + start.getMinutes() / 60
      const endH   = end.getHours()   + end.getMinutes()   / 60
      if (startH < minH) minH = Math.max(0,  Math.floor(startH))
      if (endH   > maxH) maxH = Math.min(24, Math.ceil(endH))
    }

    return { slotMinTime: pad(minH), slotMaxTime: pad(maxH), numSlots: (maxH - minH) * 2 }
  }, [visibleEvents, view])

  // After each render (and whenever the range or view changes), measure the
  // actual height of FullCalendar's scroll body and compute the exact slot px
  // so all slots fit perfectly with zero scroll.
  useEffect(() => {
    if (view !== 'timeGridWeek') { setSlotPx(null); return }

    const measure = () => {
      const wrap = fcWrapRef.current
      if (!wrap) return
      // .fc-scroller-harness is the element whose clientHeight = available space for time slots
      const harness = wrap.querySelector<HTMLElement>('.fc-scroller-harness')
      if (!harness) return
      const h = harness.clientHeight
      if (h > 0 && numSlots > 0) {
        setSlotPx(Math.floor(h / numSlots))
      }
    }

    // Let FullCalendar finish its own render/layout pass before measuring
    const id = setTimeout(measure, 0)
    return () => clearTimeout(id)
  }, [slotMinTime, slotMaxTime, numSlots, view, visibleEvents.length])

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
    const cal  = calendars.find((c) => c.id === ev.calendarId)
    const pref = calendarPreferences[ev.calendarId]
    const bg   = eventColor(ev, cal, pref, theme)
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
    const newDate = api.getDate()
    setCurrentDate(newDate)
    setCalendarDate(newDate)
  }, [setCalendarDate])

  const handleViewChange = useCallback((v: CalView) => {
    setView(v)
    setCalendarView(v)
    calendarRef.current?.getApi().changeView(v)
  }, [setCalendarView])

  // Register imperative bridge handlers so AppHeader can drive this calendar
  useEffect(() => {
    calendarBridge.navigate   = handleNavigate
    calendarBridge.changeView = handleViewChange
    return () => {
      calendarBridge.navigate   = null
      calendarBridge.changeView = null
    }
  }, [handleNavigate, handleViewChange])

  const swipeMode    = view === 'timeGridWeek' ? calendarSwipeWeek : calendarSwipeMonth
  const horizontalOn = swipeMode === 'horizontal' || swipeMode === 'both'
  const verticalOn   = swipeMode === 'vertical'   || swipeMode === 'both'

  const allowedAxes = useMemo<DragAxis[]>(() => {
    const out: DragAxis[] = []
    if (horizontalOn) out.push('x')
    if (verticalOn)   out.push('y')
    return out
  }, [horizontalOn, verticalOn])

  // ── Live drag-to-navigate state machine ──
  // The user drags the calendar wrapper around with their finger; on release,
  // we either (a) animate it off-screen + swap the period + slide back in
  // from the other side, or (b) spring back to center.
  const [offset, setOffset]               = useState({ x: 0, y: 0 })
  const [transitioning, setTransitioning] = useState(false)
  const transitioningRef                  = useRef(false)
  transitioningRef.current = transitioning

  const SLIDE_DURATION_MS = 250

  const animateBackToZero = () => {
    setTransitioning(true)
    setOffset({ x: 0, y: 0 })
    setTimeout(() => setTransitioning(false), SLIDE_DURATION_MS)
  }

  const commitSlide = (axis: DragAxis, dir: -1 | 1) => {
    const W = containerRef.current?.clientWidth  ?? window.innerWidth
    const H = containerRef.current?.clientHeight ?? window.innerHeight

    // Phase 1: animate off-screen in the direction the user swiped.
    setTransitioning(true)
    setOffset({
      x: axis === 'x' ? dir * W : 0,
      y: axis === 'y' ? dir * H : 0,
    })

    // Phase 2 (after the slide-out completes):
    setTimeout(() => {
      // dir = -1 → swiped left/up = next period; dir = +1 → right/down = prev.
      handleNavigate(dir < 0 ? 'next' : 'prev')

      // Snap to the opposite side instantly (no transition).
      setTransitioning(false)
      setOffset({
        x: axis === 'x' ? -dir * W : 0,
        y: axis === 'y' ? -dir * H : 0,
      })

      // Phase 3 (next paint): animate back to 0 from the opposite side.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitioning(true)
          setOffset({ x: 0, y: 0 })
          setTimeout(() => setTransitioning(false), SLIDE_DURATION_MS)
        })
      })
    }, SLIDE_DURATION_MS)
  }

  useDragSwipe(containerRef, {
    enabled: allowedAxes.length > 0,
    axes:    allowedAxes,
    onDragMove: (dx, dy) => {
      if (transitioningRef.current) return
      setOffset({ x: dx, y: dy })
    },
    onDragEnd: (_dx, _dy, axis, dir) => {
      if (transitioningRef.current) return
      if (dir === 0) animateBackToZero()
      else           commitSlide(axis, dir)
    },
  })

  const handleEventClick = (arg: EventClickArg) => {
    setSelectedEvent(arg.event.extendedProps.event as CalendarEvent)
  }

  const handleDateClick = (arg: DateClickArg) => {
    setAddEventDate(arg.dateStr)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-surface)' }}>
      {/* FullCalendar — fills all remaining height */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <div
          ref={fcWrapRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            transition: transitioning ? `transform ${SLIDE_DURATION_MS}ms ease-out` : 'none',
            willChange: 'transform',
          }}
        >
          {/* Force exact slot height so all slots fit without scrolling.
              overflow:hidden kills the reserved scrollbar gutter. */}
          {slotPx !== null && (
            <style>{`
              .fc-timegrid-slot         { height: ${slotPx}px !important; }
              .fc-timegrid .fc-scroller { overflow: hidden !important; }
            `}</style>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={false}
            events={fcEvents}
            height="100%"
            expandRows={true}
            eventDisplay="block"
            dayMaxEvents={4}
            nowIndicator={true}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
            slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short', hour12: true }}
          />
        </div>
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
