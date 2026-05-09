import type { CalendarPreference } from '../../../preload/types'

/**
 * Google Calendar's 11-entry event color palette.
 *
 * When a user sets a per-event color (right-click an event → pick a color),
 * the API returns the slot ID (`colorId: "1".."11"`) on the event. The hex
 * values come from the /colors endpoint; they've been stable for years.
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
 * Resolve the color to render an event with. Priority:
 *   1. per-event colorId  (Google Calendar lets you override one event's color)
 *   2. per-calendar override for the current theme  (our settings)
 *   3. calendar's default color from the Google API
 *   4. hard fallback
 */
export function eventColor(
  ev: { colorId?: string } | undefined,
  cal: { backgroundColor?: string } | undefined,
  pref: CalendarPreference | undefined,
  theme: 'light' | 'dark',
  fallback = '#4285F4',
): string {
  const id = ev?.colorId
  if (id && GOOGLE_EVENT_COLORS[id]) return GOOGLE_EVENT_COLORS[id]
  const override = theme === 'dark' ? pref?.colorOverrideDark : pref?.colorOverrideLight
  if (override) return override
  return cal?.backgroundColor ?? fallback
}
