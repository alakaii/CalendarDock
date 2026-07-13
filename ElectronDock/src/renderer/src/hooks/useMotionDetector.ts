import { useEffect, useRef, useCallback } from 'react'

export const FRAME_W  = 160
export const FRAME_H  = 120
export const FRAME_PX = FRAME_W * FRAME_H   // 19,200

// Exponential-moving-average smoothing factor for the adaptive background.
// Frames are processed at ~4 fps, so the background's time constant is
// τ = 1/(BG_ALPHA·fps). At 0.008 that's ≈ 31 s: a *lasting* scene change
// (sun angle, auto-exposure, lighting drift) is folded into the reference
// over roughly 30–60 s and stops registering as motion, while a person
// moving through frame still spikes the score long before they blend in.
// Anything much larger (e.g. 0.02 ≈ 12 s) absorbs real motion too quickly;
// much smaller drifts back toward the old static-reference failure mode.
export const BG_ALPHA = 0.008

export interface MotionDetectorOptions {
  enabled:    boolean
  fps:        number
  background: number[] | null   // optional EMA seed (empty-room snapshot)
  threshold:  number       // 0.0–1.0 coverage fraction
  pixelNoise: number       // per-pixel diff floor (0–255)
  onMotion:   () => void
  onFrame?:   (score: number, luminance: number) => void
}

/**
 * Seed a fresh adaptive-background buffer. Prefers a stored empty-room
 * snapshot; otherwise starts from the first observed frame (so the very first
 * comparison is against itself and scores ~0). Float32 is required — integer
 * rounding at this low alpha would freeze the running average.
 */
export function seedBackground(gray: Uint8Array, stored?: ArrayLike<number> | null): Float32Array {
  const bg = new Float32Array(gray.length)
  if (stored && stored.length === gray.length) {
    for (let i = 0; i < gray.length; i++) bg[i] = stored[i]
  } else {
    for (let i = 0; i < gray.length; i++) bg[i] = gray[i]
  }
  return bg
}

/**
 * Diff a grayscale frame against the adaptive background, then fold the frame
 * into that background (EMA update, in place). Returns the coverage score —
 * the fraction of pixels that differ by more than `pixelNoise`. Shared by the
 * live detector and the calibration/test UI so both use identical math.
 */
export function scoreAndUpdate(gray: Uint8Array, bg: Float32Array, pixelNoise: number): number {
  let changed = 0
  for (let i = 0; i < bg.length; i++) {
    const diff = gray[i] - bg[i]
    if (Math.abs(diff) > pixelNoise) changed++
    bg[i] += BG_ALPHA * diff
  }
  return changed / bg.length
}

export function useMotionDetector(opts: MotionDetectorOptions): void {
  const optsRef     = useRef(opts)
  optsRef.current   = opts

  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement | null>(null)
  const bgRef       = useRef<Float32Array | null>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const cooldownRef = useRef(false)
  const activeRef   = useRef(false)

  const processFrame = useCallback(() => {
    const o      = optsRef.current
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H)
    const rgba = ctx.getImageData(0, 0, FRAME_W, FRAME_H).data

    // Convert to grayscale + compute luminance
    const gray = new Uint8Array(FRAME_PX)
    let lumSum = 0
    for (let i = 0; i < FRAME_PX; i++) {
      const v = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2])
      gray[i] = v
      lumSum += v
    }
    const luminance = lumSum / FRAME_PX / 255

    // Adaptive background: seed on the first frame (from the stored empty-room
    // snapshot if present, else this frame), then diff-and-update every frame.
    // Because the reference tracks the scene, only *changes relative to the
    // recent past* score — lighting drift since calibration no longer counts
    // as permanent motion the way a frozen static reference did.
    if (!bgRef.current) bgRef.current = seedBackground(gray, o.background)
    const score = scoreAndUpdate(gray, bgRef.current, o.pixelNoise)

    o.onFrame?.(score, luminance)

    if (score > o.threshold && !cooldownRef.current) {
      cooldownRef.current = true
      o.onMotion()
      // 10-second cooldown before re-triggering
      setTimeout(() => { cooldownRef.current = false }, 10_000)
    }
  }, [])

  // Self-scheduling loop — reads fps from ref so rate changes take effect without restarts
  const scheduleNext = useCallback(() => {
    if (!activeRef.current) return
    const ms = Math.round(1000 / Math.max(0.25, optsRef.current.fps))
    timerRef.current = setTimeout(() => {
      processFrame()
      scheduleNext()
    }, ms)
  }, [processFrame])

  useEffect(() => {
    if (!opts.enabled) return

    activeRef.current = true

    const canvas = document.createElement('canvas')
    canvas.width  = FRAME_W
    canvas.height = FRAME_H
    canvasRef.current = canvas

    const video = document.createElement('video')
    video.muted      = true
    video.playsInline = true
    videoRef.current  = video

    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    }).then((stream) => {
      if (!activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return undefined }
      streamRef.current  = stream
      video.srcObject    = stream
      return video.play()
    }).then(() => {
      if (activeRef.current) scheduleNext()
    }).catch((err) => {
      console.warn('[MotionDetector] Camera access failed:', err)
    })

    return () => {
      activeRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      timerRef.current    = null
      streamRef.current   = null
      videoRef.current    = null
      canvasRef.current   = null
      bgRef.current       = null
    }
  }, [opts.enabled, scheduleNext])
}
