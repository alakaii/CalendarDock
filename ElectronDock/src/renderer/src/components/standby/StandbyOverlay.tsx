import { useRef, CSSProperties } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import PhotoSlideshow, { type PhotoSlideshowHandle } from './PhotoSlideshow'
import StandbyTime from './StandbyTime'
import StandbyWeather from './StandbyWeather'
import TodayEventsDrawer from './TodayEventsDrawer'
import StandbyWater from './StandbyWater'
import { usePhotos } from '../../hooks/usePhotos'
import type { StandbyCorner, StandbyElementId } from '../../../../preload/types'

const CORNER_STYLE: Record<StandbyCorner, CSSProperties> = {
  'top-left':     { top: '1.5rem',    left: '1.5rem'  },
  'top-right':    { top: '1.5rem',    right: '1.5rem' },
  'bottom-left':  { bottom: '1.5rem', left: '1.5rem'  },
  'bottom-right': { bottom: '1.5rem', right: '1.5rem' },
}

const ALL_CORNERS: StandbyCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

// Minimum horizontal pixels to count as a swipe
const SWIPE_THRESHOLD = 50

export default function StandbyOverlay() {
  const setMode       = useUIStore((s) => s.setMode)
  const slideshow     = useSettingsStore((s) => s.slideshow)
  const layout        = useSettingsStore((s) => s.standbyLayout)
  const exitGesture   = useSettingsStore((s) => s.standbyExitGesture)
  const photos        = usePhotos()

  // Ref to the slideshow so we can call next() / prev()
  const slideshowRef  = useRef<PhotoSlideshowHandle>(null)

  // Pointer tracking refs for swipe & tap detection
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastTapRef      = useRef<number>(0)

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start) return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y

    // ── Swipe: horizontal movement dominates and exceeds threshold ──────────
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        slideshowRef.current?.next() // swipe left → next photo
      } else {
        slideshowRef.current?.prev() // swipe right → prev photo
      }
      return
    }

    // ── Tap: pointer barely moved ─────────────────────────────────────────
    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) return // too much movement

    if (exitGesture === 'single-tap') {
      setMode('calendar')
    } else {
      // Double-tap
      const now   = Date.now()
      const delta = now - lastTapRef.current
      lastTapRef.current = now
      if (delta < 350 && delta > 0) {
        setMode('calendar')
      }
    }
  }

  // Merge in water default for installs that pre-date this field
  const safeLayout = {
    ...layout,
    water: layout.water ?? { corner: 'bottom-right' as StandbyCorner, enabled: true },
    priority: layout.priority.includes('water') ? layout.priority : [...layout.priority, 'water'],
  }

  // Build element node map
  const elementNodes: Record<StandbyElementId, React.ReactNode> = {
    time:    safeLayout.time.enabled    ? <StandbyTime /> : null,
    weather: safeLayout.weather.enabled ? <StandbyWeather fields={safeLayout.weatherFields} /> : null,
    events:  safeLayout.events.enabled  ? <TodayEventsDrawer corner={safeLayout.events.corner} /> : null,
    water:   safeLayout.water.enabled   ? <StandbyWater /> : null,
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black overflow-hidden touch-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Background slideshow */}
      <PhotoSlideshow
        ref={slideshowRef}
        photos={photos}
        sortOrder={slideshow.sortOrder}
        intervalMs={slideshow.durationSec * 1000}
        transition={slideshow.transition}
        transitionDurationMs={slideshow.transitionDurationMs}
        cropMode={slideshow.cropMode}
        focusSafeZonePercent={slideshow.focusSafeZonePercent}
      />

      {/* Corner groups — one absolute flex group per corner */}
      {ALL_CORNERS.map((corner) => {
        const isRight  = corner.includes('right')
        const isBottom = corner.includes('bottom')

        // Collect enabled elements for this corner in priority order
        const items = safeLayout.priority
          .filter((id) => safeLayout[id].enabled && safeLayout[id].corner === corner)
          .map((id) => ({ id, node: elementNodes[id] }))
          .filter(({ node }) => node != null)

        if (items.length === 0) return null

        return (
          <div
            key={corner}
            className="absolute z-10"
            style={{
              ...CORNER_STYLE[corner],
              display: 'flex',
              // Bottom corners: column-reverse so highest-priority stays nearest the corner edge
              flexDirection: isBottom ? 'column-reverse' : 'column',
              alignItems: isRight ? 'flex-end' : 'flex-start',
              gap: '1rem',
            }}
          >
            {items.map(({ id, node }) => (
              <div key={id}>{node}</div>
            ))}
          </div>
        )
      })}

      {/* Swipe hint arrows */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white/20 text-3xl pointer-events-none select-none">‹</div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/20 text-3xl pointer-events-none select-none">›</div>

      {/* Exit hint — centered at bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/30 text-sm pointer-events-none select-none">
        {exitGesture === 'single-tap' ? 'Tap to unlock' : 'Double-tap to unlock'}
      </div>
    </div>
  )
}
