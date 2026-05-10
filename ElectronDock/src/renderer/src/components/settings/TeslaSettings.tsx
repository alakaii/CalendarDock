import { useEffect, useState } from 'react'
import type { TeslaConnectionStatus, TeslaVehicleConfig } from '../../../../preload/types'
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

  useEffect(() => {
    void loadAll()
  }, [])

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

  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
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
    </div>
  )
}
