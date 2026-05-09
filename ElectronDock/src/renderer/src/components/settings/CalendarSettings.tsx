import { useSettingsStore } from '../../store/settings.slice'
import type { CalendarSwipeDirection } from '../../../../preload/types'

const directions: { value: CalendarSwipeDirection; label: string; description: string }[] = [
  { value: 'horizontal', label: 'Left / Right', description: 'Swipe horizontally to change' },
  { value: 'vertical',   label: 'Up / Down',    description: 'Swipe vertically to change' },
  { value: 'both',       label: 'Both',         description: 'Either direction works' },
]

export default function CalendarSettings() {
  const calendarSwipeWeek  = useSettingsStore((s) => s.calendarSwipeWeek)
  const calendarSwipeMonth = useSettingsStore((s) => s.calendarSwipeMonth)
  const setCalendarSwipe   = useSettingsStore((s) => s.setCalendarSwipe)

  const labelStyle = { color: 'var(--text-primary)' }
  const subStyle   = { color: 'var(--text-secondary)' }

  const renderRow = (
    view: 'week' | 'month',
    current: CalendarSwipeDirection,
    title: string,
    sub: string
  ) => (
    <section className="space-y-3">
      <div>
        <label className="text-sm font-medium" style={labelStyle}>{title}</label>
        <p className="text-xs mt-0.5" style={subStyle}>{sub}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {directions.map((d) => {
          const isSel = current === d.value
          return (
            <button
              key={d.value}
              onClick={() => setCalendarSwipe(view, d.value)}
              className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl text-left border transition-colors"
              style={{
                background:  isSel ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor: isSel ? '#3b82f6' : 'var(--border)',
                color:       isSel ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs font-semibold">{d.label}</span>
              <span className="text-[10px]" style={subStyle}>{d.description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="space-y-8 max-w-lg">
      <h3 className="text-lg font-semibold" style={labelStyle}>Calendar</h3>

      {renderRow(
        'week',
        calendarSwipeWeek,
        'Week view swipe',
        'Direction(s) that move to the previous / next week.'
      )}

      {renderRow(
        'month',
        calendarSwipeMonth,
        'Month view swipe',
        'Direction(s) that move to the previous / next month.'
      )}
    </div>
  )
}
