// iCloud Shared Album (public) photo source — supports any number of albums.
//
// Uses Apple's unofficial, unauthenticated "sharedstreams" web API — the same
// one the public album website calls. Only works for albums the owner has
// toggled "Public Website" on. For each configured album we pull the photo
// index, pick the largest image derivative per photo, resolve short-lived
// signed download URLs, and mirror the result into a local cache dir
// (userData/icloud-cache). Files are named icloud-<albumKey>-<checksum>.jpg so
// each album's photos are independently prunable: photos removed from an album
// are deleted, and removing an album from the list removes exactly its files.
// The cached files are folded into the same slideshow pool as Dropbox photos
// via photosService.setIcloudList().

import { join } from 'path'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { readdir, unlink, writeFile, mkdir } from 'fs/promises'
import { settingsService } from './settings.service'
import { photosService } from './photos.service'
import type { IcloudAlbumStatus, IcloudStatus, IcloudSyncResult } from '../../preload/types'

// ── Config ────────────────────────────────────────────────────────────────────

const PREFIX      = 'icloud-'            // filename prefix so the protocol handler can route
const GUID_BATCH  = 20                   // photoGuids per webasseturls request
const CONCURRENT  = 5                    // parallel downloads
const STALE_HOURS = 6                    // don't auto-resync more often than this
// Any pXX host works as an entry point; Apple 330-redirects to the album's real
// partition, which we then follow.
const ENTRY_HOST  = 'p23-sharedstreams.icloud.com'

const COMMON_HEADERS = {
  'Content-Type': 'text/plain',
  Origin:  'https://www.icloud.com',
  Referer: 'https://www.icloud.com/',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cacheDir(): string {
  return join(app.getPath('userData'), 'icloud-cache')
}

/** Extract the album token (the bit after the URL '#'). Returns '' if absent. */
function parseToken(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  const hash = raw.indexOf('#')
  if (hash >= 0) return raw.slice(hash + 1).trim()
  // Tolerate a bare token pasted without the full URL.
  if (!raw.includes('/') && !raw.includes('.')) return raw
  return ''
}

/** Short per-album cache key used in filenames (icloud-<key>-<checksum>.jpg). */
function albumKey(token: string): string {
  return token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
}

/** Sanitize a derivative checksum into a safe filename stem. */
function safeStem(checksum: string): string {
  return checksum.replace(/[^a-zA-Z0-9]/g, '')
}

/** Album key embedded in a cached filename, or '' if not an iCloud file. */
function keyOfFile(filename: string): string {
  if (!filename.startsWith(PREFIX)) return ''
  return filename.slice(PREFIX.length).split('-')[0] ?? ''
}

type Derivative = { checksum?: string; fileSize?: string | number; width?: number; height?: number }
type StreamPhoto = {
  photoGuid?: string
  mediaAssetType?: string
  derivatives?: Record<string, Derivative>
}
type Chosen = { guid: string; checksum: string; filename: string }
type AlbumConfig = { url: string; token: string; key: string }

/**
 * POST to the sharedstreams API, following Apple's non-standard 330 redirect
 * to the album's real partition host. Returns the parsed JSON plus the host
 * that answered (webasseturls must be sent to the same host).
 */
async function apiPost(host: string, token: string, endpoint: string, body: unknown): Promise<{ host: string; data: any }> {
  let current = host
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://${current}/${token}/sharedstreams/${endpoint}`, {
      method: 'POST',
      headers: COMMON_HEADERS,
      body: JSON.stringify(body),
      // A hung connection must fail the sync (which retries later), never
      // stall it forever — sync() runs unsupervised on a wall kiosk.
      signal: AbortSignal.timeout(30_000),
    })
    // 330 = Apple "wrong partition" — body carries the correct host.
    if (res.status === 330) {
      const redirect = await res.json().catch(() => ({})) as any
      const next = redirect['X-Apple-MMe-Host']
      if (!next) throw new Error('iCloud 330 redirect missing X-Apple-MMe-Host')
      current = next
      continue
    }
    if (!res.ok) throw new Error(`iCloud ${endpoint} failed: ${res.status}`)
    const data = await res.json()
    return { host: current, data }
  }
  throw new Error('iCloud API: too many partition redirects')
}

/** Choose the largest image derivative for each non-video photo. */
function chooseDerivatives(photos: StreamPhoto[], key: string): Chosen[] {
  const chosen: Chosen[] = []
  for (const photo of photos ?? []) {
    if (!photo || photo.mediaAssetType === 'video') continue
    const guid = photo.photoGuid
    if (!guid) continue
    const derivs = Object.values(photo.derivatives ?? {}).filter(
      (d): d is Derivative => !!d && !!d.checksum && Number(d.fileSize) > 0
    )
    if (derivs.length === 0) continue
    derivs.sort((a, b) => Number(b.fileSize) - Number(a.fileSize))
    const best = derivs[0]
    chosen.push({ guid, checksum: best.checksum!, filename: `${PREFIX}${key}-${safeStem(best.checksum!)}.jpg` })
  }
  return chosen
}

