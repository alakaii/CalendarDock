import { app } from 'electron'
import { join, extname } from 'path'
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'fs'

// Accepted image extensions for the SSH-drop / uploaded fullscreen art.
const ART_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

/**
 * Fullscreen background art stored as a real file under Electron userData
 * (kiosk: /home/pc/.config/calendardock/backgroundArt/). Not localStorage —
 * avoids the base64 quota risk and lets the user scp a PNG straight in.
 */
export const backgroundArtService = {
  /** Absolute path to the art folder, created on first access. */
  dir(): string {
    const d = join(app.getPath('userData'), 'backgroundArt')
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
    return d
  },

  /** First image file in the folder (alphabetical), or null if none. */
  findFile(): string | null {
    try {
      const files = readdirSync(this.dir())
        .filter((f) => ART_EXTENSIONS.includes(extname(f).toLowerCase()))
        .sort()
      return files[0] ?? null
    } catch {
      return null
    }
  },

  /** cdphoto serving URL for the current art file, or null. Cache-busted. */
  getUrl(): string | null {
    const f = this.findFile()
    if (!f) return null
    return `cdphoto://art/${encodeURIComponent(f)}?t=${Date.now()}`
  },

  /** Write uploaded bytes as fullscreen.<ext>, replacing any prior art. */
  save(bytes: Uint8Array, ext: string): string {
    const d = this.dir()
    this.clear()
    const clean = ext.toLowerCase().replace(/^\./, '')
    const safeExt = ART_EXTENSIONS.includes('.' + clean) ? clean : 'png'
    const name = `fullscreen.${safeExt}`
    writeFileSync(join(d, name), bytes)
    return name
  },

  /** Remove every image file in the folder. */
  clear(): void {
    const d = this.dir()
    for (const f of readdirSync(d)) {
      if (ART_EXTENSIONS.includes(extname(f).toLowerCase())) {
        try { rmSync(join(d, f)) } catch { /* ignore */ }
      }
    }
  },
}
