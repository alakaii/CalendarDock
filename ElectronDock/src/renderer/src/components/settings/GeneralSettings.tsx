import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import type { ThemeMode } from '../../../../preload/types'

export default function GeneralSettings() {
  const familyName    = useSettingsStore((s) => s.familyName)
  const themeMode     = useSettingsStore((s) => s.themeMode)
  const setFamilyName = useSettingsStore((s) => s.setFamilyName)
  const setThemeMode  = useSettingsStore((s) => s.setThemeMode)

  const [nameInput, setNameInput] = useState(familyName)

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
