import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { TouchButton } from '../shared/TouchButton'
import type { StandbyCorner, StandbyElementId, StandbyWeatherFields, StandbyWaterFields, StandbyTeslaFields, StandbyExitGesture } from '../../../../preload/types'

// ── Corner Picker ─────────────────────────────────────────────────────────────

// 3×3 picker. Corners + mid-edge centers; the middle cell is intentionally
// empty (no "center-center" anchor — that'd cover the photo slideshow).
const CORNER_GRID: { id: StandbyCorner; row: number; col: number; label: string }[] = [
  { id: 'top-left',      row: 1, col: 1, label: '↖' },
  { id: 'top-center',    row: 1, col: 2, label: '↑' },
  { id: 'top-right',     row: 1, col: 3, label: '↗' },
  { id: 'left-center',   row: 2, col: 1, label: '←' },
  { id: 'right-center',  row: 2, col: 3, label: '→' },
  { id: 'bottom-left',   row: 3, col: 1, label: '↙' },
  { id: 'bottom-center', row: 3, col: 2, label: '↓' },
  { id: 'bottom-right',  row: 3, col: 3, label: '↘' },
]

function CornerPicker({ value, onChange }: { value: StandbyCorner; onChange: (c: StandbyCorner) => void }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: '28px 28px 28px', gridTemplateRows: '28px 28px 28px' }}>
      {CORNER_GRID.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          title={c.id}
          style={{ gridRow: c.row, gridColumn: c.col }}
          className={`rounded text-sm font-bold flex items-center justify-center transition-colors ${
            value === c.id
              ? 'bg-blue-500 text-white'
              : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-secondary)] hover:border-blue-400'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-blue-500' : 'bg-[var(--card-border)]'
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Drag handle SVG ───────────────────────────────────────────────────────────

const GripIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" opacity={0.5}>
    <circle cx="7" cy="5"  r="1.3" /><circle cx="13" cy="5"  r="1.3" />
    <circle cx="7" cy="10" r="1.3" /><circle cx="13" cy="10" r="1.3" />
    <circle cx="7" cy="15" r="1.3" /><circle cx="13" cy="15" r="1.3" />
  </svg>
)

// ── Labels ────────────────────────────────────────────────────────────────────

const ELEMENT_LABELS: Record<StandbyElementId, string> = {
  time:    'Time & Date',
  weather: 'Weather',
  events:  'Events Today',
  water:   'Water Heater',
  tesla:   'Powerwall',
}

const WEATHER_FIELD_LABELS: { key: keyof StandbyWeatherFields; label: string }[] = [
  { key: 'temperature', label: 'Temperature' },
  { key: 'feelsLike',   label: 'Feels like' },
  { key: 'condition',   label: 'Condition' },
  { key: 'humidity',    label: 'Humidity' },
  { key: 'city',        label: 'City name' },
]

const WATER_FIELD_LABELS: { key: keyof StandbyWaterFields; label: string; desc: string }[] = [
  { key: 'timeRemaining',       label: 'Time Remaining',       desc: 'Countdown while recirculation is active' },
  { key: 'domesticTemperature', label: 'Water Temp',           desc: 'Actual domestic hot water temperature' },
  { key: 'recircTemperature',   label: 'Recirc Loop Temp',     desc: 'Recirculation loop temperature' },
  { key: 'outletTemperature',   label: 'Outlet Temp (m02)',    desc: 'Heat exchanger outlet sensor' },
  { key: 'inletTemperature',    label: 'Inlet Temp (m08)',     desc: 'Cold water inlet sensor' },
]

const DEFAULT_WATER_FIELDS: StandbyWaterFields = {
  timeRemaining:       true,
  domesticTemperature: true,
  recircTemperature:   true,
  outletTemperature:   false,
  inletTemperature:    false,
}

const TESLA_FIELD_LABELS: { key: keyof StandbyTeslaFields; label: string; desc: string }[] = [
  { key: 'batteryPercent', label: 'Battery %',     desc: 'State of charge' },
  { key: 'powerFlow',      label: 'Power Flow',    desc: 'One-line summary, e.g. "Solar → Battery 2.4 kW"' },
  { key: 'gridStatus',     label: 'Off-grid Alert',desc: 'Pulses when the grid is down or reconnecting' },
]

const DEFAULT_TESLA_FIELDS: StandbyTeslaFields = {
  batteryPercent: true,
  powerFlow:      true,
  gridStatus:     true,
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StandbySettings() {
  const standbyTimeoutMinutes = useSettingsStore((s) => s.standbyTimeoutMinutes)
  const rawLayout             = useSettingsStore((s) => s.standbyLayout)
  // Merge in defaults for installs that pre-date the water/tesla widgets
  const layout = {
    ...rawLayout,
    water:       rawLayout.water       ?? { corner: 'bottom-right' as const, enabled: true  },
    waterFields: rawLayout.waterFields ?? DEFAULT_WATER_FIELDS,
    tesla:       rawLayout.tesla       ?? { corner: 'bottom-left'  as const, enabled: false },
    teslaFields: rawLayout.teslaFields ?? DEFAULT_TESLA_FIELDS,
    priority: ((): StandbyElementId[] => {
      let p = rawLayout.priority
      if (!p.includes('water')) p = [...p, 'water']
      if (!p.includes('tesla')) p = [...p, 'tesla']
      return p
    })(),
  }
  const exitGesture           = useSettingsStore((s) => s.standbyExitGesture)
  const setStandbyLayout      = useSettingsStore((s) => s.setStandbyLayout)
  const setStandbyExitGesture = useSettingsStore((s) => s.setStandbyExitGesture)
  const loadSettings          = useSettingsStore((s) => s.loadFromMain)

  const [minutes,  setMinutes]  = useState(standbyTimeoutMinutes)
  const [saved,    setSaved]    = useState(false)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // ── A: Timeout ──────────────────────────────────────────────────────────────
  const handleSaveTimeout = async () => {
    await window.api.settings.setStandbyTimeout(minutes)
    await loadSettings()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── B: Widget position / enable ────────────────────────────────────────────
  const setCorner = (id: StandbyElementId, corner: StandbyCorner) =>
    setStandbyLayout({ ...layout, [id]: { ...layout[id], corner } })

  const setEnabled = (id: StandbyElementId, enabled: boolean) =>
    setStandbyLayout({ ...layout, [id]: { ...layout[id], enabled } })

  // ── C: Priority drag-to-reorder ────────────────────────────────────────────
  const movePriority = (from: number, to: number) => {
    if (from === to) return
    const p = [...layout.priority]
    const [item] = p.splice(from, 1)
    p.splice(to, 0, item)
    setStandbyLayout({ ...layout, priority: p })
  }

  const handleDragStart = (e: React.DragEvent, i: number) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragFrom(i)
  }
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    setDragOver(i)
  }
  const handleDrop = (_e: React.DragEvent, i: number) => {
    if (dragFrom !== null) movePriority(dragFrom, i)
    setDragFrom(null)
    setDragOver(null)
  }
  const handleDragEnd = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  // ── D: Weather fields ──────────────────────────────────────────────────────
  const toggleWeatherField = (key: keyof StandbyWeatherFields) =>
    setStandbyLayout({
      ...layout,
      weatherFields: { ...layout.weatherFields, [key]: !layout.weatherFields[key] },
    })

  // ── E: Water fields ────────────────────────────────────────────────────────
  const toggleWaterField = (key: keyof StandbyWaterFields) =>
    setStandbyLayout({
      ...layout,
      waterFields: { ...layout.waterFields, [key]: !layout.waterFields[key] },
    })

  // ── F: Tesla fields ────────────────────────────────────────────────────────
  const toggleTeslaField = (key: keyof StandbyTeslaFields) =>
    setStandbyLayout({
      ...layout,
      teslaFields: { ...layout.teslaFields, [key]: !layout.teslaFields[key] },
    })

  const cardStyle = { background: 'var(--card-bg)', border: '1px solid var(--card-border)' }

  return (
    <div className="space-y-5 max-w-lg">
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Standby Mode</h3>

      {/* ── A: Inactivity Timeout ─────────────────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Inactivity Timeout</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Activate after{' '}
          <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{minutes}</span>{' '}
          minute{minutes !== 1 ? 's' : ''} of inactivity
        </p>
        <input
          type="range"
          min={1}
          max={60}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-full accent-blue-500 h-2"
        />
        <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span>1 min</span><span>30 min</span><span>60 min</span>
        </div>
        {saved && <p className="text-sm font-medium text-green-500">✓ Saved!</p>}
        <TouchButton variant="primary" onClick={handleSaveTimeout} className="w-full">
          Save Timeout
        </TouchButton>
      </div>

      {/* ── B: Widget Positions ───────────────────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-4" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Widget Positions</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Pick which corner each widget appears in, and toggle it on or off.
        </p>

        {(['time', 'weather', 'events', 'water', 'tesla'] as StandbyElementId[]).map((id) => (
          <div key={id} className="flex items-center gap-4">
            <p className="text-sm font-medium flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
              {ELEMENT_LABELS[id]}
            </p>
            <CornerPicker
              value={layout[id].corner}
              onChange={(c) => setCorner(id, c)}
            />
            <Toggle
              checked={layout[id].enabled}
              onChange={() => setEnabled(id, !layout[id].enabled)}
            />
          </div>
        ))}
      </div>

      {/* ── C: Priority Order ─────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Priority Order</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          When multiple widgets share a corner, higher priority is closest to the corner edge.
          Drag or use ↑↓ to reorder.
        </p>

        {layout.priority.map((id, i) => (
          <div
            key={id}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e)  => handleDragOver(e, i)}
            onDrop={(e)      => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${
              dragFrom === i
                ? 'opacity-50 border-blue-400'
                : dragOver === i && dragFrom !== i
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-[var(--card-border)]'
            }`}
            style={{ background: 'var(--bg-base)' }}
          >
            <span className="text-[var(--text-secondary)]"><GripIcon /></span>

            <span
              className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--card-border)', color: 'var(--text-primary)' }}
            >
              {i + 1}
            </span>

            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {ELEMENT_LABELS[id]}
            </span>

            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => movePriority(i, Math.max(0, i - 1))}
                disabled={i === 0}
                className="w-7 h-7 flex items-center justify-center rounded text-base
                           disabled:opacity-20 hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={`Move ${ELEMENT_LABELS[id]} up`}
              >↑</button>
              <button
                onClick={() => movePriority(i, Math.min(layout.priority.length - 1, i + 1))}
                disabled={i === layout.priority.length - 1}
                className="w-7 h-7 flex items-center justify-center rounded text-base
                           disabled:opacity-20 hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={`Move ${ELEMENT_LABELS[id]} down`}
              >↓</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── D: Weather Display Fields ─────────────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Weather Display</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Choose which weather details appear in standby mode.
        </p>

        {WEATHER_FIELD_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between py-1">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
            <Toggle
              checked={layout.weatherFields[key]}
              onChange={() => toggleWeatherField(key)}
            />
          </div>
        ))}
      </div>

      {/* ── E: Water Heater Display Fields ───────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Water Heater Display</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Choose which water heater details appear when the widget is active in standby.
        </p>

        {WATER_FIELD_LABELS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-1 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
            </div>
            <Toggle
              checked={layout.waterFields[key]}
              onChange={() => toggleWaterField(key)}
            />
          </div>
        ))}
      </div>

      {/* ── F: Powerwall Display Fields ──────────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Powerwall Display</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Choose which Powerwall details appear in standby. Polling cost is unchanged
          — the widget reuses the same data the Powerwall page is already fetching.
        </p>

        {TESLA_FIELD_LABELS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-1 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
            </div>
            <Toggle
              checked={layout.teslaFields[key]}
              onChange={() => toggleTeslaField(key)}
            />
          </div>
        ))}
      </div>

      {/* ── G: Exit Gesture ───────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Exit Gesture</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          How to return to the calendar from standby mode.
        </p>

        <div className="flex gap-2">
          {(['double-tap', 'single-tap'] as StandbyExitGesture[]).map((g) => (
            <button
              key={g}
              onClick={() => setStandbyExitGesture(g)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                exitGesture === g
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:border-blue-400'
              }`}
            >
              {g === 'double-tap' ? 'Double-tap' : 'Single tap'}
            </button>
          ))}
        </div>

        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {exitGesture === 'double-tap'
            ? 'Double-tap prevents accidental exits during normal use.'
            : 'Single tap exits immediately — handy if you prefer quick access.'}
        </p>
      </div>
    </div>
  )
}
