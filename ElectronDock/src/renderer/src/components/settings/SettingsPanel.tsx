import { useState } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { TouchButton } from '../shared/TouchButton'
import AccountManager from './AccountManager'
import CalendarSelector from './CalendarSelector'
import WeatherSettings from './WeatherSettings'
import PhotoSettings from './PhotoSettings'
import StandbySettings from './StandbySettings'

type Section = 'accounts' | 'calendars' | 'weather' | 'photos' | 'standby'

export default function SettingsPanel() {
  const closeSettings = useUIStore((s) => s.closeSettings)
  const [section, setSection] = useState<Section>('accounts')

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'accounts', label: 'Accounts', icon: '👤' },
    { id: 'calendars', label: 'Calendars', icon: '📅' },
    { id: 'weather', label: 'Weather', icon: '🌤' },
    { id: 'photos', label: 'Photos', icon: '🖼' },
    { id: 'standby', label: 'Standby', icon: '💤' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={closeSettings} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl h-full bg-gray-900 border-l border-white/10
                      flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-semibold">Settings</h2>
          <TouchButton variant="ghost" onClick={closeSettings} aria-label="Close">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </TouchButton>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar nav */}
          <nav className="w-44 border-r border-white/10 py-2 flex-shrink-0">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left
                           transition-colors min-h-[44px]
                           ${section === item.id
                             ? 'bg-white/10 text-white font-medium'
                             : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === 'accounts' && <AccountManager />}
            {section === 'calendars' && <CalendarSelector />}
            {section === 'weather' && <WeatherSettings />}
            {section === 'photos' && <PhotoSettings />}
            {section === 'standby' && <StandbySettings />}
          </div>
        </div>
      </div>
    </div>
  )
}
