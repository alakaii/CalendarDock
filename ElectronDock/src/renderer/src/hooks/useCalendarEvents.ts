import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { startOfMonth, endOfMonth, subWeeks, addWeeks } from 'date-fns'
import { useSettingsStore } from '../store/settings.slice'
import type { CalendarEvent, CalendarListItem } from '../../../preload/types'

export function useCalendarEvents(
  currentMonth: Date,
  calendars: CalendarListItem[]
) {
  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)

  // Only fetch events for calendars that are visible
  const enabledCalendars = calendars.filter((cal) => {
    const pref = calendarPreferences[cal.id]
    // Default to visible if no preference set
    return pref?.visible !== false
  })

  const timeMin = subWeeks(startOfMonth(currentMonth), 1).toISOString()
  const timeMax = addWeeks(endOfMonth(currentMonth), 1).toISOString()

  return useQuery({
    queryKey: ['events', enabledCalendars.map((c) => c.id), timeMin, timeMax],
    queryFn: (): Promise<CalendarEvent[]> =>
      window.api.calendar.fetchEvents({
        entries: enabledCalendars.map((c) => ({
          accountId: c.accountId,
          calendarId: c.id
        })),
        timeMin,
        timeMax
      }),
    enabled: enabledCalendars.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    placeholderData: keepPreviousData
  })
}
