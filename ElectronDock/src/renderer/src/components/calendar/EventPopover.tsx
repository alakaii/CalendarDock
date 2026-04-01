import { format, parseISO } from 'date-fns'
import { TouchButton } from '../shared/TouchButton'
import type { CalendarEvent, CalendarListItem } from '../../../../preload/types'
interface EventPopoverProps {
  event: CalendarEvent
  calendars: CalendarListItem[]
  onClose: () => void
}

export default function EventPopover({ event, calendars, onClose }: EventPopoverProps) {
  const cal = calendars.find((c) => c.id === event.calendarId)
  const color = cal?.backgroundColor ?? '#4285F4'

  const formatEventTime = () => {
    if (event.allDay) return 'All day'
    try {
      const start = parseISO(event.start)
      const end = parseISO(event.end)
      return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`
    } catch {
      return ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-lg w-full border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color strip + title */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <div>
            <h2 className="text-xl font-semibold leading-tight">{event.title}</h2>
            <p className="text-sm text-white/60 mt-1">{cal?.summary ?? 'Calendar'}</p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-white/80 mb-3">
          <svg className="w-5 h-5 flex-shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatEventTime()}</span>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-sm text-white/70 leading-relaxed mb-4">{event.description}</p>
        )}

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <svg className="w-4 h-4 flex-shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{event.location}</span>
          </div>
        )}

        <div className="flex justify-end">
          <TouchButton variant="ghost" onClick={onClose}>Close</TouchButton>
        </div>
      </div>
    </div>
  )
}
