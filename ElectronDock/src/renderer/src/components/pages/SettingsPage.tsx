import { useState } from 'react'
import AccountManager from '../settings/AccountManager'
import CalendarSelector from '../settings/CalendarSelector'
import WeatherSettings from '../settings/WeatherSettings'
import PhotoSettings from '../settings/PhotoSettings'
import StandbySettings from '../settings/StandbySettings'
import GeneralSettings from '../settings/GeneralSettings'
import ChoresSettings from '../settings/ChoresSettings'
import ListsSettings from '../settings/ListsSettings'
import CameraSettings from '../settings/CameraSettings'
import SprinklerSettings from '../settings/SprinklerSettings'
import WaterHeaterSettings from '../settings/WaterHeaterSettings'

type Section =
  | 'general' | 'accounts' | 'calendars' | 'weather' | 'photos' | 'standby'
  | 'chores' | 'lists' | 'cameras' | 'sprinklers' | 'waterheater'

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'general',     label: 'General',      icon: '⚙️' },
  { id: 'accounts',    label: 'Accounts',     icon: '👤' },
  { id: 'calendars',   label: 'Calendars',    icon: '📅' },
  { id: 'weather',     label: 'Weather',      icon: '🌤' },
  { id: 'photos',      label: 'Photos',       icon: '🖼' },
  { id: 'standby',     label: 'Standby',      icon: '💤' },
  { id: 'chores',      label: 'Chores',       icon: '✅' },
  { id: 'lists',       label: 'Lists',        icon: '📋' },
  { id: 'cameras',     label: 'Cameras',      icon: '📹' },
  { id: 'sprinklers',  label: 'Sprinklers',   icon: '💧' },
  { id: 'waterheater', label: 'Water Heater', icon: '🔥' },
]

export default function SettingsPage() {
  const [section, setSection] = useState<Section>('general')

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* Sidebar nav */}
      <nav
        className="w-48 flex flex-col flex-shrink-0 py-2 overflow-y-auto"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`
              flex items-center gap-3 px-4 py-3 text-sm font-medium text-left
              transition-colors min-h-[48px]
            `}
            style={{
              background: section === item.id ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: section === item.id ? '#3b82f6' : 'var(--text-primary)',
            }}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto p-6"
        style={{ color: 'var(--text-primary)' }}
      >
        {section === 'general'     && <GeneralSettings />}
        {section === 'accounts'    && <AccountManager />}
        {section === 'calendars'   && <CalendarSelector />}
        {section === 'weather'     && <WeatherSettings />}
        {section === 'photos'      && <PhotoSettings />}
        {section === 'standby'     && <StandbySettings />}
        {section === 'chores'      && <ChoresSettings />}
        {section === 'lists'       && <ListsSettings />}
        {section === 'cameras'     && <CameraSettings />}
        {section === 'sprinklers'  && <SprinklerSettings />}
        {section === 'waterheater' && <WaterHeaterSettings />}
      </div>
    </div>
  )
}
