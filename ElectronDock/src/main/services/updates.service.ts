import { app, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { createWriteStream, promises as fsp } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import Store from 'electron-store'

// Use /releases (not /releases/latest) so prerelease tags like
// "v1.0.0-build.42" — which GitHub auto-marks as pre-releases — are visible.
const RELEASES_API = 'https://api.github.com/repos/alakaii/CalendarDock/releases?per_page=10'
const HELPER_PATH  = '/usr/local/bin/calendardock-self-update'

type Schedule = {
  enabled: boolean
  /** 24h "HH:MM" — local time */
  time: string
}

type UpdatesStore = {
  schedule: Schedule
}

type ReleaseAsset = {
  name: string
  browser_download_url: string
  size: number
}

type Release = {
  tag_name: string
  name?: string
  published_at?: string
  assets?: ReleaseAsset[]
}

export type CheckResult = {
  currentVersion: string
  latestVersion:  string | null
  hasUpdate:      boolean
  debUrl:         string | null
  publishedAt:    string | null
  /** Set when releases-not-supported on this platform / dev mode */
  unavailableReason?: string
}

export type InstallProgress =
  | { phase: 'downloading'; percent: number }
  | { phase: 'installing' }
  | { phase: 'restarting' }
  | { phase: 'error'; message: string }

const store = new Store<UpdatesStore>({
  name: 'updates',
  defaults: {
    schedule: { enabled: false, time: '04:00' },
  },
})

let scheduleTimer: NodeJS.Timeout | null = null
let currentWindow: BrowserWindow | null = null

function isKioskRuntime(): boolean {
  return process.platform === 'linux' && app.isPackaged
}

function stripV(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag
}

/**
 * GitHub's /releases endpoint isn't reliably sorted (we've seen build.10
 * listed after build.7), so taking the first element gives the wrong
 * result. Parse the build number out of the v{base}-build.{n} tag and
 * pick the release with the highest n.
 */
function buildNumber(tag: string): number {
  const m = /-build\.(\d+)$/.exec(tag)
  return m ? parseInt(m[1], 10) : -1
}

async function fetchLatestRelease(): Promise<Release> {
  const res = await fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CalendarDock-Updater',
    },
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  }
  const list = (await res.json()) as Release[]
  const candidates = list.filter(
    (r) => !(r as { draft?: boolean }).draft && r.assets?.some((a) => a.name.endsWith('.deb'))
  )
  if (candidates.length === 0) throw new Error('No published release with a .deb asset found.')
  candidates.sort((a, b) => buildNumber(b.tag_name) - buildNumber(a.tag_name))
  return candidates[0]
}

function pickDebAsset(release: Release): ReleaseAsset | null {
  return release.assets?.find((a) => a.name.endsWith('.deb')) ?? null
}

async function downloadFile(url: string, destPath: string, onProgress: (pct: number) => void): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status})`)
  }
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0

  const fileStream = createWriteStream(destPath)
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const nodeStream = new Readable({
    async read() {
      const { value, done } = await reader.read()
      if (done) {
        this.push(null)
        return
      }
      received += value.byteLength
      if (total > 0) onProgress(Math.min(99, Math.floor((received / total) * 100)))
      this.push(Buffer.from(value))
    },
  })
  await pipeline(nodeStream, fileStream)
  onProgress(100)
}

function emitProgress(p: InstallProgress): void {
  currentWindow?.webContents.send('updates:progress', p)
}

function runHelper(debPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('sudo', ['-n', HELPER_PATH, debPath], { stdio: 'pipe' })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Installer exited ${code}: ${stderr.trim() || '(no stderr)'}`))
    })
  })
}

function nextScheduledFireTime(time: string): number {
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10))
  if (Number.isNaN(hh) || Number.isNaN(mm)) return Date.now() + 24 * 3600 * 1000
  const now  = new Date()
  const fire = new Date()
  fire.setHours(hh, mm, 0, 0)
  if (fire.getTime() <= now.getTime()) fire.setDate(fire.getDate() + 1)
  return fire.getTime()
}

function clearSchedule(): void {
  if (scheduleTimer) {
    clearTimeout(scheduleTimer)
    scheduleTimer = null
  }
}

function armSchedule(): void {
  clearSchedule()
  const sched = store.get('schedule')
  if (!sched.enabled) return

  const delay = nextScheduledFireTime(sched.time) - Date.now()
  scheduleTimer = setTimeout(async () => {
    try {
      const result = await updatesService.check()
      if (result.hasUpdate && result.debUrl) {
        await updatesService.install()
        return
      }
    } catch (err) {
      console.warn('[updates] scheduled check failed:', err)
    }
    armSchedule()
  }, delay)
}

export const updatesService = {
  init(win: BrowserWindow): void {
    currentWindow = win
    armSchedule()
  },

  async check(): Promise<CheckResult> {
    const currentVersion = app.getVersion()

    if (!isKioskRuntime()) {
      return {
        currentVersion,
        latestVersion: null,
        hasUpdate: false,
        debUrl: null,
        publishedAt: null,
        unavailableReason: 'Auto-update only runs on the installed kiosk (Linux).',
      }
    }

    const release = await fetchLatestRelease()
    const latestVersion = stripV(release.tag_name)
    const asset = pickDebAsset(release)

    return {
      currentVersion,
      latestVersion,
      hasUpdate: !!asset && latestVersion !== currentVersion,
      debUrl: asset?.browser_download_url ?? null,
      publishedAt: release.published_at ?? null,
    }
  },

  async install(): Promise<void> {
    if (!isKioskRuntime()) {
      throw new Error('Updates only run on the installed kiosk (Linux).')
    }

    const result = await this.check()
    if (!result.hasUpdate || !result.debUrl) {
      throw new Error('No update available.')
    }

    const debPath = join(tmpdir(), 'calendardock-update.deb')
    try { await fsp.unlink(debPath) } catch { /* ignore */ }

    emitProgress({ phase: 'downloading', percent: 0 })
    await downloadFile(result.debUrl, debPath, (pct) =>
      emitProgress({ phase: 'downloading', percent: pct })
    )

    emitProgress({ phase: 'installing' })
    try {
      await runHelper(debPath)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      emitProgress({ phase: 'error', message })
      throw err
    }

    emitProgress({ phase: 'restarting' })
    // The helper restarts the systemd service, which will replace our process shortly.
  },

  getSchedule(): Schedule {
    return store.get('schedule')
  },

  setSchedule(schedule: Schedule): Schedule {
    const cleaned: Schedule = {
      enabled: !!schedule.enabled,
      time: /^\d{2}:\d{2}$/.test(schedule.time) ? schedule.time : '04:00',
    }
    store.set('schedule', cleaned)
    armSchedule()
    return cleaned
  },
}
