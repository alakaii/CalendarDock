const FALLBACK_ZONES = [
  'UTC',
  'America/New_York',  'America/Chicago',     'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto',    'America/Vancouver',  'America/Mexico_City',
  'America/Sao_Paulo',  'Europe/London',      'Europe/Paris',
  'Europe/Berlin',      'Europe/Madrid',      'Europe/Rome',
  'Europe/Moscow',      'Africa/Cairo',       'Africa/Johannesburg',
  'Asia/Dubai',         'Asia/Kolkata',       'Asia/Bangkok',
  'Asia/Shanghai',      'Asia/Tokyo',         'Asia/Seoul',
  'Asia/Singapore',     'Australia/Perth',    'Australia/Sydney',
  'Pacific/Auckland',
]

export function getAllZones(): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
  if (typeof fn === 'function') {
    try { return fn('timeZone') } catch { /* fall through */ }
  }
  return FALLBACK_ZONES
}

export function offsetForZone(tz: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

export function timeInZone(tz: string, now: Date): string {
  try {
    return now.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour:     'numeric',
      minute:   '2-digit',
      hour12:   true,
    })
  } catch {
    return ''
  }
}

export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Hours-of-difference between two zones at a given moment.
 * Tokyo from New York during EST = +14 (Tokyo is 14 hours ahead).
 * Handles half-hour zones (e.g. India = +5.5h offset to UTC).
 */
export function diffHours(targetTz: string, baseTz: string, now: Date): number {
  const parse = (offset: string) => {
    // Examples: "GMT-5", "GMT+9", "GMT+5:30", "GMT"
    const m = offset.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!m) return 0
    const sign = m[1] === '-' ? -1 : 1
    const h    = Number(m[2])
    const min  = Number(m[3] ?? 0)
    return sign * (h + min / 60)
  }
  return parse(offsetForZone(targetTz, now)) - parse(offsetForZone(baseTz, now))
}

export function formatDiffHours(hours: number): string {
  if (hours === 0) return 'same'
  const sign = hours > 0 ? '+' : '−'
  const abs  = Math.abs(hours)
  const whole = Math.floor(abs)
  const frac  = abs - whole
  if (frac === 0) return `${sign}${whole}h`
  // Common half-hour offsets (e.g. India)
  if (Math.abs(frac - 0.5) < 0.01) return `${sign}${whole}.5h`
  return `${sign}${abs.toFixed(2).replace(/\.?0+$/, '')}h`
}
