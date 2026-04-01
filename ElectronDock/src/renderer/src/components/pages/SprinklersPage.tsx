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

function ZoneTile({
  zone,
  device,
  isActive,
  minHeight = 180,
}: {
  zone: RachioDevice['zones'][0]
  device: RachioDevice
  isActive: boolean
  minHeight?: number
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
      className="flex flex-col gap-4 rounded-2xl p-5"
      style={{
        background: isActive ? 'rgba(59,130,246,0.1)' : 'var(--bg-surface)',
        border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
        minHeight,
      }}
    >
      {/* Zone name + active dot */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {zone.name}
        </span>
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${isActive ? 'animate-pulse' : ''}`}
          style={{ background: isActive ? '#3b82f6' : 'var(--border)' }}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {isActive ? (
        <button
          onClick={() => stopMutation.mutate()}
          disabled={isPending}
          className="w-full py-3 rounded-xl font-bold text-base transition-opacity disabled:opacity-50 min-h-[56px]"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          Stop
        </button>
      ) : (
        <>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full text-sm px-3 py-2 rounded-xl outline-none min-h-[44px]"
            style={{
              background: 'var(--input-bg, var(--bg-base))',
              border: '1px solid var(--input-border, var(--border))',
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
            className="w-full py-3 rounded-xl font-bold text-base transition-opacity disabled:opacity-30 min-h-[56px]"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            Run
          </button>
        </>
      )}
    </div>
  )
}

const PADDING_X  = 23
const PADDING_Y  = 16
const GRID_GAP   = 30
const COLS       = 3
const TILE_MIN_H = 180

/** Split zones so any remainder tiles form a centered top row, full rows below */
function chunkZones<T>(items: T[], cols: number): T[][] {
  if (items.length === 0) return []
  const remainder = items.length % cols
  const rows: T[][] = []
  if (remainder > 0) {
    rows.push(items.slice(0, remainder))
    for (let i = remainder; i < items.length; i += cols) rows.push(items.slice(i, i + cols))
  } else {
    for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols))
  }
  return rows
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

  // Tile width: each tile is exactly 1/COLS of the available row width
  const tileWidth = `calc((100% - ${(COLS - 1) * GRID_GAP}px) / ${COLS})`

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {devices.map((device) => {
        const zones = device.zones.filter((z) => z.enabled)
        const rows  = chunkZones(zones, COLS)

        return (
          <div key={device.id} style={{ paddingLeft: PADDING_X, paddingRight: PADDING_X, paddingTop: PADDING_Y, paddingBottom: PADDING_Y }}>
            {/* Device header */}
            <div className="flex items-center justify-between mb-4">
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

            {zones.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                No enabled zones found.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: GRID_GAP }}>
                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: GRID_GAP }}>
                    {row.map((zone) => (
                      <div key={zone.id} style={{ width: tileWidth, flexShrink: 0 }}>
                        <ZoneTile
                          zone={zone}
                          device={device}
                          isActive={zone.id === device.activeZoneId}
                          minHeight={TILE_MIN_H}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
