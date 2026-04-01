/**
 * Rolling photo cache queue manager.
 *
 * Maintains a 500-photo disk cache from Dropbox. As the slideshow advances,
 * it tracks a "viewed" count and evicts + refills in 250-photo batches.
 * Downloads are paused while the user is actively using the app (mode === 'app')
 * so the UI stays snappy. A fresh index is fetched from Dropbox each dawn (06:05).
 */

import { join } from 'path'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { rm, unlink, readdir, stat, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { settingsService } from './settings.service'
import { photosService } from './photos.service'
import { dropboxService } from './dropbox.service'

// ── Config ────────────────────────────────────────────────────────────────────

const CACHE_SIZE      = 500   // total photos to keep on disk
const EVICT_THRESHOLD = 250   // advance count that triggers a top-up
const EVICT_BATCH     = 250   // files to evict per cycle
const DOWNLOAD_BATCH  = 250   // files to download per top-up
const DAWN_HOUR       = 6     // hour of daily index refresh (06:05)

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'])

function getCacheDir(): string {
  return join(app.getPath('userData'), 'dropbox-cache')
}

/** In-place Fisher-Yates shuffle */
function fisherYates(arr: string[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

// ── Module state ──────────────────────────────────────────────────────────────

let mainWin: BrowserWindow | null = null
let shuffledQueue: string[]   = []  // all Dropbox photo paths, shuffled
let queuePointer              = 0   // next index in shuffledQueue to download
let downloadedFiles: string[] = []  // FIFO filenames on disk (oldest evicted first)
let advanceCount              = 0   // slides shown since last top-up
let isPaused                  = false  // true while user is actively using the app
let topUpPending              = false
let isWorking                 = false
let dawnTimer: ReturnType<typeof setTimeout> | null = null

function emit(pct: number, status: string): void {
  mainWin?.webContents.send('dropbox:progress', { pct, status })
}

// ── Service ───────────────────────────────────────────────────────────────────

export const photoQueueService = {

  // ── Startup ─────────────────────────────────────────────────────────────────

  async initialize(win: BrowserWindow): Promise<void> {
    mainWin = win
    const settings = settingsService.getAll()

    if (!settings.dropboxEnabled || !settings.dropboxFolderPath) {
      // Local folder mode — just start the chokidar watcher
      if (settings.photoFolderPath) {
        photosService.startWatcher(settings.photoFolderPath, win)
      }
      return
    }

    const cacheDir = getCacheDir()
    // Point the photo watcher at the Dropbox cache dir
    settingsService.setPhotoFolder(cacheDir)
    photosService.startWatcher(cacheDir, win)

    const hoursSince  = (Date.now() - (settings.dropboxLastSync ?? 0)) / 3_600_000
    const cacheExists = existsSync(cacheDir)

    if (!cacheExists || hoursSince > 23) {
      console.log('[photoQueue] Stale / missing cache — running initial fill')
      this._doInitialFill().catch(console.error)
    } else {
      console.log('[photoQueue] Cache is fresh — loading existing files')
      await this._loadExistingCache(cacheDir)
    }

    this._scheduleDawn()
  },

  /** Populate downloadedFiles from whatever is already on disk. */
  async _loadExistingCache(cacheDir: string): Promise<void> {
    try {
      const files      = await readdir(cacheDir)
      const photoFiles = files.filter((f) =>
        SUPPORTED_EXTS.has(f.slice(f.lastIndexOf('.')).toLowerCase())
      )

      // Sort by mtime so FIFO eviction order matches actual download order
      const withStats = await Promise.all(
        photoFiles.map(async (f) => {
          const s = await stat(join(cacheDir, f)).catch(() => null)
          return { name: f, mtime: s?.mtimeMs ?? 0 }
        })
      )
      withStats.sort((a, b) => a.mtime - b.mtime)
      downloadedFiles = withStats.map((f) => f.name)
      console.log(`[photoQueue] Loaded ${downloadedFiles.length} files from existing cache`)
    } catch {
      downloadedFiles = []
    }
  },

  // ── Initial fill (also called by "Sync Now") ─────────────────────────────────

  async _doInitialFill(): Promise<void> {
    if (isWorking) return
    isWorking = true
    const cacheDir = getCacheDir()

    try {
      emit(0, 'Fetching photo index from Dropbox…')
      const settings  = settingsService.getAll()
      const allPhotos = await dropboxService.listAllPhotos(settings.dropboxFolderPath)
      if (allPhotos.length === 0) throw new Error('No photos found in that Dropbox folder.')

      shuffledQueue   = [...allPhotos]
      fisherYates(shuffledQueue)
      queuePointer    = 0
      downloadedFiles = []
      advanceCount    = 0

      emit(5, `Found ${allPhotos.length} photos — clearing old cache…`)
      if (existsSync(cacheDir)) await rm(cacheDir, { recursive: true, force: true })
      await mkdir(cacheDir, { recursive: true })

      const toDownload = shuffledQueue.slice(0, CACHE_SIZE)
      queuePointer     = toDownload.length

      await dropboxService.downloadBatch(toDownload, cacheDir, (done, total) => {
        emit(5 + Math.round((done / total) * 90), `Downloaded ${done} / ${total}`)
      })

      // Reload actual filenames from disk (some may have failed to download)
      await this._loadExistingCache(cacheDir)
      settingsService.setDropboxLastSync(Date.now())
      emit(100, `Done — ${downloadedFiles.length} photos loaded`)
      console.log(`[photoQueue] Initial fill complete: ${downloadedFiles.length} photos`)
    } catch (err) {
      console.error('[photoQueue] Initial fill failed:', err)
      emit(-1, `Failed: ${(err as Error).message}`)
    } finally {
      isWorking = false
    }
  },

  // ── Slideshow advance signal ──────────────────────────────────────────────────

  advance(): void {
    advanceCount++
    if (advanceCount >= EVICT_THRESHOLD && !isWorking) {
      if (isPaused) {
        topUpPending = true
      } else {
        advanceCount = 0
        this._topUp().catch(console.error)
      }
    }
  },

  // ── Pause / resume ────────────────────────────────────────────────────────────
  // Pause while the user is on the main app (downloads would compete with UI).
  // Resume when in standby / passive / deep-sleep (background time is fine).

  setPaused(paused: boolean): void {
    isPaused = paused
    if (!paused && topUpPending && !isWorking) {
      topUpPending = false
      advanceCount = 0
      this._topUp().catch(console.error)
    }
  },

  // ── Dawn signal (end of deep sleep / daily 06:05 cron) ───────────────────────

  wakeFromDeepSleep(): void {
    console.log('[photoQueue] Dawn signal — refreshing index')
    if (isWorking) {
      console.log('[photoQueue] Already working, will retry at next dawn')
      return
    }
    this._dawnRefresh().catch(console.error)
  },

  async _dawnRefresh(): Promise<void> {
    if (isWorking) return
    isWorking = true
    const cacheDir = getCacheDir()

    try {
      const settings = settingsService.getAll()
      if (!settings.dropboxEnabled || !settings.dropboxFolderPath) {
        isWorking = false
        return
      }

      emit(0, 'Dawn refresh — fetching latest index from Dropbox…')

      // 1. Evict photos that have been shown since last top-up
      const evictCount = Math.min(advanceCount, downloadedFiles.length)
      const toEvict    = downloadedFiles.splice(0, evictCount)
      advanceCount     = 0
      for (const filename of toEvict) {
        await unlink(join(cacheDir, filename)).catch(() => {})
      }
      emit(10, `Evicted ${toEvict.length} viewed photos`)

      // 2. Fetch a fresh photo index from Dropbox and re-shuffle
      const allPhotos = await dropboxService.listAllPhotos(settings.dropboxFolderPath)
      shuffledQueue   = [...allPhotos]
      fisherYates(shuffledQueue)
      queuePointer    = downloadedFiles.length  // skip re-downloading what we still have
      emit(20, `Index refreshed — ${allPhotos.length} total photos`)

      // 3. Top up to CACHE_SIZE
      const needed = CACHE_SIZE - downloadedFiles.length
      if (needed > 0 && queuePointer < shuffledQueue.length) {
        const count   = Math.min(needed, shuffledQueue.length - queuePointer)
        const toBatch = shuffledQueue.slice(queuePointer, queuePointer + count)
        queuePointer += toBatch.length

        await dropboxService.downloadBatch(toBatch, cacheDir, (done, total) => {
          emit(20 + Math.round((done / total) * 75), `Downloaded ${done} / ${total}`)
        })

        const newFiles = toBatch
          .map((p) => p.split('/').pop()!)
          .filter((f) => existsSync(join(cacheDir, f)))
        downloadedFiles.push(...newFiles)
      }

      settingsService.setDropboxLastSync(Date.now())
      emit(100, `Done — ${downloadedFiles.length} photos in cache`)
      console.log(`[photoQueue] Dawn refresh complete: ${downloadedFiles.length} photos on disk`)
    } catch (err) {
      console.error('[photoQueue] Dawn refresh failed:', err)
      emit(-1, `Dawn refresh failed: ${(err as Error).message}`)
    } finally {
      isWorking = false
    }
  },

  // ── Rolling top-up ────────────────────────────────────────────────────────────

  async _topUp(): Promise<void> {
    if (isWorking) return
    isWorking = true
    const cacheDir = getCacheDir()

    try {
      const settings = settingsService.getAll()
      if (!settings.dropboxEnabled) { isWorking = false; return }

      console.log('[photoQueue] Top-up: evicting oldest batch and downloading fresh')

      // 1. Evict the oldest EVICT_BATCH files
      const toEvict = downloadedFiles.splice(0, Math.min(EVICT_BATCH, downloadedFiles.length))
      for (const filename of toEvict) {
        await unlink(join(cacheDir, filename)).catch(() => {})
      }
      console.log(`[photoQueue] Evicted ${toEvict.length} files`)

      // 2. Wrap the queue pointer if we've exhausted it — re-shuffle for continued variety
      if (queuePointer >= shuffledQueue.length && shuffledQueue.length > 0) {
        fisherYates(shuffledQueue)
        queuePointer = 0
      }

      // 3. Download next batch
      const needed  = CACHE_SIZE - downloadedFiles.length
      const avail   = shuffledQueue.length > 0 ? shuffledQueue.length - queuePointer : 0
      const count   = Math.min(needed, DOWNLOAD_BATCH, avail)
      const toBatch = shuffledQueue.slice(queuePointer, queuePointer + count)
      queuePointer += count

      if (toBatch.length > 0) {
        await dropboxService.downloadBatch(toBatch, cacheDir, () => {})
        const newFiles = toBatch
          .map((p) => p.split('/').pop()!)
          .filter((f) => existsSync(join(cacheDir, f)))
        downloadedFiles.push(...newFiles)
        console.log(`[photoQueue] Top-up: +${newFiles.length} files → ${downloadedFiles.length} total`)
      }
    } catch (err) {
      console.error('[photoQueue] Top-up failed:', err)
    } finally {
      isWorking = false
    }
  },

  // ── Daily dawn scheduler ──────────────────────────────────────────────────────

  _scheduleDawn(): void {
    if (dawnTimer) clearTimeout(dawnTimer)
    const now  = new Date()
    const dawn = new Date(now)
    // If already past 06:05 today, target tomorrow
    dawn.setDate(dawn.getDate() + (now.getHours() >= DAWN_HOUR ? 1 : 0))
    dawn.setHours(DAWN_HOUR, 5, 0, 0)
    const ms = dawn.getTime() - now.getTime()
    console.log(`[photoQueue] Next dawn refresh in ${Math.round(ms / 60_000)} min`)
    dawnTimer = setTimeout(() => {
      this.wakeFromDeepSleep()
      this._scheduleDawn()
    }, ms)
  },

  /** Stop all timers and reset state (call before reinitializing). */
  stop(): void {
    if (dawnTimer) { clearTimeout(dawnTimer); dawnTimer = null }
  },

  /** Full restart — used when Dropbox config changes at runtime. */
  async restart(win: BrowserWindow): Promise<void> {
    this.stop()
    shuffledQueue   = []
    queuePointer    = 0
    downloadedFiles = []
    advanceCount    = 0
    isPaused        = false
    topUpPending    = false
    isWorking       = false
    await this.initialize(win)
  },
}
