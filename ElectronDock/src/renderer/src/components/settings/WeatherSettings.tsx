import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { TouchButton } from '../shared/TouchButton'

export default function WeatherSettings() {
  const weather      = useSettingsStore((s) => s.weather)
  const loadSettings = useSettingsStore((s) => s.loadFromMain)

  const [location, setLocation] = useState(weather.location)
  const [units, setUnits]       = useState<'imperial' | 'metric'>(weather.units)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      if (location !== weather.location) await window.api.settings.setWeatherLocation(location)
      if (units !== weather.units)       await window.api.settings.setWeatherUnits(units)
      await loadSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Weather</h3>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        To set up the API key, go to <strong>Accounts</strong>.
      </p>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Location
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. New York,US or 10001"
          className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          style={inputStyle}
        />
      </div>

      {/* Units */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Units
        </label>
        <div className="flex gap-2">
          {(['imperial', 'metric'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] border"
              style={
                units === u
                  ? { background: '#3b82f6', borderColor: '#3b82f6', color: '#fff' }
                  : { background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-secondary)' }
              }
            >
              {u === 'imperial' ? '°F — Imperial' : '°C — Metric'}
            </button>
          ))}
        </div>
      </div>

      {saved && <p className="text-sm font-medium text-green-500">✓ Weather settings saved!</p>}

      <TouchButton variant="primary" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save Weather Settings'}
      </TouchButton>
    </div>
  )
}
