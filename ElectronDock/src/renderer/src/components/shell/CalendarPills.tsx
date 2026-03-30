import { useCalendars } from '../../hooks/useCalendars'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'

export default function CalendarPills() {
  const activePage = useUIStore((s) => s.activePage)
  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)
  const setCalendarVisible = useSettingsStore((s) => s.setCalendarVisible)
  const { data: calendars = [] } = useCalendars()

  // Only show pills on the calendar page
  if (activePage !== 'calendar') return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {calendars.map((cal) => {
        const pref = calendarPreferences[cal.id]
        const visible = pref?.visible !== false
        const color = pref?.colorOverride ?? cal.backgroundColor

        return (
          <button
            key={cal.id}
            onClick={() => setCalendarVisible(cal.id, !visible)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              transition-all duration-150 min-h-[32px] border
              ${visible ? 'text-white border-transparent' : 'bg-transparent border-current opacity-50'}
            `}
            style={
              visible
                ? { backgroundColor: color, borderColor: color }
                : { color, borderColor: color }
            }
            aria-pressed={visible}
            aria-label={`${visible ? 'Hide' : 'Show'} ${cal.summary}`}
          >
            {/* Dot indicator */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: visible ? 'rgba(255,255,255,0.8)' : color }}
            />
            <span className="max-w-[100px] truncate">{cal.summary}</span>
          </button>
        )
      })}
    </div>
  )
}
