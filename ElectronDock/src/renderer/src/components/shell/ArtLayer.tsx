import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'

/**
 * Fetches the serving URL for the fullscreen background art file
 * (userData/backgroundArt/, served via cdphoto://art/). Re-fetches when
 * `enabled` turns on and whenever the user uploads new art (the
 * `fullscreenArtChanged` window event). Returns null when disabled or unset.
 */
export function useFullscreenArtUrl(enabled: boolean): string | null {
  const [artUrl, setArtUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) { setArtUrl(null); return }
    let cancelled = false
    const load = () => window.api.art.getFullscreen().then((u) => { if (!cancelled) setArtUrl(u) })
    load()
    window.addEventListener('fullscreenArtChanged', load)
    return () => { cancelled = true; window.removeEventListener('fullscreenArtChanged', load) }
  }, [enabled])
  return artUrl
}

/**
 * Presentational full-bleed art <img>. Absolutely fills its positioned parent,
 * honoring the user's scale mode and pixel-perfect setting. Pass a `className`
 * (e.g. a z-index utility) to place it in the parent's stacking context.
 */
export function ArtImage({ artUrl, className = '' }: { artUrl: string; className?: string }): React.ReactElement {
  const artScaleMode = useSettingsStore((s) => s.artScaleMode)
  const artPixelated = useSettingsStore((s) => s.artPixelated)
  return (
    <img
      aria-hidden="true"
      src={artUrl}
      alt=""
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      style={{
        objectFit: artScaleMode === 'fit' ? 'contain' : artScaleMode === 'stretch' ? 'fill' : 'cover',
        imageRendering: artPixelated ? 'pixelated' : 'auto',
      }}
    />
  )
}

/**
 * Self-contained full-bleed art layer: fetches the art URL (when `enabled`)
 * and renders it. Renders nothing when disabled or no art file is set. Shared
 * by AppShell (behind the whole UI) and StandbyOverlay (the standby art frame).
 */
export default function ArtLayer({
  enabled = true,
  className = '',
}: {
  enabled?: boolean
  className?: string
}): React.ReactElement | null {
  const artUrl = useFullscreenArtUrl(enabled)
  if (!enabled || !artUrl) return null
  return <ArtImage artUrl={artUrl} className={className} />
}
