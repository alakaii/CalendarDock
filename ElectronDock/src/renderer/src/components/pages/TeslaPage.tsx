import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '../../store/settings.slice'
import type { TeslaEnergyStatus } from '../../../../preload/types'

const POLL_MS = 10_000

const SolarIcon = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <circle cx="12" cy="12" r="4" />
    <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
  </svg>
)

const HomeIcon = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
  </svg>
)

const BatteryIcon = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <rect x="6" y="3" width="12" height="18" rx="2" />
    <path strokeLinecap="round" d="M10 3V2h4v1" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 9l-2 4h3l-2 4 5-6h-3l2-2h-3z" />
  </svg>
)

const GridIcon = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 2L5 7v15h4M15 2l4 5v15h-4M9 2h6M9 22h6M5 12h14M5 17h14" />
  </svg>
)

function fmtKw(kw: number): string {
  const abs = Math.abs(kw)
  if (abs < 0.05) return '0 kW'
  return `${abs.toFixed(1)} kW`
}

function FlowTile({
  icon,
  label,
  valueLine,
  subline,
  tint,
  active,
}: {
  icon: React.ReactNode
  label: string
  valueLine: React.ReactNode
  subline?: React.ReactNode
  tint: string
  active: boolean
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-opacity"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${active ? tint : 'var(--border)'}`,
        boxShadow: active ? `0 0 0 1px ${tint}, 0 8px 24px ${tint}33` : 'none',
        opacity: active ? 1 : 0.7,
      }}
    >
      <div className="flex items-center gap-2" style={{ color: active ? tint : 'var(--text-secondary)' }}>
        <span>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {valueLine}
        </span>
      </div>
      {subline && (
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {subline}
        </div>
      )}
    </div>
  )
}

function BatteryGauge({ percent, charging }: { percent: number; charging: boolean }) {
  // Color tracks state of charge: red < 20%, amber < 50%, green ≥ 50%
  const color = percent < 20 ? '#ef4444' : percent < 50 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--text-secondary)' }}>State of charge</span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {charging && '▲ '}{percent}%
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  )
}

function NotConfigured() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 px-8"
      style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}
    >
      <BatteryIcon className="w-14 h-14 opacity-20" />
      <p className="text-base font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
        Tesla Powerwall not configured
      </p>
      <p className="text-sm text-center max-w-md">
        Go to Settings → Accounts to add your Powerwall Gateway IP and credentials.
      </p>
    </div>
  )
}

export default function TeslaPage() {
  const teslaGatewayHost = useSettingsStore((s) => s.teslaGatewayHost)

  const { data, isLoading, error, refetch } = useQuery<TeslaEnergyStatus>({
    queryKey: ['tesla-status'],
    queryFn: () => window.api.tesla.getStatus(),
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
    enabled: !!teslaGatewayHost,
    retry: 1,
  })

  if (!teslaGatewayHost) return <NotConfigured />

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Connecting to Powerwall…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3 px-8"
        style={{ background: 'var(--bg-base)' }}
      >
        <p className="text-sm text-center" style={{ color: '#f87171' }}>
          {(error as Error).message}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl text-sm font-semibold min-h-[44px]"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const charging = data.batteryKw < -0.05
  const exporting = data.gridKw < -0.05
  const offGrid = data.gridStatus !== 'up'
  const solarActive   = data.solarKw  > 0.05
  const loadActive    = data.loadKw   > 0.05
  const batteryActive = Math.abs(data.batteryKw) > 0.05
  const gridActive    = Math.abs(data.gridKw)    > 0.05

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      <div style={{ maxWidth: 1396, margin: '0 auto', width: '100%' }} className="py-6 px-2 space-y-5">
        {/* Header */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            My Home
          </h2>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {offGrid && (
              <span
                className="px-2 py-1 rounded-full font-semibold animate-pulse"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
              >
                Off-grid
              </span>
            )}
            <span>Updates every {POLL_MS / 1000}s</span>
          </div>
        </div>

        {/* Solar — full width, anchors the top of the flow like the Tesla app */}
        <FlowTile
          icon={<SolarIcon />}
          label="Solar"
          valueLine={fmtKw(data.solarKw)}
          tint="#fbbf24"
          active={solarActive}
        />

        {/* Flow legend row — just visual cues so the user can read at a glance
            who's giving power and who's drawing it */}
        <div className="grid grid-cols-3 gap-3 px-2 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div>{charging ? '↓ Charging Powerwall' : batteryActive ? '↑ From Powerwall' : '—'}</div>
          <div>↓ To Home</div>
          <div>{exporting ? '↑ Export to grid' : gridActive ? '↓ From grid' : offGrid ? 'Grid down' : '—'}</div>
        </div>

        {/* Three-column lower row: Powerwall, Home, Grid */}
        <div className="grid grid-cols-3 gap-3">
          <FlowTile
            icon={<BatteryIcon />}
            label={`Powerwall${data.batteryCount > 1 ? ` · ${data.batteryCount}x` : ''}`}
            valueLine={fmtKw(data.batteryKw)}
            subline={<BatteryGauge percent={data.percentage} charging={charging} />}
            tint="#22c55e"
            active={batteryActive}
          />
          <FlowTile
            icon={<HomeIcon />}
            label="Home"
            valueLine={fmtKw(data.loadKw)}
            tint="#60a5fa"
            active={loadActive}
          />
          <FlowTile
            icon={<GridIcon />}
            label="Grid"
            valueLine={offGrid ? 'Down' : fmtKw(data.gridKw)}
            subline={
              offGrid ? 'No grid power' :
              exporting ? 'Exporting' :
              gridActive ? 'Importing' : 'Idle'
            }
            tint={offGrid ? '#f87171' : '#a78bfa'}
            active={gridActive || offGrid}
          />
        </div>
      </div>
    </div>
  )
}
