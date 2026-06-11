import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '../../store/settings.slice'
import type { TeslaEnergyStatus, StandbyTeslaFields } from '../../../../preload/types'

// Match TeslaPage so React Query dedupes — only one poll runs whether the
// Powerwall page or standby (or both) is mounted. Local TEDAPI is free, so it
// polls faster; both components must agree on the interval for the shared key.
const POLL_MS_CLOUD = 10 * 60 * 1000
const POLL_MS_LOCAL = 30 * 1000

const DEFAULT_FIELDS: StandbyTeslaFields = {
  batteryPercent: true,
  powerFlow:      true,
  gridStatus:     true,
}

function fmtKw(kw: number): string {
  // Standby renders at a glance — 1 decimal is the right resolution and
  // matches the Tesla app. Below 50W reads as 0.
  if (Math.abs(kw) < 0.05) return '0 kW'
  return `${Math.abs(kw).toFixed(1)} kW`
}

export default function StandbyTesla() {
  const mode      = useSettingsStore((s) => s.teslaConnectionMode)
  const connected = useSettingsStore((s) =>
    s.teslaConnectionMode === 'local' ? s.teslaGatewayConfigured : s.teslaConnectedAt > 0,
  )
  const layout    = useSettingsStore((s) => s.standbyLayout)
  const fields    = layout.teslaFields ?? DEFAULT_FIELDS
  const pollMs    = mode === 'local' ? POLL_MS_LOCAL : POLL_MS_CLOUD

  const { data } = useQuery<TeslaEnergyStatus>({
    queryKey: ['tesla-status'],
    queryFn:  () => window.api.tesla.getStatus(),
    refetchInterval: pollMs,
    staleTime: pollMs / 2,
    enabled: connected,
    retry: 1,
  })

  if (!connected || !data) return null

  const charging = data.batteryKw < -0.05
  const offGrid  = data.gridStatus !== 'up'

  // Battery bar color tracks SOC the same way the Powerwall page does.
  const battColor = data.percentage < 20 ? '#ef4444'
                  : data.percentage < 50 ? '#f59e0b'
                  : '#22c55e'

  return (
    <div
      className="flex flex-col rounded-2xl"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)',
        // Sized to fit two big kW values comfortably on a 1920×1080 kiosk.
        minWidth: 260,
        padding: '14px 18px',
        gap: 12,
      }}
    >
      {fields.powerFlow && (
        <div className="flex items-stretch text-white">
          {/* Generating — solar production */}
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-2xl font-bold tabular-nums leading-none">
              {fmtKw(data.solarKw)}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
              Generating
            </span>
          </div>

          {/* Vertical divider */}
          <div
            className="self-stretch mx-3"
            style={{ width: 1, background: 'rgba(255,255,255,0.15)' }}
          />

          {/* Using — house load */}
          <div className="flex-1 flex flex-col gap-1 items-end">
            <span className="text-2xl font-bold tabular-nums leading-none">
              {fmtKw(data.loadKw)}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
              Using
            </span>
          </div>
        </div>
      )}

      {fields.batteryPercent && (
        <div className="flex items-center gap-2">
          {/* Battery bar — visual analog of the Powerwall page's gauge,
              shrunk to widget proportions */}
          <div
            className="relative h-2 flex-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500"
              style={{ width: `${data.percentage}%`, background: battColor }}
            />
          </div>
          <span
            className="text-sm font-bold tabular-nums leading-none whitespace-nowrap"
            style={{ color: battColor }}
          >
            {charging && '▲ '}{data.percentage}%
          </span>
        </div>
      )}

      {fields.gridStatus && offGrid && (
        <div className="flex items-center">
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold animate-pulse"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}
          >
            {data.gridStatus === 'down' ? 'Off-grid' : 'Reconnecting'}
          </span>
        </div>
      )}
    </div>
  )
}
