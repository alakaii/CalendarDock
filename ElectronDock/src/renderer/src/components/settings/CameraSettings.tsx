import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import type { WyzeCamera, BridgeStatus } from '../../../../preload/types'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const STATUS_COLOR: Record<BridgeStatus, string> = {
  'running':            '#22c55e',
  'stopped':            '#f59e0b',
  'not-found':          '#6b7280',
  'docker-unavailable': '#ef4444',
}

const STATUS_LABEL: Record<BridgeStatus, string> = {
  'running':            'Running',
  'stopped':            'Stopped',
  'not-found':          'Not installed',
  'docker-unavailable': 'Docker unavailable',
}

export default function CameraSettings() {
  const cameras    = useSettingsStore((s) => s.cameras)
  const setCameras = useSettingsStore((s) => s.setCameras)

  // Persisted bridge config
  const storeEmail    = useSettingsStore((s) => s.wyzeBridgeEmail)
  const storePassword = useSettingsStore((s) => s.wyzeBridgePassword)
  const storeHost     = useSettingsStore((s) => s.wyzeBridgeHost)
  const storeApiId    = useSettingsStore((s) => s.wyzeBridgeApiId)
  const storeApiKey   = useSettingsStore((s) => s.wyzeBridgeApiKey)
  const setWyzeBridgeConfig = useSettingsStore((s) => s.setWyzeBridgeConfig)

  // Local draft state for credentials form
  const [draftEmail,    setDraftEmail]    = useState(storeEmail)
  const [draftPassword, setDraftPassword] = useState(storePassword)
  const [draftHost,     setDraftHost]     = useState(storeHost)
  const [draftApiId,    setDraftApiId]    = useState(storeApiId)
  const [draftApiKey,   setDraftApiKey]   = useState(storeApiKey)
  const [credsSaved,    setCredsSaved]    = useState(false)

  const [bridgeStatus,  setBridgeStatus]  = useState<BridgeStatus | null>(null)
  const [bridgeBusy,    setBridgeBusy]    = useState(false)

  const [draftName, setDraftName]             = useState('')
  const [draftRtsp, setDraftRtsp]             = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId]             = useState<string | null>(null)
  const [editName, setEditName]               = useState('')
  const [editRtsp, setEditRtsp]               = useState('')

  const checkStatus = useCallback(async () => {
    const status = await window.api.cameras?.bridgeStatus()
    if (status) setBridgeStatus(status)
  }, [])

  useEffect(() => { checkStatus() }, [checkStatus])

  const handleSaveCreds = () => {
    setWyzeBridgeConfig(draftEmail, draftPassword, draftHost, draftApiId, draftApiKey)
    setCredsSaved(true)
    setTimeout(() => setCredsSaved(false), 2000)
  }

  const handleStart = async () => {
    setBridgeBusy(true)
    try {
      await window.api.cameras?.bridgeStart()
      await checkStatus()
    } catch (err: any) {
      alert(err.message ?? 'Failed to start bridge')
    } finally {
      setBridgeBusy(false)
    }
  }

  const handleStop = async () => {
    setBridgeBusy(true)
    try {
      await window.api.cameras?.bridgeStop()
      await checkStatus()
    } finally {
      setBridgeBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove the wyze-bridge container? You can recreate it by clicking Start.')) return
    setBridgeBusy(true)
    try {
      await window.api.cameras?.bridgeRemove()
      await checkStatus()
    } finally {
      setBridgeBusy(false)
    }
  }

  // Auto-fill RTSP URL when name is typed
  const handleNameChange = (name: string) => {
    setDraftName(name)
    const slug = slugify(name)
    if (slug) setDraftRtsp(`rtsp://${draftHost}/${slug}`)
    else setDraftRtsp('')
  }

  const handleAdd = () => {
    const name = draftName.trim()
    const rtspUrl = draftRtsp.trim()
    if (!name || !rtspUrl) return
    setCameras([...cameras, { id: genId(), name, rtspUrl }])
    setDraftName('')
    setDraftRtsp('')
  }

  const handleDelete = (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return }
    setCameras(cameras.filter((c) => c.id !== id))
    setConfirmDeleteId(null)
  }

  const startEdit = (c: WyzeCamera) => {
    setEditingId(c.id)
    setEditName(c.name)
    setEditRtsp(c.rtspUrl)
  }

  const saveEdit = (id: string) => {
    const name = editName.trim()
    const rtspUrl = editRtsp.trim()
    if (name && rtspUrl) {
      setCameras(cameras.map((c) => c.id === id ? { ...c, name, rtspUrl } : c))
    }
    setEditingId(null)
  }

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  }
  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }
  const cardStyle = { background: 'var(--card-bg)', border: '1px solid var(--card-border)' }

  const credentialsChanged =
    draftEmail    !== storeEmail    ||
    draftPassword !== storePassword ||
    draftHost     !== storeHost     ||
    draftApiId    !== storeApiId    ||
    draftApiKey   !== storeApiKey

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Cameras</h2>

      {/* ── Wyze Bridge control panel ── */}
      <div className="rounded-xl p-4 space-y-4" style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Wyze Bridge
          </p>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {bridgeStatus ? (
              <>
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: STATUS_COLOR[bridgeStatus] }}
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {STATUS_LABEL[bridgeStatus]}
                </span>
              </>
            ) : (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Checking…</span>
            )}
            <button
              onClick={checkStatus}
              className="p-1.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Refresh status"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Wyze removed native RTSP from camera firmware, so the bridge synthesizes it from the
          Wyze cloud. Wyze also deprecated plain email/password login — you must add an
          <strong> API ID</strong> and <strong>API Key</strong> from{' '}
          <span className="font-mono">developer-api-console.wyze.com</span>.
          After updating any field below, click <strong>Remove container</strong> then{' '}
          <strong>Start bridge</strong> so the new env vars take effect.
        </p>

        {/* Credentials */}
        <div className="space-y-2">
          <input
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            placeholder="Wyze account email"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          <input
            type="password"
            value={draftPassword}
            onChange={(e) => setDraftPassword(e.target.value)}
            placeholder="Wyze password"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          <input
            type="text"
            value={draftApiId}
            onChange={(e) => setDraftApiId(e.target.value)}
            placeholder="Wyze API ID (UUID from developer console)"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none font-mono min-h-[44px]"
            style={inputStyle}
          />
          <input
            type="password"
            value={draftApiKey}
            onChange={(e) => setDraftApiKey(e.target.value)}
            placeholder="Wyze API Key"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none font-mono min-h-[44px]"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={draftHost}
              onChange={(e) => setDraftHost(e.target.value)}
              placeholder="Bridge host (e.g. localhost:8554)"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none font-mono min-h-[44px]"
              style={inputStyle}
            />
            <button
              onClick={handleSaveCreds}
              disabled={!credentialsChanged && !credsSaved}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 min-h-[44px]"
              style={{ background: credsSaved ? '#22c55e' : '#3b82f6', color: '#fff' }}
            >
              {credsSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          {credentialsChanged && (
            <p className="text-xs" style={{ color: '#f59e0b' }}>
              Unsaved changes — save, remove the container, then start it again to apply.
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleStart}
            disabled={bridgeBusy || bridgeStatus === 'running' || bridgeStatus === 'docker-unavailable' || !storeEmail || !storePassword}
            className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
            style={{ background: '#22c55e', color: '#fff' }}
          >
            {bridgeBusy ? 'Working…' : 'Start bridge'}
          </button>
          <button
            onClick={handleStop}
            disabled={bridgeBusy || bridgeStatus !== 'running'}
            className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
          >
            Stop
          </button>
          {(bridgeStatus === 'stopped' || bridgeStatus === 'running') && (
            <button
              onClick={handleRemove}
              disabled={bridgeBusy}
              className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#ef4444' }}
            >
              Remove container
            </button>
          )}
        </div>

        {bridgeStatus === 'docker-unavailable' && (
          <p className="text-xs" style={{ color: '#ef4444' }}>
            Docker not found. Install Docker Desktop (Windows/Mac) or run{' '}
            <code className="px-1 rounded" style={{ background: 'var(--bg-base)' }}>
              curl -fsSL https://get.docker.com | sh
            </code>{' '}
            on Linux, then relaunch the app.
          </p>
        )}
      </div>

      {/* ── Camera list ── */}
      <div className="space-y-3">
        <p style={labelStyle}>Camera feeds</p>

        {cameras.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No cameras added yet.</p>
        )}

        <div className="space-y-2">
          {cameras.map((c) => (
            <div key={c.id} className="rounded-xl p-3 space-y-2" style={cardStyle}>
              {editingId === c.id ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Camera name"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none min-h-[40px]"
                    style={inputStyle}
                  />
                  <input
                    value={editRtsp}
                    onChange={(e) => setEditRtsp(e.target.value)}
                    placeholder={`rtsp://${draftHost}/cam-name`}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono min-h-[40px]"
                    style={inputStyle}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(c.id)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(c.id)}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold min-h-[36px]"
                      style={{ background: '#3b82f6', color: '#fff' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold min-h-[36px]"
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{c.rtspUrl}</p>
                  </div>
                  <button
                    onClick={() => startEdit(c)}
                    className="p-2 rounded-lg opacity-50 hover:opacity-100 transition-opacity min-h-[40px] min-w-[40px] flex items-center justify-center"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {confirmDeleteId === c.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: '#f87171' }}>Delete?</span>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px]"
                        style={{ background: '#ef4444', color: '#fff' }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px]"
                        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-2 rounded-lg opacity-40 hover:opacity-100 transition-opacity min-h-[40px] min-w-[40px] flex items-center justify-center"
                      style={{ color: '#ef4444' }}
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add camera */}
        <div className="space-y-2 mt-2">
          <input
            type="text"
            value={draftName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Camera name (e.g. Front Door)"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={draftRtsp}
              onChange={(e) => setDraftRtsp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={`rtsp://${draftHost}/cam-name`}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none font-mono min-h-[44px]"
              style={inputStyle}
            />
            <button
              onClick={handleAdd}
              disabled={!draftName.trim() || !draftRtsp.trim()}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
              style={{ background: '#3b82f6', color: '#fff' }}
            >
              Add
            </button>
          </div>
          {draftName && (
            <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              → {draftRtsp || `rtsp://${draftHost}/${slugify(draftName)}`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
