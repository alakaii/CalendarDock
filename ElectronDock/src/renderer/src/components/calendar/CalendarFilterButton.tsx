import { useEffect, useRef, useState } from 'react'
import { useCalendars } from '../../hooks/useCalendars'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'

/**
 * Compact replacement for the old row-of-pills calendar filter. Lives in
 * AppHeader next to the month selector. The button face shows up to 4
 * overlapping colored circles — one per currently-visible calendar — and
 * clicking it opens a dropdown with per-calendar toggles.
 *
 * State model:
 *   - settings.calendarPreferences[id].visible — long-lived "is this calendar
 *     enabled at all?" flag set in Settings → Calendars. Calendars with this
 *     flag false don't appear in the dropdown.
 *   - ui.chipHiddenIds — transient on/off toggle set from this dropdown (and
 *     used by FullCalendar to filter events). Persists for the session only.
 */
export default function CalendarFilterButton() {
  const { data: calendars = [] } = useCalendars()
  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)
  const calendarOrder       = useSettingsStore((s) => s.calendarOrder)
  const chipHiddenIds       = useUIStore((s) => s.chipHiddenIds)
  const toggleChipHidden    = useUIStore((s) => s.toggleChipHidden)

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click and on Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Only calendars enabled in Settings → Calendars appear in the picker
  const enabled = calendars.filter((c) => calendarPreferences[c.id]?.visible !== false)
  const sorted  = [...enabled].sort((a, b) => {
    const ia = calendarOrder.indexOf(a.id)
    const ib = calendarOrder.indexOf(b.id)
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
  })

  // Stack visualization keys off currently-shown calendars (chip not hidden)
  const shown = sorted.filter((c) => !chipHiddenIds.has(c.id))
  const previewColors = shown.slice(0, 4).map((c) => c.backgroundColor)
  const overflow = shown.length - previewColors.length

  if (sorted.length === 0) return null

  const allShown = shown.length === sorted.length
  const allHidden = shown.length === 0

  function setAll(hide: boolean) {
    sorted.forEach((c) => {
      const isHidden = chipHiddenIds.has(c.id)
      if (hide && !isHidden)  toggleChipHidden(c.id)
      if (!hide && isHidden)  toggleChipHidden(c.id)
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1.5 rounded-lg min-h-[40px] flex items-center gap-2 transition-colors hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Filter calendars"
        aria-expanded={open}
        title="Filter calendars"
      >
        {/* Stacked color dots — overlap by 6px so 4 dots fit in ~38px */}
        <span className="relative inline-flex items-center" style={{ height: 18, width: previewColors.length === 0 ? 18 : 18 + (previewColors.length - 1) * 12 + (overflow > 0 ? 4 : 0) }}>
          {previewColors.length === 0 ? (
            // No calendars currently shown — show an outline circle so the
            // button has a target shape and a visual hint that filtering is on.
            <span
              className="inline-block rounded-full"
              style={{
                width: 18, height: 18,
                border: '1.5px dashed var(--text-secondary)',
                opacity: 0.5,
              }}
            />
          ) : (
            previewColors.map((color, i) => (
              <span
                key={i}
                className="inline-block rounded-full"
                style={{
                  position: 'absolute',
                  left: i * 12,
                  width: 18, height: 18,
                  background: color,
                  border: '2px solid var(--bg-header)',
                  zIndex: previewColors.length - i,
                }}
              />
            ))
          )}
          {overflow > 0 && (
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{
                position: 'absolute',
                left: previewColors.length * 12 + 4,
                top: 0,
                lineHeight: '18px',
                color: 'var(--text-secondary)',
              }}
            >
              +{overflow}
            </span>
          )}
        </span>
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl shadow-2xl z-50"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-primary)',
            minWidth: 280,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {/* Header with bulk toggle */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--card-border)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Calendars
            </span>
            <button
              onClick={() => setAll(allShown)}
              className="text-xs font-semibold"
              style={{ color: '#3b82f6' }}
            >
              {allShown ? 'Hide all' : allHidden ? 'Show all' : 'Show all'}
            </button>
          </div>

          {sorted.map((cal) => {
            const isHidden = chipHiddenIds.has(cal.id)
            const color    = cal.backgroundColor
            return (
              <button
                key={cal.id}
                onClick={() => toggleChipHidden(cal.id)}
                className="w-full flex items-center gap-3 px-3 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--text-primary)' }}
                aria-pressed={!isHidden}
              >
                {/* Color swatch — solid when shown, ring-only when hidden */}
                <span
                  className="inline-block rounded-full flex-shrink-0"
                  style={{
                    width: 14, height: 14,
                    background: isHidden ? 'transparent' : color,
                    border: `2px solid ${color}`,
                    opacity: isHidden ? 0.55 : 1,
                  }}
                />
                <span
                  className="flex-1 text-left text-sm truncate"
                  style={{ opacity: isHidden ? 0.55 : 1 }}
                  title={cal.summary}
                >
                  {cal.summary}
                </span>
                {/* Compact checkbox-style indicator on the right */}
                <span
                  className="inline-flex items-center justify-center rounded flex-shrink-0"
                  style={{
                    width: 18, height: 18,
                    background: isHidden ? 'transparent' : '#3b82f6',
                    border: `1.5px solid ${isHidden ? 'var(--card-border)' : '#3b82f6'}`,
                  }}
                >
                  {!isHidden && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
