import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import { useMotionDetector } from '../../hooks/useMotionDetector'
import { isInDeepSleepNow } from '../../utils/deepSleep'

/** Low threshold used only for mode-switching sustain tracking (not for waking from standby) */
const ANY_MOTION_THRESHOLD = 0.03
const FPS = 4

/**
 * Grace period after "Deep Sleep Now" is pressed during which sustained motion
 * will NOT clear the override. The presser is standing right in front of the
 * camera when they tap the button; without this window their own lingering
 * presence would trip passive→active and instantly undo the press.
 */
const PRESS_IMMUNITY_MS = 5 * 60_000

// NOTE: the backlight is owned by DisplayPowerManager, not here. This component
// only runs the camera and drives the passive ↔ active dayMode. Night sleep
// must never depend on this feature, so it deliberately does not touch the
// screen power. See DisplayPowerManager for the full backlight state machine.

export default function CameraWatcher() {
  const mode             = useUIStore((s) => s.mode)
  const dayMode          = useUIStore((s) => s.dayMode)
  const setDayMode          = useUIStore((s) => s.setDayMode)
  const forceDeepSleep      = useUIStore((s) => s.forceDeepSleep)
  const forceDeepSleepSetAt = useUIStore((s) => s.forceDeepSleepSetAt)
  const setForceDeepSleep   = useUIStore((s) => s.setForceDeepSleep)

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

  // The camera stays off ONLY inside the *scheduled* deep-sleep window. The
  // manual "Deep Sleep Now" override deliberately does NOT gate it: outside the
  // window the camera is the only wake sensor (touch is dead while the panel is
  // dark), so it must keep running to detect a return and release the override
  // (see handleFrame). Backlight is handled elsewhere.
  const inScheduledDeepSleep = enabled && isInDeepSleepNow(deepSleepStart, deepSleepEnd)

  // ── Pause downloads when user is actively using the app ──────────────────────
  useEffect(() => {
    window.api.photos.setPaused(mode === 'app').catch(() => {})
  }, [mode])

  // ── Dawn signal: deep sleep end → refresh Dropbox index + top up cache ───────
  // Keyed on the scheduled window (not the manual override) — dawn is a clock
  // event, so a daytime button press/clear must never masquerade as it.
  const prevScheduledDeepSleepRef = useRef(inScheduledDeepSleep)
  useEffect(() => {
    const wasInScheduledDeepSleep = prevScheduledDeepSleepRef.current
    prevScheduledDeepSleepRef.current = inScheduledDeepSleep
    // Trigger only on the true→false transition (deep sleep just ended = dawn)
    if (wasInScheduledDeepSleep && !inScheduledDeepSleep) {
      window.api.photos.wakeFromDeepSleep().catch(() => {})
    }
  }, [inScheduledDeepSleep])

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
  const forceDeepSleepRef      = useRef(forceDeepSleep)
  forceDeepSleepRef.current    = forceDeepSleep
  const forceDeepSleepSetAtRef = useRef(forceDeepSleepSetAt)
  forceDeepSleepSetAtRef.current = forceDeepSleepSetAt
  const setForceDeepSleepRef   = useRef(setForceDeepSleep)
  setForceDeepSleepRef.current = setForceDeepSleep
  const deepSleepStartRef      = useRef(deepSleepStart)
  deepSleepStartRef.current    = deepSleepStart
  const deepSleepEndRef        = useRef(deepSleepEnd)
  deepSleepEndRef.current      = deepSleepEnd

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

          // Motion escape from a daytime forced deep sleep. The passive→active
          // transition means someone sustained-moved after the room had gone
          // empty (dayMode only sits at passive again once activeHoldMinutes of
          // stillness elapsed), i.e. a genuine re-entry — so release the
          // override and let DisplayPowerManager's occupancy branch relight the
          // standby slideshow on its own. Guards:
          //   - only outside the scheduled window (inside it the schedule owns
          //     sleep and the camera is off anyway)
          //   - only past PRESS_IMMUNITY_MS so the presser's own lingering
          //     presence at press time can't instantly undo the button.
          //
          // Net semantics: press the button while you're in the room → screen
          // stays dark as long as you stay (dayMode holds active, no
          // transition). Leave (dayMode → passive after activeHoldMinutes) and
          // return later → this passive→active clears the flag and relights. At
          // 21:00 the scheduled window takes over regardless; at 06:00 window
          // exit (DisplayPowerManager) is the guaranteed escape.
          if (
            forceDeepSleepRef.current &&
            forceDeepSleepSetAtRef.current !== null &&
            !isInDeepSleepNow(deepSleepStartRef.current, deepSleepEndRef.current) &&
            Date.now() - forceDeepSleepSetAtRef.current > PRESS_IMMUNITY_MS
          ) {
            setForceDeepSleepRef.current(false, 'motion')
          }
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
    enabled: enabled && !inScheduledDeepSleep,
    fps:     FPS,
    threshold,
    pixelNoise,
    onMotion: handleMotion,
    onFrame:  handleFrame,
  })

  return null
}
