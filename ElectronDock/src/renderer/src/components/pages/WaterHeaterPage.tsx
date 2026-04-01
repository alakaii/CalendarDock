import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from '../../store/settings.slice'
import type { RinnaiDevice } from '../../../../preload/types'

const TEMP_MIN = 90
const TEMP_MAX = 140
const TEMP_STEP = 5

const ShowerIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 12a8 8 0 018-8v0a8 8 0 018 8H4z" />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 12h16M8 16l-1 3M12 16v3M16 16l1 3" />
  </svg>
)

const FlameIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
)

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

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
            className="text-xs px-2 py-1 rounded-full font-semibold animate-pulse"
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

  const [recircDuration, setRecircDuration] = useState<number>(15)
  const DURATIONS = [
    { label: '5 min',  value: 5  },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hr',   value: 60 },
  ]

  // Countdown state: track when recirc was started this session
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const recircStartRef = useRef<{ startedAt: number; totalSeconds: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearCountdown = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    recircStartRef.current = null
    setCountdownSeconds(null)
  }

  const startCountdown = (durationMinutes: number) => {
    clearCountdown()
    const totalSeconds = durationMinutes * 60
    recircStartRef.current = { startedAt: Date.now(), totalSeconds }
    setCountdownSeconds(totalSeconds)
    intervalRef.current = setInterval(() => {
      if (!recircStartRef.current) return
      const elapsed = Math.floor((Date.now() - recircStartRef.current.startedAt) / 1000)
      const left = recircStartRef.current.totalSeconds - elapsed
      if (left <= 0) {
        clearCountdown()
        qc.invalidateQueries({ queryKey: ['rinnai-devices'] })
      } else {
        setCountdownSeconds(left)
      }
    }, 1000)
  }

  // Clear countdown if recirc turns off externally (poll refresh)
  const firstDevice = devices[0]
  useEffect(() => {
    if (firstDevice && !firstDevice.recirculationEnabled && recircStartRef.current) {
      clearCountdown()
    }
  }, [firstDevice?.recirculationEnabled])

  // Cleanup on unmount
  useEffect(() => () => clearCountdown(), [])

  const setRecircMutation = useMutation({
    mutationFn: ({ thingName, enabled, durationMinutes }: { thingName: string; enabled: boolean; durationMinutes?: number }) =>
      window.api.rinnai.setRecirculation(thingName, enabled, durationMinutes),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rinnai-devices'] })
      if (vars.enabled && vars.durationMinutes) {
        startCountdown(vars.durationMinutes)
      } else {
        clearCountdown()
      }
    },
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
      <div style={{ maxWidth: 1396, margin: '0 auto', width: '100%' }}>
      {devices.map((device) => {
        const tempPending   = setTempMutation.isPending && setTempMutation.variables?.thingName === device.thingName
        const recircPending = setRecircMutation.isPending && setRecircMutation.variables?.thingName === device.thingName

        const hasDomesticTemp     = device.domesticTemperature != null
        const hasRecircTemp       = device.recirculationTemperature != null
        const hasOutletTemp       = device.outletTemperature != null
        const hasInletTemp        = device.inletTemperature != null
        const showTempReadings    = hasDomesticTemp || hasRecircTemp
        const showSensorReadings  = hasOutletTemp || hasInletTemp

        return (
          <div key={device.thingName} className="py-5 space-y-4">
            {/* Device header */}
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {device.name}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {device.thingName}
              </p>
            </div>

            {/* Live temperature readings */}
            {showTempReadings && (
              <div className="grid grid-cols-2 gap-3">
                {/* Domestic (outlet) temperature */}
                <div
                  className="rounded-2xl p-4 flex flex-col gap-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <ShowerIcon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Water Temp</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {hasDomesticTemp ? device.domesticTemperature : '—'}
                    </span>
                    {hasDomesticTemp && (
                      <span className="text-base mb-0.5" style={{ color: 'var(--text-secondary)' }}>°F</span>
                    )}
                  </div>
                  {device.isHeating && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold w-fit animate-pulse"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                    >
                      Heating
                    </span>
                  )}
                </div>

                {/* Recirculation temperature */}
                <div
                  className="rounded-2xl p-4 flex flex-col gap-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <FlameIcon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Recirc Temp</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {hasRecircTemp ? device.recirculationTemperature : '—'}
                    </span>
                    {hasRecircTemp && (
                      <span className="text-base mb-0.5" style={{ color: 'var(--text-secondary)' }}>°F</span>
                    )}
                  </div>
                  {device.recirculationEnabled && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold w-fit"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                    >
                      Active
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Outlet / inlet sensor readings */}
            {showSensorReadings && (
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl p-4 flex flex-col gap-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7 7 7M12 3v18" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wide">Outlet (m02)</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {hasOutletTemp ? device.outletTemperature : '—'}
                    </span>
                    {hasOutletTemp && (
                      <span className="text-base mb-0.5" style={{ color: 'var(--text-secondary)' }}>°F</span>
                    )}
                  </div>
                </div>

                <div
                  className="rounded-2xl p-4 flex flex-col gap-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7-7-7M12 21V3" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wide">Inlet (m08)</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {hasInletTemp ? device.inletTemperature : '—'}
                    </span>
                    {hasInletTemp && (
                      <span className="text-base mb-0.5" style={{ color: 'var(--text-secondary)' }}>°F</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Temperature control card */}
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
              className="rounded-2xl p-5 space-y-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Recirculation
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {device.recirculationEnabled ? 'Active' : 'Off'}
                  </p>
                </div>
                {device.recirculationEnabled && (
                  <div className="flex items-center gap-2">
                    {/* Countdown badge */}
                    {countdownSeconds != null ? (
                      <span
                        className="text-sm font-bold tabular-nums px-3 py-1 rounded-full"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                      >
                        {formatCountdown(countdownSeconds)}
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-1 rounded-full font-semibold"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                      >
                        Running
                      </span>
                    )}
                  </div>
                )}
              </div>

              {device.recirculationEnabled ? (
                <button
                  onClick={() => setRecircMutation.mutate({ thingName: device.thingName, enabled: false })}
                  disabled={recircPending}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50 min-h-[48px]"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  {recircPending ? 'Stopping…' : 'Stop Recirculation'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    DURATION
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {DURATIONS.map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => setRecircDuration(value)}
                        className="py-2 rounded-xl text-sm font-semibold transition-all min-h-[44px]"
                        style={{
                          background: recircDuration === value ? '#3b82f6' : 'var(--bg-base)',
                          color: recircDuration === value ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${recircDuration === value ? '#3b82f6' : 'var(--border)'}`,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setRecircMutation.mutate({ thingName: device.thingName, enabled: true, durationMinutes: recircDuration })}
                    disabled={recircPending}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50 min-h-[48px]"
                    style={{ background: '#3b82f6', color: '#fff' }}
                  >
                    {recircPending ? 'Starting…' : `Start for ${DURATIONS.find(d => d.value === recircDuration)?.label}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
