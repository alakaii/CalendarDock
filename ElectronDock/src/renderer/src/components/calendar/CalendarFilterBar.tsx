import { useSettingsStore } from '../../store/settings.slice'
import type { CalendarListItem } from '../../../../preload/types'

interface CalendarFilterBarProps {
  calendars: CalendarListItem[]
}

export default function CalendarFilterBar({ calendars }: CalendarFilterBarProps) {
  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)
  const setCalendarVisible = useSettingsStore((s) => s.setCalendarVisible)

  if (calendars.length === 0) return null

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/10 scrollbar-hide">
      {calendars.map((cal) => {
        const isVisible = calendarPreferences[cal.id]?.visible !== false
        const color = cal.backgroundColor

        return (
          <button
            key={cal.id}
            onClick={() => setCalendarVisible(cal.id, !isVisible)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                       whitespace-nowrap transition-all min-h-[36px] flex-shrink-0"
            style={{
              backgroundColor: isVisible ? color + '33' : 'transparent',
              borderWidth: 1.5,
              borderStyle: 'solid',
              borderColor: isVisible ? color : 'rgba(255,255,255,0.2)',
              color: isVisible ? color : 'rgba(255,255,255,0.4)'
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: isVisible ? color : 'rgba(255,255,255,0.2)' }}
            />
            {cal.summary}
          </button>
        )
      })}
    </div>
  )
}
