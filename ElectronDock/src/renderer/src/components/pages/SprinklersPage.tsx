import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from '../../store/settings.slice'
import type { RachioDevice } from '../../../../preload/types'

const ZONE_DURATIONS = [
  { label: '5 min',  sec: 300  },
  { label: '10 min', sec: 600  },
  { label: '15 min', sec: 900  },
  { label: '30 min', sec: 1800 },
]

function ZoneRow({
  zone,
  device,
  isActive,
}: {
  zone: RachioDevice['zones'][0]
  device: RachioDevice
  isActive: boolean
}) {
  const qc = useQueryClient()
  const [duration, setDuration] = useState(600)

  const startMutation = useMutation({
    mutationFn: () => window.api.rachio.startZone(zone.id, duration),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rachio-devices'] }),
  })

  const stopMutation = useMutation({
    mutationFn: () => window.api.rachio.stopAll(device.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rachio-devices'] }),
  })

  const isPending = startMutation.isPending || stopMutation.isPending

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl min-h-[64px]"
      style={{
        background: isActive ? 'rgba(59,130,246,0.1)' : 'var(--bg-surface)',
        border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
      }}
    >
      {/* Active indicator */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: isActive ? '#3b82f6' : 'var(--border)' }}
      />

      <span className="flex-1 text-base font-medium" style={{ color: 'var(--text-primary)' }}>
        {zone.name}
      </span>

      {isActive ? (
        <button
          onClick={() => stopMutation.mutate()}
          disabled={isPending}
          className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50 min-h-[44px]"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          Stop
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="text-sm px-3 py-2 rounded-lg outline-none min-h-[44px]"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
            }}
          >
            {ZONE_DURATIONS.map((d) => (
              <option key={d.sec} value={d.sec}>{d.label}</option>
            ))}
          </select>
          <button
            onClick={() => startMutation.mutate()}
            disabled={isPending || !zone.enabled}
            className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            Run
          </button>
        </div>
      )}
    </div>
  )
}

export default function SprinklersPage() {
  const rachioApiKey = useSettingsStore((s) => s.rachioApiKey)
  const qc = useQueryClient()

  const { data: devices = [], isLoading, error, refetch } = useQuery<RachioDevice[]>({
    queryKey: ['rachio-devices'],
    queryFn: () => window.api.rachio.getDevices(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!rachioApiKey,
    retry: 1,
  })

  const stopAll = useMutation({
    mutationFn: (deviceId: string) => window.api.rachio.stopAll(deviceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rachio-devices'] }),
  })

  if (!rachioApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8"
           style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
        <svg className="w-14 h-14 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 15a4 4 0 004 4h9a5 5 0 10-4.584-6.975A4.002 4.002 0 003 15z" />
        </svg>
        <p className="text-base font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
          Rachio API key not configured
        </p>
        <p className="text-sm text-center">Go to Settings → Sprinklers to add your API key.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading sprinkler zones…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8"
           style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm text-center" style={{ color: '#f87171' }}>
          {(error as Error).message}
        </p>
        <button onClick={() => refetch()}
          className="px-4 py-2 rounded-xl text-sm font-semibold min-h-[44px]"
          style={{ background: '#3b82f6', color: '#fff' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {devices.map((device) => {
        const zones = device.zones.filter((z) => z.enabled)
        return (
          <div key={device.id} className="px-6 py-4">
            {/* Device header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {device.name}
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {device.status} · {zones.length} zones
                </p>
              </div>
              {device.activeZoneId && (
                <button
                  onClick={() => stopAll.mutate(device.id)}
                  disabled={stopAll.isPending}
                  className="px-4 py-2 rounded-xl font-semibold text-sm min-h-[44px]"
                  style={{ background: '#ef4444', color: '#fff' }}
                >
                  Stop All
                </button>
              )}
            </div>

            <div className="space-y-2">
              {zones.map((zone) => (
                <ZoneRow
                  key={zone.id}
                  zone={zone}
                  device={device}
                  isActive={zone.id === device.activeZoneId}
                />
              ))}
              {zones.length === 0 && (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                  No enabled zones found.
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
