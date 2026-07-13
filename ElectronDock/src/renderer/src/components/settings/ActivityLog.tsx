import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventLogEntry } from '../../../../preload/types'

const blue = '#3b82f6'

// Friendly labels + accent colors for known sources. Unknown sources fall
// through to a neutral gray chip using their raw name.
const SOURCE_META: Record<string, { label: string; color: string }> = {
  standby:    { label: 'standby',   color: '#8b5cf6' },
  backlight:  { label: 'backlight', color: '#f59e0b' },
  icloud:     { label: 'icloud',    color: '#0ea5e9' },
  photoqueue: { label: 'photos',    color: '#10b981' },
  photos:     { label: 'photos',    color: '#10b981' },
  dropbox:    { label: 'dropbox',   color: '#3b82f6' },
  auth:       { label: 'auth',      color: '#ef4444' },
  renderer:   { label: 'ui',        color: '#64748b' },
  system:     { label: 'system',    color: '#64748b' },
}

function metaFor(source: string): { label: string; color: string } {
  return SOURCE_META[source] ?? { label: source, color: '#64748b' }
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function ActivityLog() {
  const [events, setEvents]   = useState<EventLogEntry[]>([])
  const [filter, setFilter]   = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const list = await window.api.logs.get({ limit: 500 })
      setEvents(list)
    } catch {
      /* ignore — keep last snapshot */
    } finally {
      setLoading(false)
    }
  }

  // Initial load + auto-refresh every 5s while this section is mounted (visible).
  useEffect(() => {
    void load()
    timerRef.current = setInterval(() => { void load() }, 5000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Sources present in the current data, for the filter chips.
  const sources = useMemo(() => {
    const seen = new Set<string>()
    for (const e of events) seen.add(e.source)
    return Array.from(seen).sort()
  }, [events])

  const shown = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.source === filter)),
    [events, filter],
  )

  const chipBase =
    'px-3 py-1.5 rounded-full text-sm font-medium min-h-[36px] transition-colors'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Activity
        </h2>
        <button
          onClick={() => void load()}
          className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-50"
          disabled={loading}
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Recent app events — standby transitions, display backlight, photo sync,
        and errors. Newest first, auto-refreshing.
      </p>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={chipBase}
          style={{
            background: filter === 'all' ? blue : 'var(--bg-base)',
            border: '1px solid var(--border)',
            color: filter === 'all' ? '#fff' : 'var(--text-primary)',
          }}
        >
          All
        </button>
        {sources.map((s) => {
          const meta = metaFor(s)
          const active = filter === s
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={chipBase}
              style={{
                background: active ? meta.color : 'var(--bg-base)',
                border: '1px solid var(--border)',
                color: active ? '#fff' : 'var(--text-primary)',
              }}
            >
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Event list */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        {shown.length === 0 && (
          <div
            className="px-4 py-6 text-sm text-center"
            style={{ color: 'var(--text-secondary)' }}
          >
            No activity recorded yet.
          </div>
        )}
        {shown.map((e, i) => {
          const meta = metaFor(e.source)
          return (
            <div
              key={`${e.ts}-${i}`}
              className="flex items-start gap-3 px-4 py-3"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <span
                className="font-mono text-sm tabular-nums pt-0.5 flex-shrink-0"
                style={{ color: 'var(--text-secondary)', minWidth: '3ch' }}
              >
                {fmtTime(e.ts)}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5"
                style={{ background: meta.color, color: '#fff' }}
              >
                {meta.label}
              </span>
              <span
                className="text-sm leading-relaxed break-words"
                style={{ color: 'var(--text-primary)' }}
              >
                {e.message}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
