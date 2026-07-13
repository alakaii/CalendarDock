import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import { isInDeepSleepNow } from '../../utils/deepSleep'

/**
 * Owns the kiosk backlight. Deliberately independent of the Camera Wake
 * feature toggle: night sleep (the deep-sleep window) must cut the backlight
 * whether or not the camera is enabled. Previously the entire backlight path
 * lived inside CameraWatcher and early-returned when cameraWakeEnabled was
 * false, so with the camera off the screen stayed lit 24/7.
 *
 * Backlight state machine (only ever acts while in standby):
 *
 *   mode    │ window │ camera │ occupied │ backlight
 *   ────────┼────────┼────────┼──────────┼───────────────────────────────
 *   app     │  any   │  any   │   any    │ ON  (cancel pending off)
 *   standby │  yes   │  any   │   any    │ OFF immediately (night sleep)
 *   standby │  no    │  on    │  active  │ ON
 *   standby │  no    │  on    │  passive │ OFF after passiveBacklightOffMinutes
 *   standby │  no    │  off   │   n/a    │ OFF after passiveBacklightOffMinutes
 *
 * forceDeepSleep (the "Deep Sleep Now" button) behaves like being inside the
 * window for one cycle. Turning the screen back on from occupancy keeps the
 * app in standby — this component never dispatches input, never changes mode,
 * and never touches the inactivity timer. It DOES release forceDeepSleep when
 * the scheduled window exits (see the transition effect below): touch is dead
 * while dark, so the window boundary is a guaranteed escape from a stuck
 * override.
 */
export default function DisplayPowerManager() {
  const mode              = useUIStore((s) => s.mode)
  const dayMode           = useUIStore((s) => s.dayMode)
  const forceDeepSleep    = useUIStore((s) => s.forceDeepSleep)
  const setForceDeepSleep = useUIStore((s) => s.setForceDeepSleep)
  const setBacklightOffAt = useUIStore((s) => s.setBacklightOffAt)

  const cameraEnabled              = useSettingsStore((s) => s.cameraWakeEnabled)
  const deepSleepStart             = useSettingsStore((s) => s.deepSleepStart)
  const deepSleepEnd               = useSettingsStore((s) => s.deepSleepEnd)
  const passiveBacklightOffMinutes = useSettingsStore((s) => s.passiveBacklightOffMinutes)

  // Re-evaluate the time-of-day window every 60s (e.g. 21:00 / 06:00 crossings),
  // so crossing into the window while already sitting in standby cuts the screen.
  const [, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(iv)
  }, [])

  const inWindow  = isInDeepSleepNow(deepSleepStart, deepSleepEnd)
  const deepSleep = inWindow || forceDeepSleep
  const inStandby = mode === 'standby'
  const occupied  = dayMode === 'active'

  // ── Log deep-sleep window transitions ────────────────────────────────────
  const prevWindowRef = useRef(inWindow)
  useEffect(() => {
    if (inWindow !== prevWindowRef.current) {
      prevWindowRef.current = inWindow
      console.warn(`[backlight] deep-sleep window ${inWindow ? 'enter' : 'exit'} (${deepSleepStart}-${deepSleepEnd})`)
      // Escape hatch: leaving the scheduled window releases a manual
      // "Deep Sleep Now" override too. Otherwise a button press before the
      // window (touch dead while dark, camera the only other wake path) could
      // leave the kiosk stuck dark past the window end. setForceDeepSleep logs
      // the single '(cause: window-exit)' clear line.
      if (!inWindow && forceDeepSleep) {
        setForceDeepSleep(false, 'window-exit')
      }
    }
  }, [inWindow, deepSleepStart, deepSleepEnd, forceDeepSleep, setForceDeepSleep])

  // ── Backlight state machine ──────────────────────────────────────────────
  // Starts pessimistic (off) so the first app-mode pass always issues an
  // explicit "on" — syncs real panel state if the app restarted while dark.
  const backlightOffRef   = useRef(true)
  const backlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelTimer = (): void => {
    if (backlightTimerRef.current) {
      clearTimeout(backlightTimerRef.current)
      backlightTimerRef.current = null
    }
  }

  const setBacklight = (on: boolean, cause: string): void => {
    if (backlightOffRef.current === !on) return // already in target state
    backlightOffRef.current = !on
    console.warn(`[backlight] request ${on ? 'on' : 'off'} (cause: ${cause})`)
    // Record when the backlight goes dark (and clear on turn-on) so the standby
    // wake path can enforce a wake-immunity window right after off.
    setBacklightOffAt(on ? null : Date.now())
    window.api.system.setDisplayPower(on).catch(() => {})
  }

  useEffect(() => {
    // App mode → screen on, cancel any pending off.
    if (!inStandby) {
      cancelTimer()
      setBacklight(true, 'app-mode')
      return
    }
    // Standby + deep sleep (window or forced) → off now.
    if (deepSleep) {
      cancelTimer()
      setBacklight(false, forceDeepSleep && !inWindow ? 'force-deep-sleep' : 'deep-sleep-window')
      return
    }
    // Standby, daytime, camera reports room occupied → keep the screen on.
    if (cameraEnabled && occupied) {
      cancelTimer()
      setBacklight(true, 'occupancy-active')
      return
    }
    // Standby, daytime, room empty (or camera off) → delayed off.
    if (!backlightTimerRef.current && !backlightOffRef.current) {
      backlightTimerRef.current = setTimeout(() => {
        backlightTimerRef.current = null
        setBacklight(false, 'passive-timeout')
      }, passiveBacklightOffMinutes * 60_000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStandby, deepSleep, inWindow, forceDeepSleep, cameraEnabled, occupied, passiveBacklightOffMinutes])

  // Cleanup on unmount
  useEffect(() => () => cancelTimer(), [])

  return null
}
