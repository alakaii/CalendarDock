import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from '../../store/settings.slice'
import { TouchButton } from '../shared/TouchButton'

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle = {
  color: 'var(--text-secondary)',
  fontSize: '0.8rem',
  fontWeight: 600 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const inputStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--text-primary)',
}

const cardStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '0.75rem',
  padding: '1rem',
}

function SectionHeader({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  )
}

// ── Google Accounts ────────────────────────────────────────────────────────────

function GoogleSection() {
  const queryClient = useQueryClient()
  const loadSettings = useSettingsStore((s) => s.loadFromMain)
  const [adding, setAdding] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const { data: accounts = [], refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn:  () => window.api.auth.listAccounts(),
    staleTime: 0,
  })

  const handleAdd = async () => {
    setAdding(true)
    setError(null)
    try {
      await window.api.auth.startFlow()
      await refetch()
      await loadSettings()
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect account')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (accountId: string) => {
    try {
      await window.api.auth.removeAccount(accountId)
      await refetch()
      await loadSettings()
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove account')
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="🔵"
        title="Google"
        description="Connect Google accounts for Calendar and Tasks."
      />

      <div className="space-y-2">
        {accounts.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No accounts connected yet.</p>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 rounded-xl p-3"
            style={cardStyle}
          >
            {account.photoUrl ? (
              <img src={account.photoUrl} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-sm font-bold text-white">
                {account.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{account.displayName}</div>
              <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{account.email}</div>
            </div>
            <TouchButton variant="ghost" onClick={() => handleRemove(account.id)}
              className="text-red-500 hover:text-red-400 text-sm px-3 flex-shrink-0">
              Remove
            </TouchButton>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <TouchButton variant="primary" onClick={handleAdd} disabled={adding} className="w-full">
        {adding ? 'Opening browser…' : '+ Add Google Account'}
      </TouchButton>
      {adding && (
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          Complete sign-in in the browser window that opened.
        </p>
      )}
    </div>
  )
}

// ── Weather API Key ────────────────────────────────────────────────────────────

function WeatherApiSection() {
  const weather      = useSettingsStore((s) => s.weather)
  const loadSettings = useSettingsStore((s) => s.loadFromMain)

  const [changingKey, setChangingKey] = useState(!weather.apiKey)
  const [apiKey, setApiKey]           = useState('')
  const [saved, setSaved]             = useState(false)

  const handleSave = async () => {
    if (!apiKey.trim()) return
    await window.api.settings.setWeatherApiKey(apiKey.trim())
    setApiKey('')
    setChangingKey(false)
    await loadSettings()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="🌤"
        title="Weather"
        description="OpenWeatherMap API key for current conditions and forecast."
      />

      {weather.apiKey && !changingKey ? (
        <div className="flex items-center justify-between rounded-xl px-4 py-3 min-h-[44px]" style={cardStyle}>
          <span className="text-sm text-green-500 font-medium">✓ API key configured</span>
          <button onClick={() => setChangingKey(true)} className="text-xs font-medium" style={{ color: '#3b82f6' }}>
            Change
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Paste your API key from openweathermap.org"
            className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            style={inputStyle}
          />
          <div className="flex items-center gap-3">
            <TouchButton variant="primary" onClick={handleSave} disabled={!apiKey.trim()} className="flex-1">
              {saved ? '✓ Saved' : 'Save API Key'}
            </TouchButton>
            {weather.apiKey && (
              <button onClick={() => { setChangingKey(false); setApiKey('') }} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Free key at <span className="text-blue-500">openweathermap.org</span> — may take ~10 min to activate after signup.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Dropbox ────────────────────────────────────────────────────────────────────

function DropboxSection() {
  const loadSettings        = useSettingsStore((s) => s.loadFromMain)
  const dropboxAccountEmail = useSettingsStore((s) => s.dropboxAccountEmail)
  const dropboxAppKey       = useSettingsStore((s) => s.dropboxAppKey)

  const [appKeyInput, setAppKeyInput]       = useState(dropboxAppKey || '')
  const [connecting, setConnecting]         = useState(false)
  const [connectError, setConnectError]     = useState('')
  const [connected, setConnected]           = useState(false)
  const [connectedEmail, setConnectedEmail] = useState(dropboxAccountEmail || '')

  useEffect(() => {
    window.api.dropbox.getStatus().then((s) => {
      setConnected(s.connected)
      setConnectedEmail(s.email || '')
    })
  }, [])

  const handleConnect = async () => {
    if (!appKeyInput.trim()) { setConnectError('Enter your Dropbox App Key first.'); return }
    setConnecting(true)
    setConnectError('')
    try {
      const result = await window.api.dropbox.connect(appKeyInput.trim())
      setConnected(true)
      setConnectedEmail(result.email)
      await loadSettings()
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err))
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await window.api.dropbox.disconnect()
    setConnected(false)
    setConnectedEmail('')
    await loadSettings()
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="📦"
        title="Photos — Dropbox"
        description="Sync photos from a Dropbox folder for the slideshow."
      />

      <div
        className="rounded-xl p-3 space-y-1.5"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
      >
        <p className="text-xs font-semibold text-blue-500">One-time Dropbox app setup</p>
        <ol className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>1. Go to <span className="font-mono text-blue-400">dropbox.com/developers</span> → My Apps → Create app</li>
          <li>2. Choose <strong>Scoped access</strong> → <strong>Full Dropbox</strong> (or App folder)</li>
          <li>3. Under <strong>OAuth 2 → Redirect URIs</strong>, add exactly:</li>
        </ol>
        <div
          className="rounded-lg px-3 py-2 font-mono text-sm select-all"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          http://127.0.0.1:47391
        </div>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          4. Copy the <strong>App key</strong> from the Settings tab and paste it below.
        </p>
      </div>

      {!connected ? (
        /* ── Not connected ── */
        <div className="space-y-3">
          <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>App Key</p>
              <input
                type="text"
                placeholder="e.g. abc123xyz"
                value={appKeyInput}
                onChange={(e) => setAppKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            {connectError && <p className="text-xs text-red-400">{connectError}</p>}
          </div>
          <TouchButton variant="primary" onClick={handleConnect} disabled={connecting} className="w-full">
            {connecting ? 'Opening browser…' : 'Connect Dropbox Account'}
          </TouchButton>
        </div>
      ) : (
        /* ── Connected ── */
        <div className="space-y-3">
          <div className="rounded-xl p-4 space-y-1" style={cardStyle}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Connected</span>
              <span className="text-xs ml-auto font-mono" style={{ color: 'var(--text-secondary)' }}>{connectedEmail}</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Folder, photo count, and sync are managed in <strong>Settings → Photos</strong>.
            </p>
          </div>

          <TouchButton variant="destructive" onClick={handleDisconnect} className="w-full">
            Disconnect Dropbox
          </TouchButton>
        </div>
      )}
    </div>
  )
}

// ── Rachio (Sprinklers) ────────────────────────────────────────────────────────

function RachioSection() {
  const rachioApiKey    = useSettingsStore((s) => s.rachioApiKey)
  const setRachioApiKey = useSettingsStore((s) => s.setRachioApiKey)
  const [draft, setDraft] = useState(rachioApiKey)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setRachioApiKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="💧"
        title="Sprinklers — Rachio"
        description="API key from the Rachio app: Account → API Access → Create API Key."
      />

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
        <p className="text-xs" style={{ color: '#22c55e' }}>✓ API key configured.</p>
      )}
    </div>
  )
}

// ── Rinnai (Water Heater) ──────────────────────────────────────────────────────

function RinnaiSection() {
  const rinnaiEmail          = useSettingsStore((s) => s.rinnaiEmail)
  const rinnaiPassword       = useSettingsStore((s) => s.rinnaiPassword)
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

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="🔥"
        title="Water Heater — Rinnai Control-R"
        description="Uses your Rinnai Control-R app credentials. Stored locally on-device. Note: the API rate-limits to ~one request every 10 minutes."
      />

      {!editing && rinnaiEmail ? (
        <div className="rounded-xl p-4 space-y-1" style={cardStyle}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{rinnaiEmail}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Password saved</p>
          {saved && <p className="text-xs text-green-500">✓ Credentials saved</p>}
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

// ── Main ───────────────────────────────────────────────────────────────────────

export default function AccountsSettings() {
  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Accounts &amp; API Keys</h2>

      <div className="space-y-10">
        <GoogleSection />
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
          <WeatherApiSection />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
          <DropboxSection />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
          <RachioSection />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
          <RinnaiSection />
        </div>
      </div>
    </div>
  )
}
