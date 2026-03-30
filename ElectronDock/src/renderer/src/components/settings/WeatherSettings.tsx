import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { TouchButton } from '../shared/TouchButton'

export default function WeatherSettings() {
  const weather = useSettingsStore((s) => s.weather)
  const loadSettings = useSettingsStore((s) => s.loadFromMain)

  const [location, setLocation] = useState(weather.location)
  const [units, setUnits] = useState<'imperial' | 'metric'>(weather.units)
  const [changingKey, setChangingKey] = useState(!weather.apiKey)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      if (location !== weather.location) {
        await window.api.settings.setWeatherLocation(location)
      }
      if (units !== weather.units) {
        await window.api.settings.setWeatherUnits(units)
      }
      if (apiKey.trim()) {
        await window.api.settings.setWeatherApiKey(apiKey.trim())
        setApiKey('')
        setChangingKey(false)
      }
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

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          OpenWeatherMap API Key
        </label>

        {weather.apiKey && !changingKey ? (
          <div className="flex items-center justify-between rounded-xl px-4 py-3 min-h-[44px]"
               style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
            <span className="text-sm text-green-500 font-medium">✓ API key configured</span>
            <button
              onClick={() => setChangingKey(true)}
              className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key from openweathermap.org"
              className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              style={inputStyle}
            />
            {weather.apiKey && (
              <button
                onClick={() => { setChangingKey(false); setApiKey('') }}
                className="text-xs mt-1.5 text-blue-500 hover:text-blue-400 transition-colors"
              >
                Cancel
              </button>
            )}
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              Free key at{' '}
              <span className="text-blue-500">openweathermap.org</span>
              {' '}— activate may take ~10 min after signup
            </p>
          </>
        )}
      </div>

      {saved && (
        <p className="text-sm font-medium text-green-500">✓ Weather settings saved!</p>
      )}

      <TouchButton variant="primary" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving...' : 'Save Weather Settings'}
      </TouchButton>
    </div>
  )
}
