import type { RachioDevice, RachioZone, RachioSchedule } from '../../preload/types'

const BASE = 'https://api.rach.io/1/public'

async function rachioFetch(apiKey: string, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Rachio API error ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const rachioService = {
  async getDevices(apiKey: string): Promise<RachioDevice[]> {
    // Get current user's ID first
    const person = await rachioFetch(apiKey, '/person/info')
    const personDetail = await rachioFetch(apiKey, `/person/${person.id}`)

    return (personDetail.devices ?? []).map((d: any): RachioDevice => ({
      id: d.id,
      name: d.name,
      status: d.status,
      zones: (d.zones ?? []).map((z: any): RachioZone => ({
        id: z.id,
        zoneNumber: z.zoneNumber,
        name: z.name || `Zone ${z.zoneNumber}`,
        enabled: z.enabled,
      })),
      activeZoneId: d.currentSchedule?.zoneId,
    }))
  },

  async startZone(apiKey: string, zoneId: string, durationSec: number): Promise<void> {
    await rachioFetch(apiKey, '/zone/start', 'PUT', { id: zoneId, duration: durationSec })
  },

  async stopAll(apiKey: string, deviceId: string): Promise<void> {
    await rachioFetch(apiKey, '/device/stop_water', 'PUT', { id: deviceId })
  },

  async getSchedules(apiKey: string, deviceId: string): Promise<RachioSchedule[]> {
    const rules = await rachioFetch(apiKey, `/device/${deviceId}/scheduleRules`)
    return (rules ?? []).map((r: any): RachioSchedule => ({
      id:              r.id,
      name:            r.name ?? 'Unnamed Schedule',
      enabled:         r.enabled ?? false,
      startTimeMs:     r.startTime ?? 0,
      totalDurationSec: r.totalDuration ?? 0,
      nextRunDate:     r.nextRunDate ?? null,
      lastRunDate:     r.lastRunDate ?? null,
      type:            r.type ?? '',
      summary:         r.summary ?? '',
    }))
  },

  async enableSchedule(apiKey: string, scheduleId: string): Promise<void> {
    await rachioFetch(apiKey, '/schedulerule/enable', 'PUT', { id: scheduleId })
  },

  async disableSchedule(apiKey: string, scheduleId: string): Promise<void> {
    await rachioFetch(apiKey, '/schedulerule/disable', 'PUT', { id: scheduleId })
  },

  async skipSchedule(apiKey: string, scheduleId: string): Promise<void> {
    await rachioFetch(apiKey, '/schedulerule/skip', 'PUT', { id: scheduleId })
  },
}
