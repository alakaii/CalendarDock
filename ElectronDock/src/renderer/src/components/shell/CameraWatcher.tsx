import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import { useMotionDetector } from '../../hooks/useMotionDetector'
import { isInDeepSleepNow } from '../../utils/deepSleep'

/** Low threshold used only for mode-switching sustain tracking (not for waking from standby) */
const ANY_MOTION_THRESHOLD = 0.03
const FPS = 4

// NOTE: the backlight is owned by DisplayPowerManager, not here. This component
// only runs the camera and drives the passive ↔ active dayMode. Night sleep
// must never depend on this feature, so it deliberately does not touch the
// screen power. See DisplayPowerManager for the full backlight state machine.

export default function CameraWatcher() {
  const mode             = useUIStore((s) => s.mode)
  const dayMode          = useUIStore((s) => s.dayMode)
  const setDayMode       = useUIStore((s) => s.setDayMode)
  const forceDeepSleep   = useUIStore((s) => s.forceDeepSleep)

  const enabled                    = useSettingsStore((s) => s.cameraWakeEnabled)
  const deepSleepStart             = useSettingsStore((s) => s.deepSleepStart)
  const deepSleepEnd               = useSettingsStore((s) => s.deepSleepEnd)
  const threshold                  = useSettingsStore((s) => s.cameraWakeThreshold)
  const pixelNoise                 = useSettingsStore((s) => s.cameraWakePixelNoise)
  const motionSustainSeconds       = useSettingsStore((s) => s.motionSustainSeconds)
  const activeHoldMinutes          = useSettingsStore((s) => s.activeHoldMinutes)

  // Tick every 60s so the deep-sleep window (which gates the camera) is
  // re-evaluated (e.g. 06:00 transition turns the camera back on).
  const [, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(iv)
  }, [])

  // The camera stays off inside the deep-sleep window and while the manual
  // "Deep Sleep Now" override is active. Backlight is handled elsewhere.
  const inDeepSleep = (enabled && isInDeepSleepNow(deepSleepStart, deepSleepEnd)) || forceDeepSleep

  // ── Pause downloads when user is actively using the app ──────────────────────
  useEffect(() => {
    window.api.photos.setPaused(mode === 'app').catch(() => {})
  }, [mode])

  // ── Dawn signal: deep sleep end → refresh Dropbox index + top up cache ───────
  const prevInDeepSleepRef = useRef(inDeepSleep)
  useEffect(() => {
    const wasInDeepSleep = prevInDeepSleepRef.current
    prevInDeepSleepRef.current = inDeepSleep
    // Trigger only on the true→false transition (deep sleep just ended = dawn)
    if (wasInDeepSleep && !inDeepSleep) {
      window.api.photos.wakeFromDeepSleep().catch(() => {})
    }
  }, [inDeepSleep])

  // ── Mutable refs (not triggering re-renders) ────────────────────────────────

  const holdTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sustainStartRef   = useRef<number | null>(null)

  // Keep latest values accessible inside stable callbacks
  const dayModeRef             = useRef(dayMode)
  dayModeRef.current           = dayMode
  const motionSustainRef       = useRef(motionSustainSeconds)
  motionSustainRef.current     = motionSustainSeconds
  const activeHoldRef          = useRef(activeHoldMinutes)
  activeHoldRef.current        = activeHoldMinutes
  const setDayModeRef          = useRef(setDayMode)
  setDayModeRef.current        = setDayMode

  // ── Cleanup timers on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [])

  // ── Hold timer — active → passive after inactivity ──────────────────────────

  const resetHoldTimer = useRef(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      setDayModeRef.current('passive')
    }, activeHoldRef.current * 60_000)
  }).current

  // Start hold timer when entering active; clear when returning to passive
  useEffect(() => {
    if (dayMode === 'active') {
      resetHoldTimer()
    } else {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
      sustainStartRef.current = null
    }
  }, [dayMode, resetHoldTimer])

  // ── Motion handlers ──────────────────────────────────────────────────────────

  // The camera's job is *just* dayMode switching (passive ↔ active) via
  // sustained motion in handleFrame below. It deliberately does NOT:
  //   - wake the screen from standby (touch handles that via StandbyOverlay)
  //   - keep the screen alive while in app mode (no synthetic pointermove)
  //
  // Earlier behavior dispatched a synthetic pointermove on every motion event,
  // which kept resetting useInactivityTimer and made standby effectively
  // never fire while a person was anywhere near the camera. The new contract:
  // touch / pointer / keyboard events are the only things that count as
  // "user activity" for the inactivity timer.
  //
  // The hook still requires an onMotion callback (to know when motion crossed
  // the user's wake threshold), so we keep this as a no-op for clarity.
  const handleMotion = () => { /* intentionally no-op */ }

  // onFrame: every frame's score is passed here for sustained-motion mode switching.
  // Uses refs so it never becomes stale inside the hook's optsRef.
  const handleFrame = (score: number) => {
    const isMoving = score > ANY_MOTION_THRESHOLD
    const dm       = dayModeRef.current

    if (dm === 'passive') {
      if (isMoving) {
        if (sustainStartRef.current === null) {
          sustainStartRef.current = Date.now()
        } else if (Date.now() - sustainStartRef.current >= motionSustainRef.current * 1_000) {
          sustainStartRef.current = null
          setDayModeRef.current('active')   // hold timer starts via useEffect above
        }
      } else {
        sustainStartRef.current = null
      }
    } else if (dm === 'active') {
      if (isMoving) {
        if (sustainStartRef.current === null) {
          sustainStartRef.current = Date.now()
        } else if (Date.now() - sustainStartRef.current >= motionSustainRef.current * 1_000) {
          sustainStartRef.current = null
          resetHoldTimer()  // reset the active → passive countdown
        }
      } else {
        sustainStartRef.current = null
      }
    }
  }

  useMotionDetector({
    enabled: enabled && !inDeepSleep,
    fps:     FPS,
    threshold,
    pixelNoise,
    onMotion: handleMotion,
    onFrame:  handleFrame,
  })

  return null
}
