import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import type { AppPage, ThemeMode } from '../../../../preload/types'

interface NavItem {
  id: AppPage
  label: string
  icon: React.ReactNode
}

// ── Icons ──────────────────────────────────────────────────────────────────
const CalendarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)
const ChoresIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
)
const ForkKnifeIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6h3.5M21 22v-7" />
  </svg>
)
const PhotosIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
  </svg>
)
const ListsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
)
const ZzzIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <text x="2"  y="22" fontSize="6.5" fontWeight="900" opacity="0.5">z</text>
    <text x="8"  y="16" fontSize="8.5" fontWeight="900" opacity="0.75">z</text>
    <text x="13" y="9"  fontSize="11"  fontWeight="900">Z</text>
  </svg>
)
const SettingsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const SunIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
)
const MoonIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
)
const AutoThemeIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" strokeLinecap="round" />
    <path strokeLinecap="round" d="M12 3a9 9 0 010 18V3z" fill="currentColor" opacity={0.25} />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
  </svg>
)

const navItems: NavItem[] = [
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
  { id: 'chores',   label: 'Chores',   icon: <ChoresIcon /> },
  { id: 'meals',    label: 'Meals',    icon: <ForkKnifeIcon /> },
  { id: 'photos',   label: 'Photos',   icon: <PhotosIcon /> },
  { id: 'lists',    label: 'Lists',    icon: <ListsIcon /> },
]

// Theme mode cycle: auto → light → dark → auto
const THEME_CYCLE: ThemeMode[] = ['auto', 'light', 'dark']

export default function Sidebar() {
  const activePage  = useUIStore((s) => s.activePage)
  const setPage     = useUIStore((s) => s.setPage)
  const setMode     = useUIStore((s) => s.setMode)
  const themeMode   = useSettingsStore((s) => s.themeMode)
  const setThemeMode = useSettingsStore((s) => s.setThemeMode)

  const handleThemeToggle = () => {
    const idx = THEME_CYCLE.indexOf(themeMode)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setThemeMode(next)
  }

  const ThemeIcon = themeMode === 'dark' ? MoonIcon
    : themeMode === 'light' ? SunIcon
    : AutoThemeIcon

  const themeLabel = themeMode === 'dark' ? 'Dark'
    : themeMode === 'light' ? 'Light'
    : 'Auto'

  const btnBase = `
    flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl
    transition-colors duration-150 min-h-[64px] text-[10px] font-medium
  `

  return (
    <nav
      className="flex flex-col items-center py-3 gap-1 flex-shrink-0"
      style={{
        width: 80,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-sidebar)'
      }}
    >
      {/* Logo */}
      <div className="mb-3 flex flex-col items-center">
        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
          CD
        </div>
      </div>

      {/* Main nav */}
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setPage(item.id)}
          className={`${btnBase} ${
            activePage === item.id
              ? 'bg-blue-500 text-white'
              : 'text-[var(--text-sidebar)] hover:bg-white/10 opacity-70 hover:opacity-100'
          }`}
          aria-label={item.label}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={handleThemeToggle}
        className={`${btnBase} text-[var(--text-sidebar)] hover:bg-white/10 opacity-70 hover:opacity-100`}
        aria-label={`Theme: ${themeLabel}`}
        title={`Theme: ${themeLabel} — click to cycle`}
      >
        <ThemeIcon />
        <span>{themeLabel}</span>
      </button>

      {/* Sleep (standby) */}
      <button
        onClick={() => setMode('standby')}
        className={`${btnBase} text-[var(--text-sidebar)] hover:bg-white/10 opacity-60 hover:opacity-100`}
        aria-label="Sleep / Standby"
      >
        <ZzzIcon />
        <span>Sleep</span>
      </button>

      {/* Settings — at very bottom */}
      <button
        onClick={() => setPage('settings')}
        className={`${btnBase} ${
          activePage === 'settings'
            ? 'bg-blue-500 text-white'
            : 'text-[var(--text-sidebar)] hover:bg-white/10 opacity-70 hover:opacity-100'
        }`}
        aria-label="Settings"
      >
        <SettingsIcon />
        <span>Settings</span>
      </button>
    </nav>
  )
}
