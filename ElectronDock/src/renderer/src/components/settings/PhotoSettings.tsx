import { useSettingsStore } from '../../store/settings.slice'
import { TouchButton } from '../shared/TouchButton'
import type { SlideshowSortOrder, SlideshowTransition } from '../../../../preload/types'

export default function PhotoSettings() {
  const photoFolderPath = useSettingsStore((s) => s.photoFolderPath)
  const slideshow = useSettingsStore((s) => s.slideshow)
  const setSlideshowSettings = useSettingsStore((s) => s.setSlideshowSettings)
  const loadSettings = useSettingsStore((s) => s.loadFromMain)

  const handleBrowse = async () => {
    const path = await window.api.settings.browseFolderDialog()
    if (path) {
      await window.api.settings.setPhotoFolder(path)
      await loadSettings()
    }
  }

  const sortOrders: { value: SlideshowSortOrder; label: string; description: string }[] = [
    { value: 'filename', label: 'By filename',    description: 'A → Z alphabetically' },
    { value: 'date',     label: 'By date (newest)', description: 'Newest photos first' },
    { value: 'random',   label: 'Random',          description: 'Shuffle each session' },
  ]

  const transitions: { value: SlideshowTransition; label: string; description: string }[] = [
    { value: 'fade', label: 'Crossfade', description: 'Smooth opacity blend' },
    { value: 'zoom', label: 'Zoom + fade', description: 'Ken Burns slow zoom' },
  ]

  const labelStyle = { color: 'var(--text-primary)' }
  const subStyle   = { color: 'var(--text-secondary)' }

  return (
    <div className="space-y-8 max-w-lg">
      {/* ── Folder ── */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold" style={labelStyle}>Slideshow Photos</h3>
        <p className="text-sm" style={subStyle}>
          Point to any folder of photos on your computer. New and removed photos are detected automatically.
          Supports JPG, PNG, GIF, WEBP, and HEIC.
        </p>

        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <p className="text-xs font-medium mb-1" style={subStyle}>Current folder</p>
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

      {/* ── Duration ── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>
            Slide duration — {slideshow.durationSec}s
          </label>
          <p className="text-xs mt-0.5" style={subStyle}>How long each photo is shown</p>
        </div>
        <input
          type="range"
          min={3} max={30} step={1}
          value={slideshow.durationSec}
          onChange={(e) =>
            setSlideshowSettings({ ...slideshow, durationSec: Number(e.target.value) })
          }
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: '#3b82f6' }}
        />
        <div className="flex justify-between text-xs" style={subStyle}>
          <span>3s</span><span>30s</span>
        </div>
      </section>

      {/* ── Sort order ── */}
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
                background:     slideshow.sortOrder === o.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor:    slideshow.sortOrder === o.value ? '#3b82f6' : 'var(--border)',
                color:          slideshow.sortOrder === o.value ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs font-semibold">{o.label}</span>
              <span className="text-[10px]" style={subStyle}>{o.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Transition type ── */}
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
                background:     slideshow.transition === t.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor:    slideshow.transition === t.value ? '#3b82f6' : 'var(--border)',
                color:          slideshow.transition === t.value ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs font-semibold">{t.label}</span>
              <span className="text-[10px]" style={subStyle}>{t.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Transition duration ── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium" style={labelStyle}>
            Transition speed — {(slideshow.transitionDurationMs / 1000).toFixed(1)}s
          </label>
          <p className="text-xs mt-0.5" style={subStyle}>How long the fade between photos takes</p>
        </div>
        <input
          type="range"
          min={300} max={3000} step={100}
          value={slideshow.transitionDurationMs}
          onChange={(e) =>
            setSlideshowSettings({ ...slideshow, transitionDurationMs: Number(e.target.value) })
          }
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: '#3b82f6' }}
        />
        <div className="flex justify-between text-xs" style={subStyle}>
          <span>0.3s (instant)</span><span>3s (slow)</span>
        </div>
      </section>
    </div>
  )
}
