import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import type { WyzeCamera } from '../../../../preload/types'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function CameraSettings() {
  const cameras    = useSettingsStore((s) => s.cameras)
  const setCameras = useSettingsStore((s) => s.setCameras)

  const [bridgeHost, setBridgeHost]           = useState('localhost:8554')
  const [draftName, setDraftName]             = useState('')
  const [draftRtsp, setDraftRtsp]             = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId]             = useState<string | null>(null)
  const [editName, setEditName]               = useState('')
  const [editRtsp, setEditRtsp]               = useState('')

  // Auto-fill RTSP URL when name is typed, if URL hasn't been manually edited
  const handleNameChange = (name: string) => {
    setDraftName(name)
    const slug = slugify(name)
    if (slug) setDraftRtsp(`rtsp://${bridgeHost}/${slug}`)
    else setDraftRtsp('')
  }

  const handleBridgeHostChange = (host: string) => {
    setBridgeHost(host)
    // Re-generate URL if name is already set
    const slug = slugify(draftName)
    if (slug) setDraftRtsp(`rtsp://${host}/${slug}`)
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

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Cameras</h2>

      {/* ── Docker Wyze Bridge setup note ─────────────────────────────────── */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Docker Wyze Bridge
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Wyze Cam v4 doesn't support native RTSP. Use{' '}
          <span className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'var(--bg-base)' }}>
            docker-wyze-bridge
          </span>{' '}
          to proxy streams locally. Run once on this machine:
        </p>
        <pre
          className="text-xs p-3 rounded-lg overflow-x-auto leading-relaxed"
          style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
        >{`docker run -d --restart unless-stopped \\
  -p 8554:8554 -p 8888:8888 \\
  -e WYZE_EMAIL=you@email.com \\
  -e WYZE_PASSWORD=yourpass \\
  --name wyze-bridge \\
  mrlt8/wyze-bridge:latest`}</pre>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Camera names in the bridge match your Wyze app names (lowercased, spaces → dashes).
          FFmpeg must also be installed:{' '}
          <code className="px-1 rounded" style={{ background: 'var(--bg-base)' }}>
            sudo apt install ffmpeg
          </code>
        </p>
      </div>

      {/* ── Bridge host ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p style={labelStyle}>Bridge host</p>
        <input
          type="text"
          value={bridgeHost}
          onChange={(e) => handleBridgeHostChange(e.target.value)}
          placeholder="localhost:8554"
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none font-mono min-h-[44px]"
          style={inputStyle}
        />
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Used to auto-fill RTSP URLs when adding cameras. Change if the bridge runs on another machine.
        </p>
      </div>

      {/* ── Camera list ───────────────────────────────────────────────────── */}
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
                    placeholder={`rtsp://${bridgeHost}/cam-name`}
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
              placeholder={`rtsp://${bridgeHost}/cam-name`}
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
              → {draftRtsp || `rtsp://${bridgeHost}/${slugify(draftName)}`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
