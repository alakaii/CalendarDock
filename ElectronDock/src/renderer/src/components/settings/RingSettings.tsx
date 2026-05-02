import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import type { RingStatus, RingCameraInfo } from '../../../../preload/types'

const STATUS_COLOR: Record<RingStatus['state'], string> = {
  'disconnected': '#6b7280',
  'connecting':   '#3b82f6',
  'needs-2fa':    '#f59e0b',
  'connected':    '#22c55e',
  'error':        '#ef4444',
}

const STATUS_LABEL: Record<RingStatus['state'], string> = {
  'disconnected': 'Not connected',
  'connecting':   'Signing in…',
  'needs-2fa':    'Two-factor required',
  'connected':    'Connected',
  'error':        'Error',
}

export default function RingSettings() {
  const intervalSec    = useSettingsStore((s) => s.ringSnapshotIntervalSec)
  const setIntervalSec = useSettingsStore((s) => s.setRingSnapshotInterval)

  const [status,   setStatus]   = useState<RingStatus | null>(null)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [twofa,    setTwofa]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [cameras,  setCameras]  = useState<RingCameraInfo[]>([])

  const refreshStatus = useCallback(async () => {
    const s = await window.api.ring?.getStatus()
    if (s) {
      setStatus(s)
      if (s.email && !email) setEmail(s.email)
      if (s.state === 'connected') {
        const list = await window.api.ring?.listCameras()
        setCameras(list ?? [])
      } else {
        setCameras([])
      }
    }
  }, [email])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  const handleConnect = async () => {
    if (!email.trim() || !password) return
    setBusy(true)
    try {
      const s = await window.api.ring.connect(email.trim(), password)
      setStatus(s)
      if (s.state !== 'needs-2fa') setPassword('')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit2fa = async () => {
    if (!twofa.trim()) return
    setBusy(true)
    try {
      const s = await window.api.ring.submit2fa(twofa.trim())
      setStatus(s)
      setTwofa('')
      setPassword('')
      if (s.state === 'connected') {
        const list = await window.api.ring.listCameras()
        setCameras(list)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Ring? You\'ll need to re-enter your 2FA code to reconnect.')) return
    setBusy(true)
    try {
      await window.api.ring.disconnect()
      setPassword('')
      setTwofa('')
      setCameras([])
      await refreshStatus()
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  }
  const cardStyle = { background: 'var(--card-bg)', border: '1px solid var(--card-border)' }

  const state = status?.state ?? 'disconnected'

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ring</h2>

      {/* ── Connection card ── */}
      <div className="rounded-xl p-4 space-y-4" style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Account
          </p>
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLOR[state] }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {STATUS_LABEL[state]}
            </span>
          </div>
        </div>

        {state === 'connected' && (
          <>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Signed in as <strong>{status?.email}</strong>
            </p>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#ef4444' }}
            >
              Disconnect
            </button>
          </>
        )}

        {state !== 'connected' && state !== 'needs-2fa' && (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Sign in with your Ring account. Ring will text/email you a 2FA code to confirm.
              Your password is never stored — only a refresh token, encrypted on disk.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ring account email"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
              style={inputStyle}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ring password"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            <button
              onClick={handleConnect}
              disabled={busy || !email.trim() || !password}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
              style={{ background: '#3b82f6', color: '#fff' }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        )}

        {state === 'needs-2fa' && (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {status?.twoFactorPrompt || 'Enter the code Ring just sent you.'}
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={twofa}
                onChange={(e) => setTwofa(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="123456"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none font-mono tracking-widest min-h-[44px]"
                style={inputStyle}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit2fa()}
              />
              <button
                onClick={handleSubmit2fa}
                disabled={busy || !twofa.trim()}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
                style={{ background: '#3b82f6', color: '#fff' }}
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {status?.errorMessage && (
          <p className="text-xs" style={{ color: '#ef4444' }}>{status.errorMessage}</p>
        )}
      </div>

      {/* ── Cameras list ── */}
      {state === 'connected' && (
        <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Detected cameras
          </p>
          {cameras.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No cameras found on this Ring account.
            </p>
          ) : (
            <ul className="space-y-2">
              {cameras.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {c.deviceType}
                    {c.hasBattery && c.batteryLevel != null && ` · ${c.batteryLevel}%`}
                    {!c.online && ' · offline'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Snapshot interval ── */}
      <div className="rounded-xl p-4 space-y-2" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Snapshot refresh interval
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          How often Ring snapshots refresh on the Cameras page. Lower values use more bandwidth
          and battery on your Ring devices.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-mono w-16 text-right" style={{ color: 'var(--text-primary)' }}>
            {intervalSec}s
          </span>
        </div>
      </div>
    </div>
  )
}
