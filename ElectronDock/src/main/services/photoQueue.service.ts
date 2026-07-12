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
import { unlink, readdir, stat, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { settingsService } from './settings.service'
import { photosService } from './photos.service'
import { dropboxService, cacheNameForPath } from './dropbox.service'
import { icloudService } from './icloud.service'

// ── Config ────────────────────────────────────────────────────────────────────

const DAWN_HOUR = 6           // hour of daily index refresh (06:05)
const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'])

function getCacheDir(): string {
  return join(app.getPath('userData'), 'dropbox-cache')
}

/** Total photos to keep on disk — driven by the "Photos to sync" slider. */
function cacheSize(): number {
  const n = settingsService.getAll().dropboxPhotoCount
  return Math.max(1, Number.isFinite(n) ? n : 200)
}

/**
 * Evict / download / advance-trigger batch size, scaled to the cache size
 * so a 50-photo cache doesn't sit unchanged for 250 advances. Half the
 * cache (rounded up) — same proportion as the original 250/500 constants.
 */
function batchSize(): number {
  return Math.max(1, Math.ceil(cacheSize() / 2))
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

/**
 * Push the canonical disk-state into photosService so the renderer's photo list
 * stays correct independent of chokidar watcher health. Called after every bulk
 * disk operation (initial fill, dawn refresh, top-up).
 */
function syncPhotos(): void {
  if (mainWin) photosService.setList(downloadedFiles, mainWin)
}

// ── Service ───────────────────────────────────────────────────────────────────

export const photoQueueService = {

  // ── Startup ─────────────────────────────────────────────────────────────────

  async initialize(win: BrowserWindow): Promise<void> {
    mainWin = win
    const settings = settingsService.getAll()

    if (!settings.dropboxEnabled || settings.dropboxFolderPaths.length === 0) {
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
    syncPhotos()
  },

  // ── Initial fill (also called by "Sync Now") ─────────────────────────────────

  async _doInitialFill(): Promise<void> {
    if (isWorking) return
    isWorking = true
    const cacheDir = getCacheDir()

    try {
      emit(0, 'Fetching photo index from Dropbox…')
      const settings  = settingsService.getAll()
      const allPhotos = await dropboxService.listAllPhotosMulti(settings.dropboxFolderPaths)
      if (allPhotos.length === 0) throw new Error('No photos found in the configured Dropbox folders.')

      shuffledQueue   = [...allPhotos]
      fisherYates(shuffledQueue)
      queuePointer    = 0
      downloadedFiles = []
      advanceCount    = 0

      emit(5, `Found ${allPhotos.length} photos — clearing old cache…`)
      // Empty the cache dir in place rather than rm-rf'ing it. Removing the
      // directory destroys the chokidar inotify watch on Linux; recreating
      // the path doesn't restore it, leaving the renderer with an empty list
      // even after downloads succeed.
      await mkdir(cacheDir, { recursive: true })
      const oldFiles = await readdir(cacheDir).catch(() => [] as string[])
      await Promise.all(oldFiles.map((f) => unlink(join(cacheDir, f)).catch(() => {})))

      const toDownload = shuffledQueue.slice(0, cacheSize())
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
    if (advanceCount >= batchSize() && !isWorking) {
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
    // Refresh the iCloud Shared Album alongside Dropbox. Independent of the
    // Dropbox source and its isWorking guard — an iCloud-only kiosk still syncs.
    icloudService.syncIfEnabled(mainWin ?? undefined).catch((err) => console.warn('[icloud] dawn sync failed:', err))
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
      if (!settings.dropboxEnabled || settings.dropboxFolderPaths.length === 0) {
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
      const allPhotos = await dropboxService.listAllPhotosMulti(settings.dropboxFolderPaths)
      shuffledQueue   = [...allPhotos]
      fisherYates(shuffledQueue)
      queuePointer    = downloadedFiles.length  // skip re-downloading what we still have
      emit(20, `Index refreshed — ${allPhotos.length} total photos`)

      // 3. Top up to the configured cache size
      const needed = cacheSize() - downloadedFiles.length
      if (needed > 0 && queuePointer < shuffledQueue.length) {
        const count   = Math.min(needed, shuffledQueue.length - queuePointer)
        const toBatch = shuffledQueue.slice(queuePointer, queuePointer + count)
        queuePointer += toBatch.length

        await dropboxService.downloadBatch(toBatch, cacheDir, (done, total) => {
          emit(20 + Math.round((done / total) * 75), `Downloaded ${done} / ${total}`)
        })

        const newFiles = toBatch
          .map((p) => cacheNameForPath(p))
          .filter((f) => existsSync(join(cacheDir, f)))
        downloadedFiles.push(...newFiles)
      }

      settingsService.setDropboxLastSync(Date.now())
      syncPhotos()
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
      if (!settings.dropboxEnabled) return

      // 1. Wrap the queue pointer if we've exhausted it — re-shuffle for continued variety
      if (queuePointer >= shuffledQueue.length && shuffledQueue.length > 0) {
        fisherYates(shuffledQueue)
        queuePointer = 0
      }

      // 2. Pick the next batch to download — DON'T evict anything yet.
      //    Previous version evicted before downloading; if Dropbox returned
      //    auth/scope errors, downloadBatch swallowed them per-file (it
      //    "skips silently") and the cache shrunk to zero over time. Now we
      //    only evict in proportion to what we actually managed to download,
      //    so a network/auth outage leaves the cache intact rather than
      //    draining the slideshow.
      const avail   = shuffledQueue.length > 0 ? shuffledQueue.length - queuePointer : 0
      const count   = Math.min(batchSize(), avail)
      const toBatch = shuffledQueue.slice(queuePointer, queuePointer + count)
      if (toBatch.length === 0) {
        console.log('[photoQueue] Top-up: nothing to download (queue empty / Dropbox source missing)')
        return
      }
      queuePointer += toBatch.length

      // 3. Download. Per-file failures are swallowed by downloadBatch.
      await dropboxService.downloadBatch(toBatch, cacheDir, () => {})
      const newFiles = toBatch
        .map((p) => cacheNameForPath(p))
        .filter((f) => existsSync(join(cacheDir, f)))

      if (newFiles.length === 0) {
        console.warn(
          '[photoQueue] Top-up: download landed 0 files — likely Dropbox auth/scope issue. ' +
          'Cache kept intact; will retry on next batch of advances.'
        )
        return
      }

      // 4. Evict only as many oldest files as we successfully downloaded —
      //    bounded by downloadedFiles.length so we never under-flow.
      const evictCount = Math.min(newFiles.length, downloadedFiles.length)
      const toEvict    = downloadedFiles.splice(0, evictCount)
      for (const filename of toEvict) {
        await unlink(join(cacheDir, filename)).catch(() => {})
      }

      // 5. Append the freshly-downloaded files
      downloadedFiles.push(...newFiles)
      console.log(`[photoQueue] Top-up: +${newFiles.length}, -${toEvict.length} → ${downloadedFiles.length} total`)
      syncPhotos()
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
