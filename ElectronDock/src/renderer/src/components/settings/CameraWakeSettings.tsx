import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { useUIStore } from '../../store/ui.slice'
import { FRAME_W, FRAME_H, FRAME_PX, seedBackground, scoreAndUpdate } from '../../hooks/useMotionDetector'

type WizardPhase =
  | 'idle'
  | 'countdown'
  | 'sampling'
  | 'complete'
  | 'testing'

// Calibration samples the empty room for this long at ~4 fps and records the
// worst-case coverage score produced by pure sensor/lighting jitter.
const SAMPLE_MS       = 8_000
const SAMPLE_INTERVAL = 250

// Threshold is set a fixed margin above the measured empty-room noise floor:
// high enough that ordinary jitter never crosses it, low enough that a person
// entering frame does. Also floored so a pathologically quiet camera can't set
// a hair-trigger threshold.
const NOISE_MARGIN  = 0.02
const MIN_THRESHOLD = 0.02

const round3 = (n: number) => Math.round(n * 1000) / 1000

export default function CameraWakeSettings() {
  const enabled                    = useSettingsStore((s) => s.cameraWakeEnabled)
  const deepSleepStart             = useSettingsStore((s) => s.deepSleepStart)
  const deepSleepEnd               = useSettingsStore((s) => s.deepSleepEnd)
  const threshold                  = useSettingsStore((s) => s.cameraWakeThreshold)
  const pixelNoise                 = useSettingsStore((s) => s.cameraWakePixelNoise)
  const background                 = useSettingsStore((s) => s.cameraWakeBackground)
  const passiveBacklightOffMinutes = useSettingsStore((s) => s.passiveBacklightOffMinutes)
  const motionSustainSeconds       = useSettingsStore((s) => s.motionSustainSeconds)
  const activeHoldMinutes          = useSettingsStore((s) => s.activeHoldMinutes)

  const setCameraWakeEnabled     = useSettingsStore((s) => s.setCameraWakeEnabled)
  const setDeepSleepSchedule     = useSettingsStore((s) => s.setDeepSleepSchedule)
  const setCameraWakeCalibration = useSettingsStore((s) => s.setCameraWakeCalibration)
  const setCameraWakeThreshold   = useSettingsStore((s) => s.setCameraWakeThreshold)
  const setPassiveDaySettings    = useSettingsStore((s) => s.setPassiveDaySettings)
  const setActiveDaySettings     = useSettingsStore((s) => s.setActiveDaySettings)

  const isCalibrated = background !== null

  // ── Wizard state ──────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<WizardPhase>('idle')
  const [countdown, setCountdown]     = useState(3)
  const [capProgress, setCapProgress] = useState(0)
  const [liveScore, setLiveScore]     = useState(0)
  const [peakScore, setPeakScore]     = useState(0)
  const [triggerCount, setTriggerCount] = useState(0)
  const [noiseFloor, setNoiseFloor]   = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Camera refs
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const activeRef   = useRef(false)
  // Adaptive-background buffers for the wizard's own detector runs. Kept in
  // refs so they survive re-renders inside the sampling / testing loops.
  const bgRef       = useRef<Float32Array | null>(null)
  const prevOverRef = useRef(false)

  // ── Camera helpers ─────────────────────────────────────────────────────────────

  const startCamera = useCallback(async (): Promise<boolean> => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      // NOTE: don't try to attach to videoRef here. startCamera runs while
      // phase is still 'idle', and the <video> element isn't rendered until
      // phase changes (showCamera gates it). The useEffect on showCamera
      // below picks this up after the next render.
      return true
    } catch (err) {
      // Surface the failure instead of swallowing it. The previous version
      // returned false silently; the wizard would bail without UI feedback,
      // leaving the user staring at an empty card with no countdown — which
      // is exactly how the "camera black, no countdown" symptom looked.
      console.error('[CameraWake] Camera access failed:', err)
      const e = err as Error
      let msg = e.message || 'Could not access the camera.'
      if (e.name === 'NotAllowedError' || /permission/i.test(msg)) {
        msg = 'Camera permission denied. The kiosk app needs camera access — restart the app once the next update is installed.'
      } else if (e.name === 'NotFoundError') {
        msg = 'No camera detected. Confirm the USB camera is plugged in.'
      } else if (e.name === 'NotReadableError') {
        msg = 'Camera is busy — another app is using it. Close other webcam apps and try again.'
      }
      setCameraError(msg)
      return false
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const ensureCanvas = useCallback(() => {
    if (!canvasRef.current) {
      const c = document.createElement('canvas')
      c.width  = FRAME_W
      c.height = FRAME_H
      canvasRef.current = c
    }
    return canvasRef.current
  }, [])

  const grabGray = useCallback((): Uint8Array | null => {
    const canvas = ensureCanvas()
    const video  = videoRef.current
    if (!video || video.readyState < 2) return null
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H)
    const rgba = ctx.getImageData(0, 0, FRAME_W, FRAME_H).data
    const gray = new Uint8Array(FRAME_PX)
    for (let i = 0; i < FRAME_PX; i++) {
      gray[i] = Math.round(0.299 * rgba[i*4] + 0.587 * rgba[i*4+1] + 0.114 * rgba[i*4+2])
    }
    return gray
  }, [ensureCanvas])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      activeRef.current = false
      stopCamera()
    }
  }, [stopCamera])

  // ── Phase: countdown ────────────────────────────────────────────────────────
  // Give the user a few seconds to leave the frame before we measure the
  // empty-room noise floor.

  useEffect(() => {
    if (phase !== 'countdown') return
    let count = 3
    setCountdown(3)
    const iv = setInterval(() => {
      count--
      if (count <= 0) { clearInterval(iv); setPhase('sampling') }
      else setCountdown(count)
    }, 1000)
    return () => clearInterval(iv)
  }, [phase])

  // ── Phase: sampling ─────────────────────────────────────────────────────────
  // Run the *adaptive* detector on the empty room, track the peak coverage
  // score (the noise floor), then set the threshold a margin above it and
  // store the settled background as the EMA seed for the live detector.

  useEffect(() => {
    if (phase !== 'sampling') return
    activeRef.current = true
    setCapProgress(0)
    bgRef.current = null
    let maxScore = 0
    let elapsed  = 0
    const iv = setInterval(() => {
      if (!activeRef.current) { clearInterval(iv); return }
      const gray = grabGray()
      if (gray) {
        if (!bgRef.current) bgRef.current = seedBackground(gray)
        const s = scoreAndUpdate(gray, bgRef.current, pixelNoise)
        if (s > maxScore) maxScore = s
      }
      elapsed += SAMPLE_INTERVAL
      setCapProgress(Math.min(100, Math.round((elapsed / SAMPLE_MS) * 100)))
      if (elapsed >= SAMPLE_MS) {
        clearInterval(iv)
        const bg = bgRef.current
        if (!bg) {
          setCameraError('Could not read frames from the camera during calibration. Try again.')
          stopCamera()
          setPhase('idle')
          return
        }
        const newThreshold = Math.max(MIN_THRESHOLD, round3(maxScore + NOISE_MARGIN))
        const seed = Array.from(bg, (v) => Math.round(v))
        setNoiseFloor(maxScore)
        setCameraWakeCalibration(seed, newThreshold)
        stopCamera()
        setPhase('complete')
      }
    }, SAMPLE_INTERVAL)
    return () => clearInterval(iv)
  }, [phase, grabGray, pixelNoise, setCameraWakeCalibration, stopCamera])

  // ── Phase: testing ──────────────────────────────────────────────────────────
  // Live adaptive-background scoring so the user can wave (score spikes) and
  // stand still (score settles back to ~0). "Triggers" counts rising-edge
  // threshold crossings — with a static scene it must stay at 0.

  useEffect(() => {
    if (phase !== 'testing') return
    activeRef.current = true
    bgRef.current = null
    prevOverRef.current = false
    setPeakScore(0)
    setTriggerCount(0)
    setLiveScore(0)
    const iv = setInterval(() => {
      const gray = grabGray()
      if (!gray) return
      if (!bgRef.current) bgRef.current = seedBackground(gray, background)
      const s = scoreAndUpdate(gray, bgRef.current, pixelNoise)
      setLiveScore(s)
      setPeakScore((p) => (s > p ? s : p))
      const over = s > threshold
      if (over && !prevOverRef.current) setTriggerCount((c) => c + 1)
      prevOverRef.current = over
    }, SAMPLE_INTERVAL)
    return () => clearInterval(iv)
  }, [phase, grabGray, pixelNoise, threshold, background])

  // ── Wizard actions ─────────────────────────────────────────────────────────────

  const startWizard = async () => {
    const ok = await startCamera()
    if (!ok) return
    bgRef.current = null
    activeRef.current = true
    setPhase('countdown')
  }

  const cancelWizard = () => {
    activeRef.current = false
    stopCamera()
    bgRef.current = null
    setPhase('idle')
  }

  const startTest = async () => {
    const ok = await startCamera()
    if (!ok) return
    bgRef.current = null
    activeRef.current = true
    setPhase('testing')
  }

  const stopTest = () => {
    activeRef.current = false
    stopCamera()
    bgRef.current = null
    prevOverRef.current = false
    setPhase('idle')
  }

  // ── Styles ─────────────────────────────────────────────────────────────────────

  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  }

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '0.75rem',
    padding: '1rem',
  }

  // ── Score bar ───────────────────────────────────────────────────────────────────

  const ScoreBar = ({ score, thresh, label }: { score: number; thresh: number; label: string }) => {
    const pct     = Math.min(100, score * 400)
    const passing = score > thresh
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span>{label}</span>
          <span>{(score * 100).toFixed(1)}%{thresh > 0 ? ` / threshold ${(thresh * 100).toFixed(1)}%` : ''}</span>
        </div>
        <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'var(--input-bg)' }}>
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{ width: `${pct}%`, background: passing ? '#22c55e' : '#3b82f6' }}
          />
          {thresh > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5"
              style={{ left: `${Math.min(100, thresh * 400)}%`, background: '#f59e0b' }}
            />
          )}
        </div>
      </div>
    )
  }

  const showCamera = ['countdown', 'sampling', 'testing'].includes(phase)

  // Attach the stream to the <video> element after it mounts. We can't do this
  // inside startCamera() because at that moment phase is still 'idle' and the
  // element isn't rendered yet — videoRef is null. Once showCamera flips true
  // and React mounts the video, this effect runs and wires up the source.
  useEffect(() => {
    const v = videoRef.current
    const s = streamRef.current
    if (!showCamera || !v || !s) return
    if (v.srcObject === s) return
    v.srcObject = s
    v.play().catch((err) => {
      console.warn('[CameraWake] video.play() failed:', err)
      setCameraError('Camera stream attached but the video element could not start playing. Try toggling Camera Wake off and on.')
    })
  }, [showCamera])

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-xl">
      {/* Full-window border overlay while in test mode */}
      {phase === 'testing' && (
        <>
          <style>{`
            @keyframes camTestPulse {
              0%, 100% { box-shadow: inset 0 0 0 8px rgba(59,130,246,0.95), inset 0 0 50px rgba(59,130,246,0.40); }
              50%      { box-shadow: inset 0 0 0 8px rgba(59,130,246,0.55), inset 0 0 30px rgba(59,130,246,0.20); }
            }
          `}</style>
          <div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 200, animation: 'camTestPulse 1.6s ease-in-out infinite' }}
          />
        </>
      )}

      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Camera Wake</h2>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Uses a USB camera to detect presence and automatically manage screen and standby behaviour.
        All detection runs locally — no cloud processing.
      </p>

      {/* ── Master toggle ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p style={labelStyle}>Enable</p>
        <div className="flex gap-2">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              onClick={() => setCameraWakeEnabled(v)}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px]"
              style={{
                background: enabled === v ? '#3b82f6' : 'var(--card-bg)',
                border: `1px solid ${enabled === v ? '#3b82f6' : 'var(--card-border)'}`,
                color: enabled === v ? '#fff' : 'var(--text-primary)',
              }}
            >
              {v ? 'Enabled' : 'Disabled'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Deep Sleep ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p style={labelStyle}>Deep Sleep</p>
        <div style={cardStyle} className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Camera and screen off. Touch anywhere to wake. Ideal for overnight hours.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Starts at</p>
              <input
                type="time"
                value={deepSleepStart}
                onChange={(e) => setDeepSleepSchedule(e.target.value, deepSleepEnd)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none min-h-[44px]"
                style={inputStyle}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ends at</p>
              <input
                type="time"
                value={deepSleepEnd}
                onChange={(e) => setDeepSleepSchedule(deepSleepStart, e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none min-h-[44px]"
                style={inputStyle}
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Supports overnight windows (e.g. 21:00 → 06:00 crossing midnight).
          </p>

          {/* Manual sleep buttons. Both auto-clear on touch wake. */}
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => {
                // Standby only — slideshow plays, backlight follows the
                // normal passiveBacklightOffMinutes timer (or immediate
                // if the deep-sleep window happens to be active right now).
                useUIStore.getState().setMode('standby', 'sleep-button')
              }}
              className="w-full px-5 py-3 rounded-xl font-semibold text-sm min-h-[48px] transition-colors"
              style={{ background: '#3b82f6', color: '#fff' }}
              title="Drop into slideshow. Backlight stays on until the normal sleep timer fires."
            >
              Sleep now
            </button>
            <button
              onClick={() => {
                // Standby + force backlight off immediately, regardless of
                // the deep-sleep schedule. Equivalent to being inside the
                // deep-sleep window for one cycle.
                useUIStore.getState().setForceDeepSleep(true)
                useUIStore.getState().setMode('standby', 'deep-sleep-button')
              }}
              className="w-full px-5 py-3 rounded-xl font-semibold text-sm min-h-[48px] transition-colors"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
              title="Slideshow + backlight off immediately. Touch screen to wake."
            >
              Deep Sleep Now
            </button>
          </div>
        </div>
      </div>

      {/* ── Passive Day ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p style={labelStyle}>Passive Day</p>
        <div style={cardStyle} className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Default daytime mode. While in standby the slideshow stays lit as long as the room is
            occupied; once it goes empty the screen turns off after the delay below.
            Switches to Active Day after sustained motion.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Turn screen off after room empty for (minutes)</p>
              <input
                type="number"
                min={1}
                max={120}
                value={passiveBacklightOffMinutes}
                onChange={(e) => setPassiveDaySettings(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none min-h-[44px]"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Day ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p style={labelStyle}>Active Day</p>
        <div style={cardStyle} className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Triggered automatically when continuous motion is detected for several seconds.
            The screen stays lit while the room is occupied. Returns to Passive Day after a period without sustained motion.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Return to Passive after (minutes)</p>
              <input
                type="number"
                min={1}
                max={120}
                value={activeHoldMinutes}
                onChange={(e) => setActiveDaySettings(motionSustainSeconds, Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none min-h-[44px]"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Trigger: sustained motion for (seconds)
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={2}
                max={15}
                step={1}
                value={motionSustainSeconds}
                onChange={(e) => setActiveDaySettings(Number(e.target.value), activeHoldMinutes)}
                className="flex-1 accent-blue-500"
              />
              <span className="text-sm font-semibold tabular-nums w-12 text-right" style={{ color: 'var(--text-primary)' }}>
                {motionSustainSeconds}s
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              A quick walk-past won't trigger — only sustained presence (e.g. cooking, working nearby).
            </p>
          </div>
        </div>
      </div>

      {/* ── Camera preview (shown during wizard) ─────────────────────────────── */}
      {showCamera && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--card-border)', background: '#000' }}
        >
          <video
            ref={videoRef}
            className="w-full"
            style={{ maxHeight: 240, objectFit: 'cover', display: 'block' }}
            muted
            playsInline
          />
        </div>
      )}

      {/* ── Calibration ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p style={labelStyle}>Calibration</p>
          {isCalibrated && phase === 'idle' && (
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#22c55e' }}>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Calibrated
            </span>
          )}
          {!isCalibrated && phase === 'idle' && (
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#f59e0b' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
              Not calibrated
            </span>
          )}
        </div>

        {/* IDLE */}
        {phase === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isCalibrated
                ? 'Calibration measures the empty-room noise floor and sets the wake threshold just above it. Re-run it if the camera moves or the room changes, or test detection below.'
                : 'One quick recording of the empty room measures background noise and sets the wake threshold just above it. Detection adapts to lighting changes on its own — no need to re-calibrate for sun or lamps.'}
            </p>
            {cameraError && (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
              >
                {cameraError}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={startWizard}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
                style={{ background: '#3b82f6', color: '#fff' }}
              >
                {isCalibrated ? 'Re-calibrate' : 'Calibrate empty room'}
              </button>
              <button
                onClick={startTest}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
              >
                Test detection
              </button>
            </div>
          </div>
        )}

        {/* TESTING */}
        {phase === 'testing' && (
          <div className="space-y-3">
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: 'var(--card-bg)', border: '2px solid #3b82f6' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
                <p className="text-sm font-semibold" style={{ color: '#3b82f6' }}>Detection test</p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Wave and the score spikes; stand still and it settles back toward zero as the scene
                blends into the adaptive background. With an empty, static room "Triggers" stays at 0.
                The blue border marks test mode — wake actions are not triggered.
              </p>

              <ScoreBar score={liveScore} thresh={threshold} label="Live motion score" />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Triggers</p>
                  <p
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: triggerCount > 0 ? '#22c55e' : 'var(--text-primary)' }}
                  >
                    {triggerCount}
                  </p>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Peak score</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {(peakScore * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={stopTest}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
              style={{ background: '#ef4444', color: '#fff' }}
            >
              Stop test
            </button>
          </div>
        )}

        {/* COUNTDOWN */}
        {phase === 'countdown' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 text-center space-y-2" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Empty Room</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Step out of frame! Measuring the empty room in…</p>
              <p className="text-6xl font-bold tabular-nums" style={{ color: '#3b82f6' }}>{countdown}</p>
            </div>
            <button onClick={cancelWizard} className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        )}

        {/* SAMPLING */}
        {phase === 'sampling' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Measuring empty-room noise…</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>Stay out of frame</span>
                  <span>{capProgress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--input-bg)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${capProgress}%`, background: '#3b82f6' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COMPLETE */}
        {phase === 'complete' && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>✓ Calibration complete</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Empty-room noise floor measured at {(noiseFloor * 100).toFixed(1)}%. Wake threshold set to {(threshold * 100).toFixed(1)}%.
              Use the slider below to fine-tune.
            </p>
            <button onClick={() => setPhase('idle')} className="text-xs font-medium mt-1" style={{ color: '#3b82f6' }}>
              Done →
            </button>
          </div>
        )}
      </div>

      {/* ── Sensitivity slider ────────────────────────────────────────────────── */}
      {isCalibrated && phase === 'idle' && (
        <div className="space-y-3">
          <p style={labelStyle}>Wake Sensitivity</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span>Less sensitive (closer)</span>
              <span>More sensitive (farther)</span>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.45}
              step={0.005}
              value={threshold}
              onChange={(e) => setCameraWakeThreshold(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              Current threshold: {(threshold * 100).toFixed(1)}%
            </p>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Lower = wakes from farther away. Higher = must be closer before waking.
          </p>
        </div>
      )}
    </div>
  )
}
