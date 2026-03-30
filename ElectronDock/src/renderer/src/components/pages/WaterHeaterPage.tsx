import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from '../../store/settings.slice'
import type { RinnaiDevice } from '../../../../preload/types'

const TEMP_MIN = 90
const TEMP_MAX = 140
const TEMP_STEP = 5

function TempControl({
  device,
  onSetTemp,
  isPending,
}: {
  device: RinnaiDevice
  onSetTemp: (temp: number) => void
  isPending: boolean
}) {
  const [draft, setDraft] = useState(device.setTemp)

  const canDecrease = draft > TEMP_MIN
  const canIncrease = draft < TEMP_MAX
  const changed = draft !== device.setTemp

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          SET TEMPERATURE
        </span>
        {device.isHeating && (
          <span
            className="text-xs px-2 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
          >
            Heating
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setDraft((d) => Math.max(TEMP_MIN, d - TEMP_STEP))}
          disabled={!canDecrease || isPending}
          className="w-12 h-12 rounded-xl text-2xl font-bold flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          −
        </button>

        <div className="flex-1 text-center">
          <span className="text-5xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {draft}°
          </span>
          <span className="text-lg ml-1" style={{ color: 'var(--text-secondary)' }}>F</span>
          {device.setTemp !== draft && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Current: {device.setTemp}°F
            </p>
          )}
        </div>

        <button
          onClick={() => setDraft((d) => Math.min(TEMP_MAX, d + TEMP_STEP))}
          disabled={!canIncrease || isPending}
          className="w-12 h-12 rounded-xl text-2xl font-bold flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          +
        </button>
      </div>

      {changed && (
        <button
          onClick={() => onSetTemp(draft)}
          disabled={isPending}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50 min-h-[48px]"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          {isPending ? 'Updating…' : `Set to ${draft}°F`}
        </button>
      )}
    </div>
  )
}

export default function WaterHeaterPage() {
  const rinnaiEmail = useSettingsStore((s) => s.rinnaiEmail)
  const qc = useQueryClient()

  const { data: devices = [], isLoading, error, refetch } = useQuery<RinnaiDevice[]>({
    queryKey: ['rinnai-devices'],
    queryFn: () => window.api.rinnai.getDevices(),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    enabled: !!rinnaiEmail,
    retry: 1,
  })

  const setTempMutation = useMutation({
    mutationFn: ({ thingName, temp }: { thingName: string; temp: number }) =>
      window.api.rinnai.setTemperature(thingName, temp),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rinnai-devices'] }),
  })

  const setRecircMutation = useMutation({
    mutationFn: ({ thingName, enabled }: { thingName: string; enabled: boolean }) =>
      window.api.rinnai.setRecirculation(thingName, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rinnai-devices'] }),
  })

  if (!rinnaiEmail) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3 px-8"
        style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}
      >
        <svg className="w-14 h-14 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
        <p className="text-base font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
          Rinnai account not configured
        </p>
        <p className="text-sm text-center">Go to Settings → Water Heater to add your credentials.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading water heater…</p>
      </div>
    )
  }

  if (error) {
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

  if (devices.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}
      >
        <p className="text-sm">No Rinnai devices found on this account.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {devices.map((device) => {
        const tempPending = setTempMutation.isPending && setTempMutation.variables?.thingName === device.thingName
        const recircPending = setRecircMutation.isPending && setRecircMutation.variables?.thingName === device.thingName

        return (
          <div key={device.thingName} className="px-6 py-5 space-y-5">
            {/* Device header */}
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {device.name}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {device.thingName}
              </p>
            </div>

            {/* Temperature card */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <TempControl
                device={device}
                onSetTemp={(temp) => setTempMutation.mutate({ thingName: device.thingName, temp })}
                isPending={tempPending}
              />
            </div>

            {/* Recirculation card */}
            <div
              className="rounded-2xl p-5 flex items-center justify-between"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Recirculation
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {device.recirculationEnabled ? 'Active' : 'Off'}
                </p>
              </div>
              <button
                onClick={() =>
                  setRecircMutation.mutate({
                    thingName: device.thingName,
                    enabled: !device.recirculationEnabled,
                  })
                }
                disabled={recircPending}
                className="relative w-14 h-8 rounded-full transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
                style={{
                  background: device.recirculationEnabled ? '#3b82f6' : 'var(--border)',
                }}
                aria-label="Toggle recirculation"
              >
                <span
                  className="absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200"
                  style={{
                    left: device.recirculationEnabled ? '30px' : '4px',
                  }}
                />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
