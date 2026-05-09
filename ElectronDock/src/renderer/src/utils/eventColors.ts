/**
 * Google Calendar's 11-entry event color palette.
 *
 * When a user sets a per-event color (right-click an event → pick a color),
 * the API returns the slot ID (`colorId: "1".."11"`) on the event. The
 * actual hex values come from the /colors endpoint, but they've been
 * stable for years — hardcoding avoids an extra fetch + cache round-trip.
 *
 * These match the vibrant palette shown in the Google Calendar web UI.
 */
const GOOGLE_EVENT_COLORS: Record<string, string> = {
  '1':  '#7986cb',  // Lavender
  '2':  '#33b679',  // Sage
  '3':  '#8e24aa',  // Grape
  '4':  '#e67c73',  // Flamingo
  '5':  '#f6c026',  // Banana
  '6':  '#f4511e',  // Tangerine
  '7':  '#039be5',  // Peacock
  '8':  '#616161',  // Graphite
  '9':  '#3f51b5',  // Blueberry
  '10': '#0b8043',  // Basil
  '11': '#d50000',  // Tomato
}

/**
 * Resolve the color to render an event with.
 * Per-event override (colorId) wins over the calendar's default color.
 */
export function eventColor(
  colorId: string | undefined,
  calendarColor: string | undefined,
  fallback = '#4285F4',
): string {
  if (colorId && GOOGLE_EVENT_COLORS[colorId]) return GOOGLE_EVENT_COLORS[colorId]
  return calendarColor ?? fallback
}
