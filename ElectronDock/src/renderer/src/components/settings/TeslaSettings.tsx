import { useEffect, useState } from 'react'
import type { TeslaConnectionStatus, TeslaVehicleConfig, TeslaLocalTestResult } from '../../../../preload/types'
import { useSettingsStore } from '../../store/settings.slice'

export default function TeslaSettings() {
  const [status, setStatus]       = useState<TeslaConnectionStatus | null>(null)
  const [vehicles, setVehicles]   = useState<TeslaVehicleConfig[]>([])
  const [busy, setBusy]           = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  // Other components (TeslaPage) gate on teslaConnectedAt from the slice, which
  // is hydrated only on app start. Connect/disconnect mutate main-process state
  // directly, so we need to re-pull the slice after those for the rest of the
  // app to see the new connection state.
  const reloadSlice = useSettingsStore((s) => s.loadFromMain)

  // ── Connection mode (Fleet API vs direct Wi-Fi) ──
  const mode              = useSettingsStore((s) => s.teslaConnectionMode)
  const setMode           = useSettingsStore((s) => s.setTeslaConnectionMode)
  const gatewayHostSaved  = useSettingsStore((s) => s.teslaGatewayHost)
  const gatewayConfigured = useSettingsStore((s) => s.teslaGatewayConfigured)

  // ── Local (direct connect) form state ──
  const [localHost, setLocalHost]         = useState(gatewayHostSaved || '192.168.91.1')
  const [localPassword, setLocalPassword] = useState('')
  const [localBusy, setLocalBusy]         = useState(false)
  const [localTest, setLocalTest]         = useState<TeslaLocalTestResult | null>(null)

  useEffect(() => {
    void loadAll()
  }, [])

  // Keep the host field in sync if the slice hydrates after mount.
  useEffect(() => {
    setLocalHost(gatewayHostSaved || '192.168.91.1')
  }, [gatewayHostSaved])

  async function loadAll() {
    try {
      const [s, v] = await Promise.all([
        window.api.tesla.getConnectionStatus(),
        window.api.tesla.listVehicles(),
      ])
      setStatus(s)
      setVehicles(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Tesla connection status')
    }
  }

  async function handleConnect() {
    setBusy(true); setError(null)
    try {
      const next = await window.api.tesla.connect()
      setStatus(next)
      // connect() refreshes /products as a side-effect — pull the freshly-merged list
      setVehicles(await window.api.tesla.listVehicles())
      await reloadSlice()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    setBusy(true); setError(null)
    try {
      await window.api.tesla.disconnect()
      await loadAll()
      await reloadSlice()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleVehicle(id: string, enabled: boolean) {
    // Optimistic — flip locally, then persist. Revert on error.
    const prev = vehicles
    setVehicles(prev.map((v) => v.id === id ? { ...v, enabled } : v))
    try {
      const next = await window.api.tesla.setVehicleEnabled(id, enabled)
      setVehicles(next)
    } catch (err) {
      setVehicles(prev)
      setError(err instanceof Error ? err.message : 'Failed to update vehicle')
    }
  }

  async function handleRefreshVehicles() {
    setRefreshing(true); setError(null)
    try {
      setVehicles(await window.api.tesla.refreshProducts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  // ── Local (direct connect) actions ──

  async function handleSaveAndTest() {
    setLocalBusy(true); setLocalTest(null)
    try {
      // Only (re)write credentials when a password is entered — leaving the
      // field blank while already configured re-tests the saved creds rather
      // than clearing them.
      if (localPassword.trim()) {
        await window.api.tesla.setGatewayConfig(localHost.trim() || '192.168.91.1', localPassword.trim())
        await reloadSlice()
        setLocalPassword('')
      }
      const result = await window.api.tesla.testLocalConnection()
      setLocalTest(result)
    } catch (err) {
      setLocalTest({ ok: false, siteName: '', error: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setLocalBusy(false)
    }
  }

  async function handleForgetGateway() {
    setLocalBusy(true)
    try {
      await window.api.tesla.clearGatewayConfig()
      await reloadSlice()
      setLocalTest(null)
      setLocalPassword('')
    } finally {
      setLocalBusy(false)
    }
  }

  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  const inputStyle = {
    background: 'var(--bg-base)',
    border: '1px solid var(--card-border)',
    color: 'var(--text-primary)',
  }

  const connected = !!status?.connected
  const connectedAtLabel = status?.connectedAt
    ? new Date(status.connectedAt).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Powerwall</h2>

      {/* Connection-mode selector */}
      <div className="space-y-3">
        <p style={labelStyle}>Connection</p>
        <div
          className="inline-flex rounded-xl p-1 gap-1"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          {([
            { key: 'fleet', label: 'Tesla Fleet API' },
            { key: 'local', label: 'Direct connect (Wi-Fi)' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[40px] transition-colors"
              style={{
                background: mode === opt.key ? '#3b82f6' : 'transparent',
                color:      mode === opt.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'fleet' ? (
        <>
          <div className="space-y-2">
            <p style={labelStyle}>Tesla Fleet API</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Connects to your Powerwall through Tesla's cloud API. Sign in with the Tesla
              account that owns the Powerwall — the same account you use for the Tesla mobile app.
            </p>
          </div>

          {connected ? (
            <div className="rounded-xl p-4 space-y-1"
                 style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Connected{status?.siteName ? ` — ${status.siteName}` : ''}
              </p>
              {connectedAtLabel && (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Signed in {connectedAtLabel}
                </p>
              )}
              {error && (
                <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleConnect}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl font-semibold text-sm min-h-[44px] disabled:opacity-30"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                >
                  {busy ? 'Working…' : 'Sign in again'}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl font-semibold text-sm min-h-[44px] disabled:opacity-30"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#f87171' }}
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {error && (
                <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
              )}
              <button
                onClick={handleConnect}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 min-h-[44px]"
                style={{ background: '#3b82f6', color: '#fff' }}
              >
                {busy ? 'Opening browser…' : 'Sign in with Tesla'}
              </button>
            </div>
          )}

          {connected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p style={labelStyle}>Vehicles on this dock</p>
                <button
                  onClick={handleRefreshVehicles}
                  disabled={refreshing}
                  className="text-xs font-semibold disabled:opacity-30"
                  style={{ color: '#3b82f6' }}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {vehicles.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No vehicles found on this Tesla account.
                </p>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Toggle off any car you don't want on the dock (e.g. an extended-family vehicle
                  that shares your account but lives elsewhere). Hit Refresh after adding a new car.
                </p>
              )}

              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl p-3 flex items-center justify-between"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {v.displayName || '(unnamed)'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {v.accessType ? v.accessType.toLowerCase() : '—'}
                      {v.vin ? ` · ${v.vin.slice(-6)}` : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>{v.enabled ? 'Shown' : 'Hidden'}</span>
                    <input
                      type="checkbox"
                      checked={v.enabled}
                      onChange={(e) => handleToggleVehicle(v.id, e.target.checked)}
                      className="w-5 h-5"
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <p style={labelStyle}>Direct connect (Wi-Fi)</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Reads the Powerwall straight from its Gateway over the local network (TEDAPI) —
              no cloud, no Tesla account, no per-call cost, and it updates every 30&nbsp;seconds.
            </p>
          </div>

          {/* Hard requirement — the gateway only answers on its own AP. */}
          <div
            className="rounded-xl p-3 text-xs leading-relaxed"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24' }}
          >
            <span className="font-semibold">This dock must be on the Powerwall's Wi-Fi.</span>{' '}
            The Gateway only accepts TEDAPI from a device joined to its own access point
            (<span className="font-mono">TeslaPW_…</span> → {gatewayHostSaved || '192.168.91.1'}). If this dock is on
            your home network instead, direct connect won't reach it — keep it on a network
            interface that's associated to the Powerwall AP.
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label style={labelStyle}>Gateway IP</label>
              <input
                type="text"
                value={localHost}
                onChange={(e) => setLocalHost(e.target.value)}
                placeholder="192.168.91.1"
                className="w-full px-3 py-2 rounded-xl text-sm min-h-[44px] font-mono"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1.5">
              <label style={labelStyle}>Gateway Wi-Fi password</label>
              <input
                type="password"
                value={localPassword}
                onChange={(e) => setLocalPassword(e.target.value)}
                placeholder={gatewayConfigured ? '•••••••••• (saved)' : 'Password on the Gateway sticker'}
                className="w-full px-3 py-2 rounded-xl text-sm min-h-[44px]"
                style={inputStyle}
              />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                The same password you use to join the <span className="font-mono">TeslaPW_…</span> Wi-Fi
                (printed on the Gateway / the QR sticker). Stored encrypted on this device.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveAndTest}
                disabled={localBusy || (!localPassword.trim() && !gatewayConfigured)}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 min-h-[44px]"
                style={{ background: '#3b82f6', color: '#fff' }}
              >
                {localBusy ? 'Testing…' : 'Save & test'}
              </button>
              {gatewayConfigured && (
                <button
                  onClick={handleForgetGateway}
                  disabled={localBusy}
                  className="px-4 py-2 rounded-xl font-semibold text-sm min-h-[44px] disabled:opacity-30"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#f87171' }}
                >
                  Forget
                </button>
              )}
            </div>

            {localTest && (
              <div
                className="rounded-xl p-3 text-sm"
                style={{
                  background: 'var(--card-bg)',
                  border: `1px solid ${localTest.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  color: localTest.ok ? '#22c55e' : '#f87171',
                }}
              >
                {localTest.ok
                  ? `✓ Connected${localTest.siteName ? ` — ${localTest.siteName}` : ''}`
                  : `✗ ${localTest.error}`}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
