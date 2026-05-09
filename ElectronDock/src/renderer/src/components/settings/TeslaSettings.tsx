import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'

export default function TeslaSettings() {
  const teslaGatewayHost     = useSettingsStore((s) => s.teslaGatewayHost)
  const teslaGatewayEmail    = useSettingsStore((s) => s.teslaGatewayEmail)
  const teslaGatewayPassword = useSettingsStore((s) => s.teslaGatewayPassword)
  const setTeslaGatewayConfig = useSettingsStore((s) => s.setTeslaGatewayConfig)

  const [host, setHost]         = useState(teslaGatewayHost)
  const [email, setEmail]       = useState(teslaGatewayEmail)
  const [password, setPassword] = useState(teslaGatewayPassword ? '••••••••' : '')
  const [editing, setEditing]   = useState(!teslaGatewayHost)
  const [saved, setSaved]       = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const passwordChanged = password && password !== '••••••••'
  const canSave = host.trim() && email.trim() && (passwordChanged || teslaGatewayPassword)

  const handleSave = async () => {
    if (!canSave) return
    setTesting(true)
    setTestError(null)
    try {
      const finalPassword = passwordChanged ? password : teslaGatewayPassword
      await window.api.tesla.testConnection(host.trim(), email.trim(), finalPassword)
      setTeslaGatewayConfig(host.trim(), email.trim(), finalPassword)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  }
  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Powerwall</h2>

      <div className="space-y-2">
        <p style={labelStyle}>Tesla Powerwall — Local Gateway</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Connects directly to your Powerwall Gateway on the local network — no cloud account
          needed. The default password is the last 5 characters of the gateway's serial
          number (printed inside the gateway), unless you've changed it.
        </p>
      </div>

      {!editing && teslaGatewayHost ? (
        <div className="rounded-xl p-4 space-y-1"
             style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{teslaGatewayHost}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{teslaGatewayEmail}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Password saved</p>
          <button
            onClick={() => { setEditing(true); setPassword('') }}
            className="mt-2 text-sm font-semibold"
            style={{ color: '#3b82f6' }}
          >
            Change configuration
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="Gateway IP or hostname (e.g. 192.168.1.42)"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tesla account email"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Password (last 5 of gateway serial)"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          {testError && (
            <p className="text-xs" style={{ color: '#f87171' }}>{testError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!canSave || testing}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 min-h-[44px]"
              style={{ background: saved ? '#22c55e' : '#3b82f6', color: '#fff' }}
            >
              {testing ? 'Testing…' : saved ? 'Saved' : 'Test & Save'}
            </button>
            {teslaGatewayHost && (
              <button
                onClick={() => { setEditing(false); setPassword('••••••••'); setTestError(null) }}
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
