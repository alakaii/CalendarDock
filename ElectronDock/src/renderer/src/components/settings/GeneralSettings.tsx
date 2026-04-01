import { useRef, useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import type { ThemeMode } from '../../../../preload/types'
import { SIDEBAR_IMAGE_KEY } from '../shell/Sidebar'
import { HEADER_IMAGE_KEY } from '../shell/AppHeader'

export default function GeneralSettings() {
  const familyName    = useSettingsStore((s) => s.familyName)
  const themeMode     = useSettingsStore((s) => s.themeMode)
  const setFamilyName = useSettingsStore((s) => s.setFamilyName)
  const setThemeMode  = useSettingsStore((s) => s.setThemeMode)

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
