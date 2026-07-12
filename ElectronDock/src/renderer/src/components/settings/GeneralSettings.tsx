import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import type { ThemeMode, ArtMode, ArtScaleMode } from '../../../../preload/types'
import { SIDEBAR_IMAGE_KEY } from '../shell/Sidebar'
import { HEADER_IMAGE_KEY } from '../shell/AppHeader'

export default function GeneralSettings() {
  const familyName    = useSettingsStore((s) => s.familyName)
  const themeMode     = useSettingsStore((s) => s.themeMode)
  const setFamilyName = useSettingsStore((s) => s.setFamilyName)
  const setThemeMode  = useSettingsStore((s) => s.setThemeMode)

  // ── Background art ──
  const artMode         = useSettingsStore((s) => s.artMode)
  const uiOpacity       = useSettingsStore((s) => s.uiOpacity)
  const artScaleMode    = useSettingsStore((s) => s.artScaleMode)
  const artPixelated    = useSettingsStore((s) => s.artPixelated)
  const setArtMode      = useSettingsStore((s) => s.setArtMode)
  const setUiOpacity    = useSettingsStore((s) => s.setUiOpacity)
  const setArtScaleMode = useSettingsStore((s) => s.setArtScaleMode)
  const setArtPixelated = useSettingsStore((s) => s.setArtPixelated)

  const artFileInputRef = useRef<HTMLInputElement>(null)
  const [artUrl, setArtUrl] = useState<string | null>(null)
  useEffect(() => {
    // Re-scan the folder every time Settings mounts (picks up SSH-dropped files).
    window.api.art.getFullscreen().then(setArtUrl)
  }, [])

  const handleArtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const url = await window.api.art.setFullscreen(bytes, ext)
    setArtUrl(url)
    window.dispatchEvent(new Event('fullscreenArtChanged'))
    e.target.value = ''
  }

  const handleArtRemove = async () => {
    await window.api.art.clearFullscreen()
    setArtUrl(null)
    window.dispatchEvent(new Event('fullscreenArtChanged'))
  }

  const artModes: { value: ArtMode; label: string; description: string }[] = [
    { value: 'border',     label: 'Border',     description: 'Header / sidebar strip images' },
    { value: 'fullscreen', label: 'Fullscreen', description: 'Full-bleed art behind the UI' },
  ]

  const scaleModes: { value: ArtScaleMode; label: string }[] = [
    { value: 'fill',    label: 'Fill' },
    { value: 'fit',     label: 'Fit' },
    { value: 'stretch', label: 'Stretch' },
  ]

  const [nameInput, setNameInput] = useState(familyName)

  // ── Sidebar image ──
  const [sidebarImage, setSidebarImage] = useState<string | null>(
    () => localStorage.getItem(SIDEBAR_IMAGE_KEY)
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      localStorage.setItem(SIDEBAR_IMAGE_KEY, dataUrl)
      setSidebarImage(dataUrl)
      window.dispatchEvent(new Event('sidebarImageChanged'))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleImageRemove = () => {
    localStorage.removeItem(SIDEBAR_IMAGE_KEY)
    setSidebarImage(null)
    window.dispatchEvent(new Event('sidebarImageChanged'))
  }

  // ── Header image ──
  const [headerImage, setHeaderImage] = useState<string | null>(
    () => localStorage.getItem(HEADER_IMAGE_KEY)
  )
  const headerFileInputRef = useRef<HTMLInputElement>(null)

  const handleHeaderImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      localStorage.setItem(HEADER_IMAGE_KEY, dataUrl)
      setHeaderImage(dataUrl)
      window.dispatchEvent(new Event('headerImageChanged'))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleHeaderImageRemove = () => {
    localStorage.removeItem(HEADER_IMAGE_KEY)
    setHeaderImage(null)
    window.dispatchEvent(new Event('headerImageChanged'))
  }

  const handleNameSave = () => {
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== familyName) {
      setFamilyName(trimmed)
    }
  }

  const themeModes: { value: ThemeMode; label: string; description: string }[] = [
    { value: 'auto',  label: 'Auto',  description: 'Light 7am–8pm, dark overnight' },
    { value: 'light', label: 'Light', description: 'Always light mode' },
    { value: 'dark',  label: 'Dark',  description: 'Always dark mode' },
  ]

  return (
    <div className="space-y-8 max-w-lg">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>General</h2>

      {/* Calendar title */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Calendar Title
        </label>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Shown in the top-left header banner
        </p>
        <div className="flex gap-3 mt-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}
            placeholder="Walker Family Calendar"
          />
          <button
            onClick={handleNameSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            Save
          </button>
        </div>
      </section>

      {/* Display */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Display
        </label>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Restore fullscreen / kiosk mode if the window has been resized or escaped.
        </p>
        <button
          onClick={() => window.api.system.enterFullscreen()}
          className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          Return to Fullscreen
        </button>
      </section>

      {/* Header image */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Header Image
        </label>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Background of the top bar — the seasonal gradient tints over it.
          Recommended: <strong>1920 × 100 px</strong>
        </p>
        <input
          ref={headerFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleHeaderImageChange}
        />
        <div className="flex items-center gap-4 mt-2">
          <div
            className="overflow-hidden flex-shrink-0 flex items-center justify-center rounded-xl"
            style={{
              width: 180,
              height: 48,
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
            }}
          >
            {headerImage ? (
              <img src={headerImage} alt="Header preview" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-5 h-5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18M3.75 3h16.5A.75.75 0 0121 3.75v13.5a.75.75 0 01-.75.75H3.75A.75.75 0 013 17.25V3.75A.75.75 0 013.75 3z" />
              </svg>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => headerFileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
              style={{ background: '#3b82f6', color: '#fff' }}
            >
              {headerImage ? 'Change' : 'Upload'}
            </button>
            {headerImage && (
              <button
                onClick={handleHeaderImageRemove}
                className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Sidebar image */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Sidebar Image
        </label>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Background of the left navigation bar.
          Recommended: <strong>130 × 980 px</strong>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
        <div className="flex items-center gap-4 mt-2">
          {/* Preview */}
          <div
            className="rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{
              width: 40,
              height: 120,
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
            }}
          >
            {sidebarImage ? (
              <img src={sidebarImage} alt="Sidebar preview" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-6 h-6 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18M3.75 3h16.5A.75.75 0 0121 3.75v13.5a.75.75 0 01-.75.75H3.75A.75.75 0 013 17.25V3.75A.75.75 0 013.75 3z" />
              </svg>
            )}
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
              style={{ background: '#3b82f6', color: '#fff' }}
            >
              {sidebarImage ? 'Change' : 'Upload'}
            </button>
            {sidebarImage && (
              <button
                onClick={handleImageRemove}
                className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Background art */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Background Art
        </label>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Fullscreen mode shows a full-bleed image behind the whole UI. The
          header / sidebar strip images are hidden while it is on.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {artModes.map((m) => (
            <button
              key={m.value}
              onClick={() => setArtMode(m.value)}
              className="flex flex-col items-start gap-1 px-4 py-3 rounded-xl text-left
                         transition-colors min-h-[64px] border"
              style={{
                background: artMode === m.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor: artMode === m.value ? '#3b82f6' : 'var(--border)',
                color: artMode === m.value ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-sm font-semibold">{m.label}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {m.description}
              </span>
            </button>
          ))}
        </div>

        {artMode === 'fullscreen' && (
          <div className="space-y-6 mt-4">
            {/* Art file */}
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Full-screen image. Recommended: <strong>1920 × 1080 px</strong>. You
                can also drop a PNG into the <code>backgroundArt</code> folder over SSH.
              </p>
              <input
                ref={artFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleArtUpload}
              />
              <div className="flex items-center gap-4 mt-2">
                <div
                  className="overflow-hidden flex-shrink-0 flex items-center justify-center rounded-xl"
                  style={{
                    width: 192,
                    height: 108,
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {artUrl ? (
                    <img
                      src={artUrl}
                      alt="Art preview"
                      className="w-full h-full object-cover"
                      style={{ imageRendering: artPixelated ? 'pixelated' : 'auto' }}
                    />
                  ) : (
                    <svg className="w-6 h-6 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18M3.75 3h16.5A.75.75 0 0121 3.75v13.5a.75.75 0 01-.75.75H3.75A.75.75 0 013 17.25V3.75A.75.75 0 013.75 3z" />
                    </svg>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => artFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
                    style={{ background: '#3b82f6', color: '#fff' }}
                  >
                    {artUrl ? 'Change' : 'Upload'}
                  </button>
                  {artUrl && (
                    <button
                      onClick={handleArtRemove}
                      className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Panel opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Panel Opacity
                </span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {uiOpacity}%
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                How opaque the calendar, header and sidebar are — lower lets more art show through.
              </p>
              <input
                type="range"
                min={20}
                max={100}
                value={uiOpacity}
                onChange={(e) => setUiOpacity(Number(e.target.value))}
                className="w-full accent-blue-500 h-2"
              />
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>20%</span><span>100%</span>
              </div>
            </div>

            {/* Scale mode */}
            <div className="space-y-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Scaling
              </span>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {scaleModes.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setArtScaleMode(m.value)}
                    className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[48px] border"
                    style={{
                      background: artScaleMode === m.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                      borderColor: artScaleMode === m.value ? '#3b82f6' : 'var(--border)',
                      color: artScaleMode === m.value ? '#3b82f6' : 'var(--text-primary)',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pixelated */}
            <button
              onClick={() => setArtPixelated(!artPixelated)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl border"
              style={{
                background: 'var(--bg-base)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span className="text-sm font-semibold">Pixel-Perfect Scaling</span>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Nearest-neighbor — crisp edges for pixel art
                </span>
              </span>
              <span
                className="relative inline-block w-11 h-6 rounded-full transition-colors flex-shrink-0"
                style={{ background: artPixelated ? '#3b82f6' : 'var(--input-border)' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: artPixelated ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </span>
            </button>
          </div>
        )}
      </section>

      {/* Theme */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Theme
        </label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {themeModes.map((t) => (
            <button
              key={t.value}
              onClick={() => setThemeMode(t.value)}
              className="flex flex-col items-start gap-1 px-4 py-3 rounded-xl text-left
                         transition-colors min-h-[64px] border"
              style={{
                background: themeMode === t.value ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                borderColor: themeMode === t.value ? '#3b82f6' : 'var(--border)',
                color: themeMode === t.value ? '#3b82f6' : 'var(--text-primary)',
              }}
            >
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {t.description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
