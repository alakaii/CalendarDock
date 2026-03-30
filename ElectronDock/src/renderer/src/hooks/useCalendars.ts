import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '../store/settings.slice'
import type { CalendarListItem } from '../../../preload/types'

export function useCalendars() {
  const accounts = useSettingsStore((s) => s.accounts)
  const accountIds = accounts.map((a) => a.id)

  return useQuery({
    queryKey: ['calendars', accountIds],
    queryFn: async (): Promise<CalendarListItem[]> => {
      const results = await Promise.allSettled(
        accountIds.map((id) => window.api.calendar.listCalendars(id))
      )
      const all: CalendarListItem[] = []
      const errors: string[] = []

      for (const r of results) {
        if (r.status === 'fulfilled') {
          all.push(...r.value)
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
          errors.push(msg)
          console.error('[CalendarDock] listCalendars failed:', msg)
        }
      }

      // If every account failed, throw so the component can show the error
      if (errors.length > 0 && all.length === 0) {
        throw new Error(errors[0])
      }

      return all
    },
    enabled: accountIds.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 1
  })
}
