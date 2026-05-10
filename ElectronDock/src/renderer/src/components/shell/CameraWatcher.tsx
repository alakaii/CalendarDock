import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import { useMotionDetector } from '../../hooks/useMotionDetector'

/** Low threshold used only for mode-switching sustain tracking (not for waking from standby) */
const ANY_MOTION_THRESHOLD = 0.03
const FPS = 4

/** Returns true if current time falls within the deep sleep window.
 *  Handles midnight-crossing windows (e.g. 21:00 → 06:00). */
function isInDeepSleepNow(start: string, end: string): boolean {
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = sh * 60 + sm
  const e = eh * 60 + em
  // Midnight-crossing window (e.g. 21:00–06:00): active when cur >= start OR cur < end
  if (s > e) return cur >= s || cur < e
  return cur >= s && cur < e
}

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
  const background                 = useSettingsStore((s) => s.cameraWakeBackground)
  const motionSustainSeconds       = useSettingsStore((s) => s.motionSustainSeconds)
  const activeHoldMinutes          = useSettingsStore((s) => s.activeHoldMinutes)
  const passiveBacklightOffMinutes = useSettingsStore((s) => s.passiveBacklightOffMinutes)

  // Tick every 60s so deep-sleep window is re-evaluated (e.g. 06:00 transition)
  const [, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(iv)
  }, [])

  // Effective "deep sleep" condition merges the time-of-day window with the
  // manual override (the Camera Wake "Deep Sleep" button). Either one makes
  // the backlight cut immediately on entering standby.
  const inDeepSleep = (enabled && isInDeepSleepNow(deepSleepStart, deepSleepEnd)) || forceDeepSleep
  const inStandby   = mode === 'standby'

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

  const backlightOffRef   = useRef(false)
  const backlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      if (backlightTimerRef.current) clearTimeout(backlightTimerRef.current)
      if (holdTimerRef.current)      clearTimeout(holdTimerRef.current)
    }
  }, [])

  // ── Backlight management ─────────────────────────────────────────────────────
  //
  // Deterministic timing — does NOT depend on the camera's dayMode tracking.
  // Once the kiosk enters standby (slideshow), the screen is going to sleep:
  //
  //   Inside deep sleep window + standby → backlight off immediately
  //   Outside deep sleep window + standby → backlight off after
  //                                         passiveBacklightOffMinutes
  //   App mode (any time)                 → backlight on, cancel pending timer
  //
  // Earlier behavior gated the delayed backlight-off on dayMode === 'passive',
  // which meant a recent motion event could keep the screen lit indefinitely
  // while in slideshow. The spec is now: standby always winds down.

  useEffect(() => {
    // Camera-wake off normally means we don't manage backlight at all. But
    // the manual "Deep Sleep" button still needs to drive setDisplayPower
    // even when camera-wake is otherwise disabled.
    if (!enabled && !forceDeepSleep) return

    if (inDeepSleep && inStandby) {
      // Immediate backlight off
      if (!backlightOffRef.current) {
        backlightOffRef.current = true
        window.api.system.setDisplayPower(false).catch(() => {})
      }
      return
    }

    if (!inDeepSleep && inStandby) {
      // Schedule delayed backlight off (skip if already scheduled or already off)
      if (!backlightTimerRef.current && !backlightOffRef.current) {
        backlightTimerRef.current = setTimeout(() => {
          backlightTimerRef.current = null
          if (!backlightOffRef.current) {
            backlightOffRef.current = true
            window.api.system.setDisplayPower(false).catch(() => {})
          }
        }, passiveBacklightOffMinutes * 60_000)
      }
      return
    }

    // App mode or camera wake disabled → restore backlight, cancel pending timer
    if (backlightTimerRef.current) {
      clearTimeout(backlightTimerRef.current)
      backlightTimerRef.current = null
    }
    if (backlightOffRef.current) {
      backlightOffRef.current = false
      window.api.system.setDisplayPower(true).catch(() => {})
    }
  }, [enabled, inDeepSleep, inStandby, passiveBacklightOffMinutes])

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
    background,
    threshold,
    pixelNoise,
    onMotion: handleMotion,
    onFrame:  handleFrame,
  })

  return null
}
