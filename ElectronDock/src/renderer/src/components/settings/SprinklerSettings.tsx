import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'

export default function SprinklerSettings() {
  const rachioApiKey    = useSettingsStore((s) => s.rachioApiKey)
  const setRachioApiKey = useSettingsStore((s) => s.setRachioApiKey)
  const [draft, setDraft] = useState(rachioApiKey)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setRachioApiKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  }
  const labelStyle = { color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Sprinklers</h2>

      <div className="space-y-2">
        <p style={labelStyle}>Rachio API Key</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Find your API key in the Rachio app: Account → API Access → Create API Key.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Paste your Rachio API key…"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none font-mono min-h-[44px]"
            style={inputStyle}
          />
          <button
            onClick={handleSave}
            disabled={!draft.trim()}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 min-h-[44px]"
            style={{ background: saved ? '#22c55e' : '#3b82f6', color: '#fff' }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
        {rachioApiKey && (
          <p className="text-xs" style={{ color: '#22c55e' }}>
            API key is configured.
          </p>
        )}
      </div>
    </div>
  )
}
