import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'

export default function WaterHeaterSettings() {
  const rinnaiEmail         = useSettingsStore((s) => s.rinnaiEmail)
  const rinnaiPassword      = useSettingsStore((s) => s.rinnaiPassword)
  const setRinnaiCredentials = useSettingsStore((s) => s.setRinnaiCredentials)

  const [email, setEmail]       = useState(rinnaiEmail)
  const [password, setPassword] = useState(rinnaiPassword ? '••••••••' : '')
  const [editing, setEditing]   = useState(!rinnaiEmail)
  const [saved, setSaved]       = useState(false)

  const handleSave = () => {
    if (!email.trim() || !password.trim() || password === '••••••••') return
    setRinnaiCredentials(email.trim(), password)
    setSaved(true)
    setEditing(false)
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
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Water Heater</h2>

      <div className="space-y-2">
        <p style={labelStyle}>Rinnai Control-R account</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Uses your Rinnai Control-R app credentials. The password is stored locally on this device.
          Note: the Rinnai API rate-limits to approximately one request every 10 minutes.
        </p>
      </div>

      {!editing && rinnaiEmail ? (
        <div className="rounded-xl p-4 space-y-1"
             style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{rinnaiEmail}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Password saved</p>
          <button
            onClick={() => { setEditing(true); setPassword('') }}
            className="mt-2 text-sm font-semibold"
            style={{ color: '#3b82f6' }}
          >
            Change credentials
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Password"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!email.trim() || !password.trim() || password === '••••••••'}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 min-h-[44px]"
              style={{ background: saved ? '#22c55e' : '#3b82f6', color: '#fff' }}
            >
              {saved ? 'Saved' : 'Save'}
            </button>
            {rinnaiEmail && (
              <button
                onClick={() => { setEditing(false); setPassword('••••••••') }}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
