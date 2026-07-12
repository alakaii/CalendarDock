/** Returns true if the current wall-clock time falls within the deep-sleep
 *  window. Handles midnight-crossing windows (e.g. 21:00 → 06:00). */
export function isInDeepSleepNow(start: string, end: string): boolean {
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = sh * 60 + sm
  const e = eh * 60 + em
  // Midnight-crossing window (e.g. 21:00–06:00): active when cur >= start OR cur < end
  if (s > e) return cur >= s || cur < e
  return cur >= s && cur < e
}
