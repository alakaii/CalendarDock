import { useState } from 'react'
import AccountsSettings from '../settings/AccountsSettings'
import CalendarSelector from '../settings/CalendarSelector'
import ClocksSettings from '../settings/ClocksSettings'
import WeatherSettings from '../settings/WeatherSettings'
import PhotoSettings from '../settings/PhotoSettings'
import StandbySettings from '../settings/StandbySettings'
import GeneralSettings from '../settings/GeneralSettings'
import ChoresSettings from '../settings/ChoresSettings'
import MealsSettings from '../settings/MealsSettings'
import ListsSettings from '../settings/ListsSettings'
import CameraSettings from '../settings/CameraSettings'
import CameraWakeSettings from '../settings/CameraWakeSettings'
import RingSettings from '../settings/RingSettings'
import TeslaSettings from '../settings/TeslaSettings'
import UpdatesSettings from '../settings/UpdatesSettings'

type Section =
  | 'general' | 'accounts' | 'calendars' | 'clocks' | 'weather' | 'photos' | 'standby'
  | 'wake' | 'chores' | 'meals' | 'lists' | 'cameras' | 'ring' | 'tesla' | 'updates'

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'general',   label: 'General',     icon: '⚙️' },
  { id: 'accounts',  label: 'Accounts',    icon: '👤' },
  { id: 'calendars', label: 'Calendars',   icon: '📅' },
  { id: 'clocks',    label: 'Clocks',      icon: '🕒' },
  { id: 'weather',   label: 'Weather',     icon: '🌤' },
  { id: 'photos',    label: 'Photos',      icon: '🖼' },
  { id: 'standby',   label: 'Standby',     icon: '💤' },
  { id: 'wake',      label: 'Camera Wake', icon: '📷' },
  { id: 'chores',    label: 'Chores',      icon: '✅' },
  { id: 'meals',     label: 'Meals',       icon: '🍽' },
  { id: 'lists',     label: 'Lists',       icon: '📋' },
  { id: 'cameras',   label: 'Wyze Camera', icon: '📹' },
  { id: 'ring',      label: 'Ring',        icon: '🔔' },
  { id: 'tesla',     label: 'Powerwall',   icon: '🔋' },
  { id: 'updates',   label: 'Updates',     icon: '⬆️' },
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
        {section === 'general'   && <GeneralSettings />}
        {section === 'accounts'  && <AccountsSettings />}
        {section === 'calendars' && <CalendarSelector />}
        {section === 'clocks'    && <ClocksSettings />}
        {section === 'weather'   && <WeatherSettings />}
        {section === 'photos'    && <PhotoSettings />}
        {section === 'standby'   && <StandbySettings />}
        {section === 'wake'      && <CameraWakeSettings />}
        {section === 'chores'    && <ChoresSettings />}
        {section === 'meals'     && <MealsSettings />}
        {section === 'lists'     && <ListsSettings />}
        {section === 'cameras'   && <CameraSettings />}
        {section === 'ring'      && <RingSettings />}
        {section === 'tesla'     && <TeslaSettings />}
        {section === 'updates'   && <UpdatesSettings />}
      </div>
    </div>
  )
}
