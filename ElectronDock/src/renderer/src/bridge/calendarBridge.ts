/**
 * Module-level imperative bridge so AppHeader can drive FullCalendar without
 * prop drilling.  CalendarView registers its handlers on mount and clears them
 * on unmount; AppHeader reads them whenever the user taps nav / view buttons.
 */

export type NavDir    = 'prev' | 'next' | 'today'
export type CalView   = 'timeGridWeek' | 'dayGridMonth'

export const calendarBridge: {
  navigate:   ((dir: NavDir)  => void) | null
  changeView: ((view: CalView) => void) | null
} = {
  navigate:   null,
  changeView: null,
}
