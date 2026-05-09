import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { TouchButton } from '../shared/TouchButton'
import type { SlideshowSortOrder, SlideshowTransition } from '../../../../preload/types'

export default function PhotoSettings() {
  const photoFolderPath      = useSettingsStore((s) => s.photoFolderPath)
  const slideshow            = useSettingsStore((s) => s.slideshow)
  const setSlideshowSettings = useSettingsStore((s) => s.setSlideshowSettings)
  const loadSettings         = useSettingsStore((s) => s.loadFromMain)

  // Dropbox state
  const dropboxEnabled      = useSettingsStore((s) => s.dropboxEnabled)
  const dropboxAccountEmail = useSettingsStore((s) => s.dropboxAccountEmail)
  const dropboxFolderPath   = useSettingsStore((s) => s.dropboxFolderPath)
  const dropboxPhotoCount   = useSettingsStore((s) => s.dropboxPhotoCount)
  const dropboxLastSync     = useSettingsStore((s) => s.dropboxLastSync)

  const dropboxConnected = !!dropboxAccountEmail

  // Local mutable Dropbox config state
  const [folderInput, setFolderInput] = useState(dropboxFolderPath || '')
  const [photoCount, setPhotoCount]   = useState(dropboxPhotoCount ?? 200)
  const [syncing, setSyncing]         = useState(false)
  const [syncPct, setSyncPct]         = useState(0)
  const [syncStatus, setSyncStatus]   = useState('')
  const [loadedCount, setPhotoCount2] = useState<number | null>(null)

  useEffect(() => {
    window.api.dropbox.getStatus().then((s) => setSyncing(s.isSyncing))
    window.api.dropbox.onProgress((pct, status) => {
      setSyncPct(pct)
      setSyncStatus(status)
      if (pct >= 100) setSyncing(false)
    })
    // Load current photo count and listen for updates
    window.api.photos.getList().then((list) => setPhotoCount2(list.length))
    window.api.photos.onListUpdated((list) => setPhotoCount2(list.length))
  }, [])

  // source = 'local' when dropboxEnabled is false, 'dropbox' when true
  const source: 'local' | 'dropbox' = dropboxEnabled ? 'dropbox' : 'local'

  const setSource = (s: 'local' | 'dropbox') => {
    if (s === 'dropbox' && !dropboxConnected) return
    window.api.dropbox.setConfig({ enabled: s === 'dropbox' })
    loadSettings()
  }

  const handleFolderSave = () => {
    window.api.dropbox.setConfig({ folderPath: folderInput.trim() })
    loadSettings()
  }

  // Touch on Wayland sometimes misses onTouchEnd if the finger releases off
  // the slider track, so we don't rely on that — debounce-save whenever the
  // value changes and the user has been still for 250ms.
  const photoCountFirstRun = useRef(true)
  useEffect(() => {
    if (photoCountFirstRun.current) {
      photoCountFirstRun.current = false
      return
    }
    const id = setTimeout(() => {
      window.api.dropbox.setConfig({ photoCount })
      loadSettings()
    }, 250)
    return () => clearTimeout(id)
  }, [photoCount, loadSettings])

  const handleSyncNow = async () => {
    setSyncing(true)
    setSyncPct(0)
    setSyncStatus('Starting…')
    try {
      await window.api.dropbox.syncNow()
      await loadSettings()
    } catch (_) {
      setSyncing(false)
    }
  }

  const handleBrowse = async () => {
    const path = await window.api.settings.browseFolderDialog()
    if (path) {
      await window.api.settings.setPhotoFolder(path)
      await loadSettings()
    }
  }

  const sortOrders: { value: SlideshowSortOrder; label: string; description: string }[] = [
    { value: 'filename', label: 'By filename',     description: 'A → Z alphabetically' },
    { value: 'date',     label: 'By date (newest)', description: 'Newest photos first' },
    { value: 'random',   label: 'Random',           description: 'Shuffle each session' },
  ]

  const transitions: { value: SlideshowTransition; label: string; description: string }[] = [
    { value: 'fade', label: 'Crossfade',   description: 'Smooth opacity blend' },
    { value: 'zoom', label: 'Zoom + fade', description: 'Ken Burns slow zoom' },
  ]

  const cropModes: { value: 'fit' | 'focus'; label: string; description: string }[] = [
    { value: 'fit',   label: 'Scale to fit', description: 'Whole photo, blurred backdrop' },
    { value: 'focus', label: 'Focus',        description: 'Fill the screen, anchor on subject' },
  ]

  const labelStyle = { color: 'var(--text-primary)' }
  const subStyle   = { color: 'var(--text-secondary)' }
  const cardStyle  = { background: 'var(--card-bg)', border: '1px solid var(--card-border)' }

  const formatLastSync = (ts: number) => !ts ? 'Never' : new Date(ts).toLocaleString()

  return (
    <div className="space-y-8 max-w-lg">
      <h3 className="text-lg font-semibold" style={labelStyle}>Photos</h3>

      {/* ── Photo source toggle ── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>Photo source</label>
          <p className="text-xs mt-0.5" style={subStyle}>Where the slideshow pulls photos from</p>
        </div>
        <div className="flex gap-2">
          {([
            { id: 'local',   icon: '📁', label: 'Local folder' },
            { id: 'dropbox', icon: '📦', label: 'Dropbox' },
          ] as const).map((opt) => {
            const isSelected = source === opt.id
            const disabled   = opt.id === 'dropbox' && !dropboxConnected
            return (
              <button
                key={opt.id}
                onClick={() => setSource(opt.id)}
                disabled={disabled}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40"
                style={{
                  background:  isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                  borderColor: isSelected ? '#3b82f6' : 'var(--border)',
                  color:       isSelected ? '#3b82f6' : 'var(--text-primary)',
                  minHeight: 52,
                }}
              >
                <span>{opt.icon}</span>
                {opt.label}
              </button>
            )
          })}
        </div>
        {!dropboxConnected && (
          <p className="text-xs" style={subStyle}>
            Dropbox not connected — go to <strong>Accounts</strong> to set it up.
          </p>
        )}
      </section>

      {/* ── Local folder ── */}
      {source === 'local' && (
        <section className="space-y-3">
          <div>
            <label className="text-sm font-medium" style={labelStyle}>Local folder</label>
            <p className="text-xs mt-0.5" style={subStyle}>
              Supports JPG, PNG, GIF, WEBP, HEIC. Changes detected automatically.
            </p>
          </div>

          <div className="rounded-xl p-4 space-y-2" style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium" style={subStyle}>Current folder</p>
              {loadedCount !== null && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
                >
                  {loadedCount.toLocaleString()} photos
                </span>
              )}
            </div>
            <p
              className="text-sm font-mono break-all"
              style={{ color: 'var(--text-primary)', opacity: photoFolderPath ? 1 : 0.4 }}
            >
              {photoFolderPath || 'Not configured'}
            </p>
          </div>

          <TouchButton variant="primary" onClick={handleBrowse} className="w-full">
            Browse for Folder…
          </TouchButton>

          <div className="p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs font-semibold mb-1 text-blue-500">iCloud tip</p>
            <p className="text-xs" style={subStyle}>
              iCloud for Windows shared album photos are typically at{' '}
              <span className="font-mono">C:\Users\[You]\Pictures\iCloud Photos\Shared</span>
            </p>
          </div>
        </section>
      )}

      {/* ── Dropbox config ── */}
      {source === 'dropbox' && dropboxConnected && (
        <section className="space-y-3">
          {/* Status row */}
          <div className="rounded-xl p-4 space-y-1" style={cardStyle}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm font-medium" style={labelStyle}>Connected</span>
              <span className="text-xs ml-auto font-mono" style={subStyle}>{dropboxAccountEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={subStyle}>Last sync</span>
              <span className="text-xs font-mono" style={labelStyle}>{formatLastSync(dropboxLastSync)}</span>
            </div>
            {loadedCount !== null && (
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs" style={subStyle}>Photos loaded</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
                >
                  {loadedCount.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Folder path */}
          <div className="rounded-xl p-4 space-y-2" style={cardStyle}>
            <p className="text-sm font-medium" style={labelStyle}>Dropbox folder path</p>
            <p className="text-xs" style={subStyle}>
              Path inside your Dropbox, e.g. <span className="font-mono">/Photos/Family</span>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="/Photos/Family"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFolderSave()}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <TouchButton variant="secondary" onClick={handleFolderSave}>Save</TouchButton>
            </div>
          </div>

          {/* Photo count */}
          <div className="rounded-xl p-4 space-y-2" style={cardStyle}>
            <p className="text-sm font-medium" style={labelStyle}>Photos to sync — {photoCount}</p>
            <p className="text-xs" style={subStyle}>Random selection downloaded at midnight</p>
            <input
              type="range" min={50} max={500} step={50}
              value={photoCount}
              onChange={(e) => setPhotoCount(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#3b82f6' }}
            />
            <div className="flex justify-between text-xs" style={subStyle}>
              <span>50</span><span>500</span>
            </div>
          </div>

          {/* Sync */}
          {syncing ? (
            <div className="rounded-xl p-4 space-y-2" style={cardStyle}>
              <div className="flex items-center justify-between text-xs" style={subStyle}>
                <span>{syncStatus}</span><span>{syncPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'var(--border)' }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${syncPct}%`, background: '#3b82f6' }} />
              </div>
            </div>
          ) : (
            <TouchButton variant="secondary" onClick={handleSyncNow} className="w-full">
              Sync Now
            </TouchButton>
          )}
        </section>
      )}

      {/* ── Slideshow settings (always shown) ── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>
            Slide duration — {slideshow.durationSec}s
          </label>
          <p className="text-xs mt-0.5" style={subStyle}>How long each photo is shown</p>
        </div>
        <input
          type="range" min={3} max={30} step={1}
          value={slideshow.durationSec}
          onChange={(e) => setSlideshowSettings({ ...slideshow, durationSec: Number(e.target.value) })}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: '#3b82f6' }}
        />
        <div className="flex justify-between text-xs" style={subStyle}>
          <span>3s</span><span>30s</span>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>Photo order</label>
          <p className="text-xs mt-0.5" style={subStyle}>How photos are sequenced in the slideshow</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {sortOrders.map((o) => (
            <button
              key={o.value}
              onClick={() => setSlideshowSettings({ ...slideshow, sortOrder: o.value })}
              className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl text-left border transition-colors"
              style={{
                background:  slideshow.sortOrder === o.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor: slideshow.sortOrder === o.value ? '#3b82f6' : 'var(--border)',
                color:       slideshow.sortOrder === o.value ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs font-semibold">{o.label}</span>
              <span className="text-[10px]" style={subStyle}>{o.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>Transition effect</label>
          <p className="text-xs mt-0.5" style={subStyle}>Visual effect between slides</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {transitions.map((t) => (
            <button
              key={t.value}
              onClick={() => setSlideshowSettings({ ...slideshow, transition: t.value })}
              className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl text-left border transition-colors"
              style={{
                background:  slideshow.transition === t.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor: slideshow.transition === t.value ? '#3b82f6' : 'var(--border)',
                color:       slideshow.transition === t.value ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs font-semibold">{t.label}</span>
              <span className="text-[10px]" style={subStyle}>{t.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>
            Transition speed — {(slideshow.transitionDurationMs / 1000).toFixed(1)}s
          </label>
          <p className="text-xs mt-0.5" style={subStyle}>How long the fade between photos takes</p>
        </div>
        <input
          type="range" min={300} max={3000} step={100}
          value={slideshow.transitionDurationMs}
          onChange={(e) => setSlideshowSettings({ ...slideshow, transitionDurationMs: Number(e.target.value) })}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: '#3b82f6' }}
        />
        <div className="flex justify-between text-xs" style={subStyle}>
          <span>0.3s (instant)</span><span>3s (slow)</span>
        </div>
      </section>

      {/* ── Photo Crop ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>Photo crop</label>
          <p className="text-xs mt-0.5" style={subStyle}>
            How off-aspect photos (vertical, panoramic, square) are framed.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {cropModes.map((m) => (
            <button
              key={m.value}
              onClick={() => setSlideshowSettings({ ...slideshow, cropMode: m.value })}
              className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl text-left border transition-colors"
              style={{
                background:  slideshow.cropMode === m.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor: slideshow.cropMode === m.value ? '#3b82f6' : 'var(--border)',
                color:       slideshow.cropMode === m.value ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs font-semibold">{m.label}</span>
              <span className="text-[10px]" style={subStyle}>{m.description}</span>
            </button>
          ))}
        </div>

        {/* Focus-mode safe zone slider + preview */}
        {slideshow.cropMode === 'focus' && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium" style={labelStyle}>
                Keep focus within — {slideshow.focusSafeZonePercent}% of frame
              </label>
              <p className="text-[11px] mt-0.5" style={subStyle}>
                Larger = looser. Subject can drift further from center before the photo pans.
              </p>
            </div>
            <input
              type="range" min={30} max={100} step={5}
              value={slideshow.focusSafeZonePercent}
              onChange={(e) => setSlideshowSettings({ ...slideshow, focusSafeZonePercent: Number(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#3b82f6' }}
            />

            {/* Live preview: 16:9 frame with the safe zone overlaid */}
            <div
              className="relative rounded-lg overflow-hidden"
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                background:
                  'repeating-linear-gradient(45deg, var(--bg-base) 0 8px, var(--card-bg) 8px 16px)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="absolute"
                style={{
                  top:    `${(100 - slideshow.focusSafeZonePercent) / 2}%`,
                  left:   `${(100 - slideshow.focusSafeZonePercent) / 2}%`,
                  width:  `${slideshow.focusSafeZonePercent}%`,
                  height: `${slideshow.focusSafeZonePercent}%`,
                  border: '2px dashed #3b82f6',
                  background: 'rgba(59,130,246,0.15)',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.35) inset',
                  pointerEvents: 'none',
                }}
              />
              <span
                className="absolute top-1.5 left-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
              >
                Safe zone preview
              </span>
            </div>

            <p className="text-[11px]" style={subStyle}>
              Heads-up: focus mode currently centers the photo. Face-detection-driven anchoring lands
              in the next update — the slider value will start panning the photo to keep the detected
              subject inside this rectangle.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
