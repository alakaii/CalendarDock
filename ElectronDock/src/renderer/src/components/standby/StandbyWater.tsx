import { useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from '../../store/settings.slice'
import type { RinnaiDevice, StandbyWaterFields } from '../../../../preload/types'

const DEFAULT_WATER_FIELDS: StandbyWaterFields = {
  timeRemaining:       true,
  domesticTemperature: true,
  recircTemperature:   true,
  outletTemperature:   false,
  inletTemperature:    false,
}

const ShowerIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8v0a8 8 0 018 8H4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M8 16l-1 3M12 16v3M16 16l1 3" />
  </svg>
)

const FlameIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
)

const ArrowUpIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7 7 7M12 3v18" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7-7-7M12 21V3" />
  </svg>
)

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function TempRow({ icon, label, value, highlight }: {
  icon: React.ReactNode
  label: string
  value?: number
  highlight?: boolean
}) {
  if (value == null) return null
  return (
    <div className="flex items-center gap-2" style={{ color: highlight ? '#fca5a5' : 'rgba(255,255,255,0.9)' }}>
      {icon}
      <span className="text-base font-bold tabular-nums leading-none">{value}°F</span>
      <span className="text-xs opacity-60">{label}</span>
    </div>
  )
}

export default function StandbyWater() {
  const qc      = useQueryClient()
  const rawLayout = useSettingsStore((s) => s.standbyLayout)
  const fields  = rawLayout.waterFields ?? DEFAULT_WATER_FIELDS

  const devices = qc.getQueryData<RinnaiDevice[]>(['rinnai-devices']) ?? []
  const active  = devices.filter((d) => d.isHeating || d.recirculationEnabled)
  if (active.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {active.map((device) => (
        <div
          key={device.thingName}
          className="flex flex-col gap-2 px-3 py-2.5 rounded-xl"
          style={{
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 160,
          }}
        >
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide leading-none">
            {device.name}
          </p>

          {fields.timeRemaining && device.recirculationEnabled && (
            <div className="flex items-center gap-2 text-blue-300">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 7v5l3 3" />
              </svg>
              <span className="text-base font-bold tabular-nums leading-none">
                {/* countdown is managed by WaterHeaterPage; here we just show "Active" */}
                Active
              </span>
              <span className="text-xs opacity-60">recirc</span>
            </div>
          )}

          {fields.domesticTemperature && (
            <TempRow
              icon={<ShowerIcon />}
              label="water"
              value={device.domesticTemperature ?? (device.isHeating ? device.setTemp : undefined)}
            />
          )}

          {fields.recircTemperature && device.recirculationEnabled && (
            <TempRow
              icon={<FlameIcon />}
              label="recirc"
              value={device.recirculationTemperature}
              highlight
            />
          )}

          {fields.outletTemperature && (
            <TempRow
              icon={<ArrowUpIcon />}
              label="outlet"
              value={device.outletTemperature}
            />
          )}

          {fields.inletTemperature && (
            <TempRow
              icon={<ArrowDownIcon />}
              label="inlet"
              value={device.inletTemperature}
            />
          )}
        </div>
      ))}
    </div>
  )
}