function configuredAlbums(): AlbumConfig[] {
  const urls = settingsService.getAll().icloudAlbumUrls ?? []
  const seen = new Set<string>()
  const albums: AlbumConfig[] = []
  for (const url of urls) {
    const token = parseToken(url)
    if (!token || seen.has(token)) continue
    seen.add(token)
    albums.push({ url, token, key: albumKey(token) })
  }
  return albums
}

// ── State ───────────────────────────────────────────────────────────────────

let mainWin: BrowserWindow | null = null
let isSyncing = false

// ── Service ───────────────────────────────────────────────────────────────────

export const icloudService = {

  /** Directory where cached iCloud photos live (also used by the cdphoto protocol). */
  cacheDir,

  /** True when a filename belongs to the iCloud cache (routing hint for the protocol handler). */
  owns(filename: string): boolean {
    return filename.startsWith(PREFIX)
  },

  getStatus(): IcloudStatus {
    const s    = settingsService.getAll()
    const meta = s.icloudAlbumMeta ?? {}
    const albums: IcloudAlbumStatus[] = configuredAlbums().map((a) => ({
      url:        a.url,
      token:      a.token,
      name:       meta[a.token]?.name ?? '',
      photoCount: meta[a.token]?.count ?? 0,
      error:      meta[a.token]?.error ?? '',
    }))
    return {
      enabled:    !!s.icloudPhotosEnabled,
      albums,
      lastSync:   s.icloudLastSync   || 0,
      photoCount: s.icloudPhotoCount || 0,
      lastError:  s.icloudLastError  || '',
      isSyncing,
    }
  },

  /** Load whatever is already cached into the slideshow pool; resync if stale. */
  async initialize(win: BrowserWindow): Promise<void> {
    mainWin = win
    const s = settingsService.getAll()
    if (!s.icloudPhotosEnabled || configuredAlbums().length === 0) {
      photosService.setIcloudList([], win)
      return
    }
    await this._loadExistingCache()
    const hoursSince = (Date.now() - (s.icloudLastSync ?? 0)) / 3_600_000
    if (hoursSince > STALE_HOURS || (s.icloudPhotoCount ?? 0) === 0) {
      this.sync().catch((err) => console.warn('[icloud] initial sync failed:', err))
    }
  },

  /** Fold the on-disk cache into the slideshow list without hitting the network. */
  async _loadExistingCache(): Promise<void> {
    if (!mainWin) return
    try {
      const files = await readdir(cacheDir()).catch(() => [] as string[])
      photosService.setIcloudList(files.filter((f) => this.owns(f)), mainWin)
    } catch {
      /* leave list unchanged */
    }
  },

  /** Sync only if the feature is enabled and at least one album is configured. */
  async syncIfEnabled(win?: BrowserWindow): Promise<void> {
    if (win) mainWin = win
    const s = settingsService.getAll()
    if (!s.icloudPhotosEnabled || configuredAlbums().length === 0) return
    await this.sync()
  },

  /** Drop iCloud photos from the pool (called when the source is disabled). */
  clearList(win?: BrowserWindow): void {
    if (win) mainWin = win
    if (mainWin) photosService.setIcloudList([], mainWin)
  },

  /**
   * Full sync across all configured albums: fetch each album's index, download
   * new photos, prune photos removed from that album, and delete files
   * belonging to albums no longer in the list. One album failing (network,
   * made private, deleted) doesn't block the others — its cached files are
   * kept and its error is recorded per-album. Non-fatal throughout.
   */
  async sync(): Promise<IcloudSyncResult> {
    if (isSyncing) {
      return { ok: false, count: settingsService.getAll().icloudPhotoCount || 0, error: 'Sync already in progress' }
    }
    isSyncing = true
    const dir = cacheDir()

    try {
      const s = settingsService.getAll()
      if (!s.icloudPhotosEnabled) {
        this.clearList()
        return { ok: true, count: 0, error: '' }
      }
      const albums = configuredAlbums()
      if (albums.length === 0) throw new Error('No iCloud album links configured (paste a shared-album URL).')

      await mkdir(dir, { recursive: true })
      const prevMeta = s.icloudAlbumMeta ?? {}
      const newMeta: Record<string, { ctag: string; count: number; error: string; name: string }> = {}
      const errors: string[] = []

      // Delete files from albums that were removed from the list.
      const validKeys = new Set(albums.map((a) => a.key))
      let onDisk = (await readdir(dir).catch(() => [] as string[])).filter((f) => this.owns(f))
      let removedAlbumFiles = 0
      for (const f of onDisk) {
        if (!validKeys.has(keyOfFile(f))) {
          await unlink(join(dir, f)).catch(() => {})
          removedAlbumFiles++
        }
      }
      if (removedAlbumFiles > 0) {
        onDisk = onDisk.filter((f) => validKeys.has(keyOfFile(f)))
        console.log(`[icloud] removed ${removedAlbumFiles} files from albums no longer configured`)
      }

      for (const album of albums) {
        const albumFiles = onDisk.filter((f) => keyOfFile(f) === album.key)
        try {
          // 1. Album index
          const { host, data } = await apiPost(ENTRY_HOST, album.token, 'webstream', { streamCtag: null })
          const ctag   = String(data?.streamCtag ?? '')
          const name   = String(data?.streamName ?? '') || (prevMeta[album.token]?.name ?? '')
          const chosen = chooseDerivatives(data?.photos ?? [], album.key)
          if (chosen.length === 0) throw new Error('Album is empty or contains no downloadable photos.')

          const wanted = new Set(chosen.map((c) => c.filename))

          // 2. Prune photos removed from this album
          let pruned = 0
          for (const f of albumFiles) {
            if (!wanted.has(f)) { await unlink(join(dir, f)).catch(() => {}); pruned++ }
          }

          // 3. What still needs downloading
          const present = new Set(albumFiles.filter((f) => wanted.has(f)))
          const missing = chosen.filter((c) => !present.has(c.filename))

          // Fast path: album unchanged since last sync and everything present.
          if (missing.length === 0 && pruned === 0 && ctag && ctag === (prevMeta[album.token]?.ctag || '')) {
            newMeta[album.token] = { ctag, count: present.size, error: '', name }
            continue
          }

          // 4. Resolve signed URLs (batched) only for the photos we still need
          let downloaded = 0
          for (let i = 0; i < missing.length; i += GUID_BATCH) {
            const batch = missing.slice(i, i + GUID_BATCH)
            const { data: assets } = await apiPost(host, album.token, 'webasseturls', { photoGuids: batch.map((c) => c.guid) })
            const items = assets?.items ?? {}

            for (let j = 0; j < batch.length; j += CONCURRENT) {
              const slice = batch.slice(j, j + CONCURRENT)
              await Promise.all(slice.map(async (c) => {
                const item = items[c.checksum]
                if (!item?.url_location || !item?.url_path) return
                try {
                  const r = await fetch(`https://${item.url_location}${item.url_path}`, { signal: AbortSignal.timeout(60_000) })
                  if (!r.ok) return
                  await writeFile(join(dir, c.filename), Buffer.from(await r.arrayBuffer()))
                  downloaded++
                } catch {
                  // Skip silently — signed URL expiry / network blip.
                }
              }))
            }
          }

          // 5. Count from actual disk contents for this album
          const finalCount = (await readdir(dir).catch(() => [] as string[]))
            .filter((f) => keyOfFile(f) === album.key && wanted.has(f)).length
          newMeta[album.token] = { ctag, count: finalCount, error: '', name }
          console.log(`[icloud] ${album.token}: +${downloaded} -${pruned} → ${finalCount} photos`)
        } catch (err) {
          // Keep this album's cached files; record the error and move on.
          const msg = (err as Error).message || String(err)
          console.warn(`[icloud] sync failed for ${album.token}:`, msg)
          newMeta[album.token] = {
            ctag:  prevMeta[album.token]?.ctag ?? '',
            count: albumFiles.length,
            error: msg,
            name:  prevMeta[album.token]?.name ?? '',
          }
          errors.push(msg)
        }
      }

      // Refresh the pool from disk and persist per-album status.
      const finalFiles = (await readdir(dir).catch(() => [] as string[])).filter((f) => this.owns(f))
      if (mainWin) photosService.setIcloudList(finalFiles, mainWin)
      const aggregateError = errors.join(' · ')
      settingsService.setIcloudSyncResult(finalFiles.length, newMeta, aggregateError)
      console.log(`[icloud] sync complete: ${finalFiles.length} photos across ${albums.length} album(s)` +
        (errors.length ? ` (${errors.length} album(s) failed)` : ''))
      return { ok: errors.length === 0, count: finalFiles.length, error: aggregateError }
    } catch (err) {
      const msg = (err as Error).message || String(err)
      console.warn('[icloud] sync failed:', msg)
      settingsService.setIcloudError(msg)
      // Leave whatever is cached in the pool.
      await this._loadExistingCache()
      const count = (await readdir(dir).catch(() => [] as string[])).filter((f) => this.owns(f)).length
      return { ok: false, count, error: msg }
    } finally {
      isSyncing = false
    }
  },
}
