import { useRef, CSSProperties } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import PhotoSlideshow, { type PhotoSlideshowHandle } from './PhotoSlideshow'
import StandbyTime from './StandbyTime'
import StandbyWeather from './StandbyWeather'
import TodayEventsDrawer from './TodayEventsDrawer'
import StandbyWater from './StandbyWater'
import StandbyTesla from './StandbyTesla'
import { usePhotos } from '../../hooks/usePhotos'
import type { StandbyCorner, StandbyElementId } from '../../../../preload/types'

// Position + flex behavior keyed by anchor. Center anchors center-align their
// stack; corners hug their respective edge. Bottom-row anchors stack
// reverse-column so the highest-priority widget stays nearest the bottom edge
// (matching the behavior the original 4-corner layout had).
type AnchorStyle = {
  position:  CSSProperties
  flexDir:   'column' | 'column-reverse'
  align:     'flex-start' | 'center' | 'flex-end'
}

const ANCHORS: Record<StandbyCorner, AnchorStyle> = {
  'top-left':      { position: { top: '1.5rem',    left:  '1.5rem' },                                       flexDir: 'column',         align: 'flex-start' },
  'top-center':    { position: { top: '1.5rem',    left:  '50%',    transform: 'translateX(-50%)' },        flexDir: 'column',         align: 'center'     },
  'top-right':     { position: { top: '1.5rem',    right: '1.5rem' },                                       flexDir: 'column',         align: 'flex-end'   },
  'left-center':   { position: { top: '50%',       left:  '1.5rem', transform: 'translateY(-50%)' },        flexDir: 'column',         align: 'flex-start' },
  'right-center':  { position: { top: '50%',       right: '1.5rem', transform: 'translateY(-50%)' },        flexDir: 'column',         align: 'flex-end'   },
  'bottom-left':   { position: { bottom: '1.5rem', left:  '1.5rem' },                                       flexDir: 'column-reverse', align: 'flex-start' },
  'bottom-center': { position: { bottom: '1.5rem', left:  '50%',    transform: 'translateX(-50%)' },        flexDir: 'column-reverse', align: 'center'     },
  'bottom-right':  { position: { bottom: '1.5rem', right: '1.5rem' },                                       flexDir: 'column-reverse', align: 'flex-end'   },
}

const ALL_CORNERS = Object.keys(ANCHORS) as StandbyCorner[]

// Minimum horizontal pixels to count as a swipe
const SWIPE_THRESHOLD = 50

// Wake-immunity window after the backlight goes OFF: taps within this window are
// swallowed instead of waking the screen. Covers the user's own verification
// tap (tapping the dark screen to check it really slept) and power-transition
// phantom touches from the capacitive panel reacting to the backlight cut.
// Nobody legitimately needs to wake within 8s of the screen going dark; a tap
// after the window works normally. Measured from the OFF moment ONLY — never
// refreshed by the swallowed taps themselves, so a jittery panel can't lock
// wake-out forever (the recovery tap from a dark screen must always eventually
// work).
const WAKE_IMMUNITY_MS = 8000

export default function StandbyOverlay() {
  const setMode        = useUIStore((s) => s.setMode)
  const backlightOffAt = useUIStore((s) => s.backlightOffAt)
  const slideshow     = useSettingsStore((s) => s.slideshow)
  const layout        = useSettingsStore((s) => s.standbyLayout)
  const exitGesture   = useSettingsStore((s) => s.standbyExitGesture)
  const photos        = usePhotos()

  // Ref to the slideshow so we can call next() / prev()
  const slideshowRef  = useRef<PhotoSlideshowHandle>(null)

  // Pointer tracking refs for swipe & tap detection
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastTapRef      = useRef<number>(0)
  // backlightOffAt value we've already logged an "ignored" warn for, so the
  // journal gets at most one line per immunity window (no per-tap spam).
  const warnedOffAtRef  = useRef<number | null>(null)

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

    // ── Wake-immunity: swallow taps for a moment after the backlight went off.
    // Fixed window from the OFF moment only — do nothing (no mode change, no
    // double-tap bookkeeping), so a swallowed tap can never refresh the window
    // or advance the double-tap timer.
    if (backlightOffAt != null && Date.now() - backlightOffAt < WAKE_IMMUNITY_MS) {
      if (warnedOffAtRef.current !== backlightOffAt) {
        warnedOffAtRef.current = backlightOffAt
        console.warn('[standby] wake tap ignored (immunity window)')
      }
      return
    }

    if (exitGesture === 'single-tap') {
      setMode('app', 'touch-wake')
    } else {
      // Double-tap
      const now   = Date.now()
      const delta = now - lastTapRef.current
      lastTapRef.current = now
      if (delta < 350 && delta > 0) {
        setMode('app', 'touch-wake')
      }
    }
  }

  // Merge in newer-element defaults for installs that pre-date these fields.
  // (electron-store keeps the first-run defaults forever; settings.service
  // changes don't retroactively update existing config.json files.)
  const safeLayout = {
    ...layout,
    water: layout.water ?? { corner: 'bottom-right' as StandbyCorner, enabled: true  },
    tesla: layout.tesla ?? { corner: 'bottom-left'  as StandbyCorner, enabled: false },
    priority: ((): StandbyElementId[] => {
      let p = layout.priority
      if (!p.includes('water')) p = [...p, 'water']
      if (!p.includes('tesla')) p = [...p, 'tesla']
      return p
    })(),
  }

  // Build element node map
  const elementNodes: Record<StandbyElementId, React.ReactNode> = {
    time:    safeLayout.time.enabled    ? <StandbyTime /> : null,
    weather: safeLayout.weather.enabled ? <StandbyWeather fields={safeLayout.weatherFields} /> : null,
    events:  safeLayout.events.enabled  ? <TodayEventsDrawer corner={safeLayout.events.corner} /> : null,
    water:   safeLayout.water.enabled   ? <StandbyWater /> : null,
    tesla:   safeLayout.tesla.enabled   ? <StandbyTesla /> : null,
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

      {/* Anchor groups — one absolute flex group per anchor (8 total: 4 corners + 4 mid-edges) */}
      {ALL_CORNERS.map((corner) => {
        const anchor = ANCHORS[corner]

        // Collect enabled elements for this anchor in priority order
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
              ...anchor.position,
              display: 'flex',
              flexDirection: anchor.flexDir,
              alignItems: anchor.align,
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
