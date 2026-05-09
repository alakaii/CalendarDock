import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import {
  getAllZones,
  offsetForZone,
  timeInZone,
  systemTimezone,
  diffHours,
  formatDiffHours,
} from '../../utils/timezones'

export default function ClocksSettings() {
  const timezone           = useSettingsStore((s) => s.timezone)
  const setTimezone        = useSettingsStore((s) => s.setTimezone)
  const additionalZones    = useSettingsStore((s) => s.additionalTimezones)
  const setAdditionalZones = useSettingsStore((s) => s.setAdditionalTimezones)

  const [headerQuery, setHeaderQuery] = useState('')
  const [extraQuery,  setExtraQuery]  = useState('')
  const [now,         setNow]         = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const zones = useMemo(() => getAllZones(), [])

  const filterFor = (q: string) => {
    const t = q.trim().toLowerCase()
    return t ? zones.filter((z) => z.toLowerCase().includes(t)) : zones
  }

  const sysTz       = systemTimezone()
  const baseTz      = timezone || sysTz       // current "home" zone for offsets
  const additionals = additionalZones

  const toggleAdditional = (tz: string) => {
    if (additionals.includes(tz)) {
      setAdditionalZones(additionals.filter((z) => z !== tz))
    } else {
      setAdditionalZones([...additionals, tz])
    }
  }

  const labelStyle = { color: 'var(--text-primary)' }
  const subStyle   = { color: 'var(--text-secondary)' }
  const cardStyle  = { background: 'var(--card-bg)', border: '1px solid var(--card-border)' }
  const inputStyle = {
    background: 'var(--input-bg)',
    border:     '1px solid var(--input-border)',
    color:      'var(--text-primary)',
  }

  return (
    <div className="space-y-8 max-w-xl">
      <h3 className="text-lg font-semibold" style={labelStyle}>Clocks</h3>

      {/* ── Header clock zone ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>Header clock</label>
          <p className="text-xs mt-0.5" style={subStyle}>
            The timezone shown in the top-right of the app.
          </p>
        </div>

        <div className="rounded-xl p-4 space-y-1" style={cardStyle}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-semibold truncate" style={labelStyle}>
              {timezone || `System (${sysTz || 'local'})`}
            </span>
            <span className="text-2xl font-semibold tabular-nums" style={labelStyle}>
              {timeInZone(baseTz, now)}
            </span>
          </div>
          <p className="text-[11px] font-mono" style={subStyle}>
            {offsetForZone(baseTz, now)}
          </p>
        </div>

        <input
          type="text"
          placeholder="Search zone for header clock…"
          value={headerQuery}
          onChange={(e) => setHeaderQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />

        <div className="rounded-xl overflow-y-auto" style={{ ...cardStyle, maxHeight: '40vh' }}>
          <button
            onClick={() => setTimezone('')}
            className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
            style={{
              background: timezone === '' ? 'rgba(59,130,246,0.12)' : 'transparent',
              color:      timezone === '' ? '#3b82f6' : 'var(--text-primary)',
            }}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono opacity-70 shrink-0">System</span>
              <span className="text-sm truncate">{sysTz || '(local time)'}</span>
            </span>
            <span className="text-xs tabular-nums" style={subStyle}>
              {timeInZone(sysTz, now)}
            </span>
          </button>

          <div className="h-px mx-3" style={{ background: 'var(--card-border)' }} />

          {filterFor(headerQuery).map((tz) => {
            const isSel = timezone === tz
            return (
              <button
                key={tz}
                onClick={() => setTimezone(tz)}
                className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
                style={{
                  background: isSel ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color:      isSel ? '#3b82f6' : 'var(--text-primary)',
                }}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm truncate">{tz}</span>
                  <span className="text-[11px] font-mono opacity-60 shrink-0">{offsetForZone(tz, now)}</span>
                </span>
                <span
                  className="text-xs tabular-nums shrink-0"
                  style={{ color: isSel ? '#3b82f6' : 'var(--text-secondary)' }}
                >
                  {timeInZone(tz, now)}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Additional clocks ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>Additional clocks</label>
          <p className="text-xs mt-0.5" style={subStyle}>
            Shown in the dropdown when you tap the header clock, with offsets relative to{' '}
            <span className="font-mono">{baseTz}</span>.
          </p>
        </div>

        {/* Selected list */}
        {additionals.length > 0 ? (
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            {additionals.map((tz) => {
              const d = diffHours(tz, baseTz, now)
              return (
                <div key={tz} className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm truncate" style={labelStyle}>{tz}</span>
                    <span className="text-[11px] font-mono opacity-60 shrink-0">
                      {offsetForZone(tz, now)} · {formatDiffHours(d)}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums shrink-0 mr-2" style={subStyle}>
                    {timeInZone(tz, now)}
                  </span>
                  <button
                    onClick={() => toggleAdditional(tz)}
                    className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: '#ef4444' }}
                    aria-label={`Remove ${tz}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs italic" style={subStyle}>None added yet — search and tap below to add.</p>
        )}

        <input
          type="text"
          placeholder="Add a timezone… (e.g. Tokyo, London)"
          value={extraQuery}
          onChange={(e) => setExtraQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />

        {extraQuery.trim() && (
          <div className="rounded-xl overflow-y-auto" style={{ ...cardStyle, maxHeight: '40vh' }}>
            {filterFor(extraQuery).map((tz) => {
              const isAdded = additionals.includes(tz)
              return (
                <button
                  key={tz}
                  onClick={() => toggleAdditional(tz)}
                  className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
                  style={{
                    background: isAdded ? 'rgba(34,197,94,0.10)' : 'transparent',
                    color:      isAdded ? '#22c55e' : 'var(--text-primary)',
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-4 shrink-0">{isAdded ? '✓' : '+'}</span>
                    <span className="text-sm truncate">{tz}</span>
                    <span className="text-[11px] font-mono opacity-60 shrink-0">{offsetForZone(tz, now)}</span>
                  </span>
                  <span className="text-xs tabular-nums shrink-0" style={subStyle}>
                    {timeInZone(tz, now)}
                  </span>
                </button>
              )
            })}
            {filterFor(extraQuery).length === 0 && (
              <p className="text-sm text-center py-4" style={subStyle}>No matches.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
