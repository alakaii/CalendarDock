import { ipcMain } from 'electron'
import { calendarService } from '../services/calendar.service'
import type { CreateEventPayload } from '../../preload/types'

export function registerCalendarHandlers(): void {
  ipcMain.handle('calendar:list-calendars', async (_event, { accountId }: { accountId: string }) => {
    return calendarService.listCalendars(accountId)
  })

  ipcMain.handle(
    'calendar:fetch-events',
    async (
      _event,
      payload: {
        entries: Array<{ accountId: string; calendarId: string }>
        timeMin: string
        timeMax: string
      }
    ) => {
      return calendarService.fetchEvents(payload)
    }
  )

  ipcMain.handle('calendar:create-event', async (_event, payload: CreateEventPayload) => {
    return calendarService.createEvent(payload)
  })
}
