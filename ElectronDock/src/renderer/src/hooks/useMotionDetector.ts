import { useEffect, useRef, useCallback } from 'react'

export const FRAME_W  = 160
export const FRAME_H  = 120
export const FRAME_PX = FRAME_W * FRAME_H   // 19,200

export interface MotionDetectorOptions {
  enabled:    boolean
  fps:        number
  background: number[] | null
  threshold:  number       // 0.0–1.0 coverage fraction
  pixelNoise: number       // per-pixel diff floor (0–255)
  onMotion:   () => void
  onFrame?:   (score: number, luminance: number) => void
}

export function useMotionDetector(opts: MotionDetectorOptions): void {
  const optsRef     = useRef(opts)
  optsRef.current   = opts

  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement | null>(null)
  const prevGrayRef = useRef<Uint8Array | null>(null)
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

    // Reference: stored background model, else previous frame
    const ref: number[] | Uint8Array | null = o.background ?? prevGrayRef.current ?? null
    prevGrayRef.current = gray

    if (!ref) return

    // Count pixels that changed more than the noise floor
    let changed = 0
    for (let i = 0; i < FRAME_PX; i++) {
      if (Math.abs(gray[i] - ref[i]) > o.pixelNoise) changed++
    }
    const score = changed / FRAME_PX

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
      prevGrayRef.current = null
    }
  }, [opts.enabled, scheduleNext])
}
