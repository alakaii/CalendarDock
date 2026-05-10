import { google } from 'googleapis'
import { authService } from './auth.service'
import type { CalendarEvent, CalendarListItem, CreateEventPayload } from '../../preload/types'

export const calendarService = {
  /** List all sub-calendars for an account */
  async listCalendars(accountId: string): Promise<CalendarListItem[]> {
    const client = await authService.getClient(accountId)
    if (!client) throw new Error(`No OAuth client for account ${accountId}`)

    const calendar = google.calendar({ version: 'v3', auth: client })
    const response = await calendar.calendarList.list({ maxResults: 250 })

    return (response.data.items ?? []).map((item) => ({
      id: item.id ?? '',
      accountId,
      summary: item.summary ?? '',
      description: item.description ?? undefined,
      backgroundColor: item.backgroundColor ?? '#4285F4',
      foregroundColor: item.foregroundColor ?? '#FFFFFF',
      primary: item.primary ?? false,
      accessRole: (item.accessRole as CalendarListItem['accessRole']) ?? 'reader'
    }))
  },

  /** Fetch events across multiple calendars (all accounts) */
  async fetchEvents(payload: {
    entries: Array<{ accountId: string; calendarId: string }>
    timeMin: string
    timeMax: string
  }): Promise<CalendarEvent[]> {
    const results = await Promise.allSettled(
      payload.entries.map(({ accountId, calendarId }) =>
        fetchCalendarEvents(accountId, calendarId, payload.timeMin, payload.timeMax)
      )
    )

    const events: CalendarEvent[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        events.push(...result.value)
      } else {
        console.error('Failed to fetch events for a calendar:', result.reason)
      }
    }
    return events
  },

  /** Create a new event */
  async createEvent(payload: CreateEventPayload): Promise<CalendarEvent> {
    const client = await authService.getClient(payload.accountId)
    if (!client) throw new Error(`No OAuth client for account ${payload.accountId}`)

    const calendar = google.calendar({ version: 'v3', auth: client })

    const requestBody: any = {
      summary: payload.title,
      description: payload.description
    }

    if (payload.allDay) {
      requestBody.start = { date: payload.start.split('T')[0] }
      requestBody.end = { date: payload.end.split('T')[0] }
    } else {
      requestBody.start = { dateTime: payload.start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      requestBody.end = { dateTime: payload.end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    }

    const response = await calendar.events.insert({
      calendarId: payload.calendarId,
      requestBody
    })

    return googleEventToCalendarEvent(response.data, payload.calendarId, payload.accountId)
  }
}

async function fetchCalendarEvents(
  accountId: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const client = await authService.getClient(accountId)
  if (!client) throw new Error(`No OAuth client for account ${accountId}`)

  const calendar = google.calendar({ version: 'v3', auth: client })
  const events: CalendarEvent[] = []
  let pageToken: string | undefined

  do {
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken
    })

    for (const item of response.data.items ?? []) {
      if (item.status !== 'cancelled') {
        events.push(googleEventToCalendarEvent(item, calendarId, accountId))
      }
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return events
}

function googleEventToCalendarEvent(
  item: any,
  calendarId: string,
  accountId: string
): CalendarEvent {
  const allDay = !!item.start?.date && !item.start?.dateTime
  return {
    id: item.id ?? '',
    calendarId,
    accountId,
    title: item.summary ?? '(No title)',
    start: item.start?.dateTime ?? item.start?.date ?? '',
    end: item.end?.dateTime ?? item.end?.date ?? '',
    allDay,
    description: item.description ?? undefined,
    location: item.location ?? undefined,
    colorId: item.colorId ?? undefined,
    htmlLink: item.htmlLink ?? undefined,
    status: item.status ?? 'confirmed',
    recurringEventId: item.recurringEventId ?? undefined
  }
}
