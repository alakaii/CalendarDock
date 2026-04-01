import { useCalendars } from '../../hooks/useCalendars'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'

export default function CalendarPills() {
  const activePage       = useUIStore((s) => s.activePage)
  const chipHiddenIds    = useUIStore((s) => s.chipHiddenIds)
  const toggleChipHidden = useUIStore((s) => s.toggleChipHidden)
  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)
  const { data: calendars = [] } = useCalendars()


  if (activePage !== 'calendar') return null

  // Only show calendars enabled in Settings → Calendars
  const enabledCalendars = calendars.filter((cal) => calendarPreferences[cal.id]?.visible !== false)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {enabledCalendars.map((cal) => {
        const color     = cal.backgroundColor
        const isHidden  = chipHiddenIds.has(cal.id)

        return (
          <button
            key={cal.id}
            onClick={() => toggleChipHidden(cal.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold min-h-[40px] border transition-all duration-150"
            style={
              isHidden
                ? { background: 'transparent', borderColor: color, color, opacity: 0.5 }
                : { backgroundColor: color, borderColor: color, color: '#fff' }
            }
            aria-pressed={!isHidden}
            aria-label={`${isHidden ? 'Show' : 'Hide'} ${cal.summary}`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: isHidden ? color : 'rgba(255,255,255,0.8)' }}
            />
            <span className="max-w-[100px] truncate">{cal.summary}</span>
          </button>
        )
      })}
    </div>
  )
}
