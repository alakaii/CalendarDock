import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { FRAME_W, FRAME_H, FRAME_PX } from '../../hooks/useMotionDetector'

type WizardPhase =
  | 'idle'
  | 'countdown-background'
  | 'capturing-background'
  | 'countdown-trigger'
  | 'reading-trigger'
  | 'complete'
  | 'testing'

const DEFAULT_PIXEL_NOISE = 20

export default function CameraWakeSettings() {
  const enabled                    = useSettingsStore((s) => s.cameraWakeEnabled)
  const deepSleepStart             = useSettingsStore((s) => s.deepSleepStart)
  const deepSleepEnd               = useSettingsStore((s) => s.deepSleepEnd)
  const threshold                  = useSettingsStore((s) => s.cameraWakeThreshold)
  const background                 = useSettingsStore((s) => s.cameraWakeBackground)
  const passiveStandbyMinutes      = useSettingsStore((s) => s.passiveStandbyMinutes)
  const passiveBacklightOffMinutes = useSettingsStore((s) => s.passiveBacklightOffMinutes)
  const activeStandbyMinutes       = useSettingsStore((s) => s.activeStandbyMinutes)
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
  const [phase, setPhase]               = useState<WizardPhase>('idle')
  const [countdown, setCountdown]       = useState(3)
  const [capProgress, setCapProgress]   = useState(0)
  const [liveScore, setLiveScore]       = useState(0)
  const [peakScore, setPeakScore]       = useState(0)
  const [sustainedSec, setSustainedSec] = useState(0)
  const [cameraError, setCameraError]   = useState<string | null>(null)
  const motionStartTsRef                = useRef<number | null>(null)

  // Camera refs
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const tempBgRef   = useRef<number[] | null>(null)
  const activeRef   = useRef(false)

  // ── Camera helpers ─────────────────────────────────────────────────────────────

  const startCamera = useCallback(async (): Promise<boolean> => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
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

  const computeScore = useCallback((): number => {
    const gray = grabGray()
    const bg   = tempBgRef.current
    if (!gray || !bg) return 0
    let changed = 0
    for (let i = 0; i < FRAME_PX; i++) {
      if (Math.abs(gray[i] - bg[i]) > DEFAULT_PIXEL_NOISE) changed++
    }
    return changed / FRAME_PX
  }, [grabGray])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      activeRef.current = false
      stopCamera()
    }
  }, [stopCamera])

  // ── Phase: countdown-background ─────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown-background') return
    let count = 3
    setCountdown(3)
    const iv = setInterval(() => {
      count--
      if (count <= 0) { clearInterval(iv); setPhase('capturing-background') }
      else setCountdown(count)
    }, 1000)
    return () => clearInterval(iv)
  }, [phase])

  // ── Phase: capturing-background ─────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'capturing-background') return
    activeRef.current = true
    setCapProgress(0)
    const FRAMES = 30
    const sums   = new Float32Array(FRAME_PX)
    let captured = 0
    const captureNext = () => {
      if (!activeRef.current) return
      const gray = grabGray()
      if (gray) {
        for (let i = 0; i < FRAME_PX; i++) sums[i] += gray[i]
        captured++
        setCapProgress(Math.round((captured / FRAMES) * 100))
      }
      if (captured >= FRAMES) {
        const bg = Array.from(sums.map((s) => Math.round(s / FRAMES)))
        tempBgRef.current = bg
        setPhase('countdown-trigger')
      } else {
        setTimeout(captureNext, 100)
      }
    }
    setTimeout(captureNext, 100)
  }, [phase, grabGray])

  // ── Phase: countdown-trigger ────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown-trigger') return
    let count = 3
    setCountdown(3)
    const iv = setInterval(() => {
      count--
      if (count <= 0) { clearInterval(iv); setPhase('reading-trigger') }
      else setCountdown(count)
    }, 1000)
    return () => clearInterval(iv)
  }, [phase])

  // ── Phase: reading-trigger ───────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'reading-trigger') return
    activeRef.current = true
    const iv = setInterval(() => {
      const s = computeScore()
      setLiveScore(s)
    }, 250)
    return () => clearInterval(iv)
  }, [phase, computeScore])

  // ── Phase: testing ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'testing') return
    activeRef.current = true
    motionStartTsRef.current = null
    setPeakScore(0)
    setSustainedSec(0)
    const iv = setInterval(() => {
      const s = computeScore()
      setLiveScore(s)
      setPeakScore((p) => (s > p ? s : p))
      if (s > threshold) {
        if (motionStartTsRef.current === null) motionStartTsRef.current = Date.now()
        setSustainedSec((Date.now() - motionStartTsRef.current) / 1000)
      } else if (motionStartTsRef.current !== null) {
        motionStartTsRef.current = null
        setSustainedSec(0)
      }
    }, 200)
    return () => clearInterval(iv)
  }, [phase, computeScore, threshold])

  // ── Wizard actions ─────────────────────────────────────────────────────────────

  const startWizard = async () => {
    const ok = await startCamera()
    if (!ok) return
    tempBgRef.current = null
    activeRef.current = true
    setPhase('countdown-background')
  }

  const cancelWizard = () => {
    activeRef.current = false
    stopCamera()
    tempBgRef.current = null
    setPhase('idle')
  }

  const confirmDistance = () => {
    const bg  = tempBgRef.current
    const raw = liveScore
    if (!bg || raw <= 0) return
    const newThreshold = Math.max(0.02, raw * 0.8)
    setCameraWakeCalibration(bg, newThreshold)
    stopCamera()
    setPhase('complete')
  }

  const startTest = async () => {
    if (!background) return
    const ok = await startCamera()
    if (!ok) return
    tempBgRef.current = background
    activeRef.current = true
    setPhase('testing')
  }

  const stopTest = () => {
    activeRef.current = false
    stopCamera()
    tempBgRef.current = null
    motionStartTsRef.current = null
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

  const showCamera = ['countdown-background', 'capturing-background', 'countdown-trigger', 'reading-trigger', 'testing'].includes(phase)

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
        </div>
      </div>

      {/* ── Passive Day ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p style={labelStyle}>Passive Day</p>
        <div style={cardStyle} className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Default daytime mode. Camera on, short standby, backlight cuts after a longer idle period.
            Switches to Active Day after sustained motion.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Standby after (minutes)</p>
              <input
                type="number"
                min={1}
                max={60}
                value={passiveStandbyMinutes}
                onChange={(e) => setPassiveDaySettings(Number(e.target.value), passiveBacklightOffMinutes)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none min-h-[44px]"
                style={inputStyle}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Backlight off after (minutes in standby)</p>
              <input
                type="number"
                min={1}
                max={120}
                value={passiveBacklightOffMinutes}
                onChange={(e) => setPassiveDaySettings(passiveStandbyMinutes, Number(e.target.value))}
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
            Longer standby and backlight stays on. Returns to Passive Day after a period without sustained motion.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Standby after (minutes)</p>
              <input
                type="number"
                min={1}
                max={120}
                value={activeStandbyMinutes}
                onChange={(e) => setActiveDaySettings(Number(e.target.value), motionSustainSeconds, activeHoldMinutes)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none min-h-[44px]"
                style={inputStyle}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Return to Passive after (minutes)</p>
              <input
                type="number"
                min={1}
                max={120}
                value={activeHoldMinutes}
                onChange={(e) => setActiveDaySettings(activeStandbyMinutes, motionSustainSeconds, Number(e.target.value))}
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
                onChange={(e) => setActiveDaySettings(activeStandbyMinutes, Number(e.target.value), activeHoldMinutes)}
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

      {/* ── Calibration wizard ───────────────────────────────────────────────── */}
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
                ? 'Calibration complete. Test detection at different distances or re-calibrate.'
                : 'Two quick recordings: empty room, then stand at your desired trigger distance.'}
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
                {isCalibrated ? 'Re-calibrate' : 'Start Calibration'}
              </button>
              {isCalibrated && (
                <button
                  onClick={startTest}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                >
                  Test detection
                </button>
              )}
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
                Move around at different distances to see what registers. The blue border around the
                screen marks test mode — wake actions are not triggered.
              </p>

              <ScoreBar score={liveScore} thresh={threshold} label="Live motion score" />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sustained motion</p>
                  <p
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: motionStartTsRef.current !== null ? '#22c55e' : 'var(--text-primary)' }}
                  >
                    {sustainedSec.toFixed(1)}s
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

        {/* COUNTDOWN BACKGROUND */}
        {phase === 'countdown-background' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 text-center space-y-2" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Step 1 of 2 — Empty Room</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Step out of frame! Recording background in…</p>
              <p className="text-6xl font-bold tabular-nums" style={{ color: '#3b82f6' }}>{countdown}</p>
            </div>
            <button onClick={cancelWizard} className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        )}

        {/* CAPTURING BACKGROUND */}
        {phase === 'capturing-background' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Step 1 of 2 — Recording background…</p>
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

        {/* COUNTDOWN TRIGGER */}
        {phase === 'countdown-trigger' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 text-center space-y-2" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Step 2 of 2 — Trigger Distance</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Walk to where you want the screen to wake up. Starting in…</p>
              <p className="text-6xl font-bold tabular-nums" style={{ color: '#3b82f6' }}>{countdown}</p>
            </div>
            <button onClick={cancelWizard} className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        )}

        {/* READING TRIGGER */}
        {phase === 'reading-trigger' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Step 2 of 2 — Stand at your trigger distance</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Stay still at the spot where you want the screen to wake. Tap "Use This" when the bar is steady.
              </p>
              <ScoreBar score={liveScore} thresh={0} label="Motion score" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmDistance}
                disabled={liveScore < 0.01}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px] transition-opacity disabled:opacity-30"
                style={{ background: '#22c55e', color: '#fff' }}
              >
                Use This Distance
              </button>
              <button
                onClick={cancelWizard}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm min-h-[44px]"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
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
              Trigger threshold set to {(threshold * 100).toFixed(1)}%. Use the slider below to fine-tune.
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
