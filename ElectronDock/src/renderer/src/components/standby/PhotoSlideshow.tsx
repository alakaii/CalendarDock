import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import type { SlideshowSortOrder, SlideshowTransition, SlideshowCropMode } from '../../../../preload/types'

interface PhotoSlideshowProps {
  photos: string[]
  sortOrder?: SlideshowSortOrder
  intervalMs?: number
  transition?: SlideshowTransition
  transitionDurationMs?: number
  cropMode?: SlideshowCropMode
  /** 30–100. Reserved for face-detection-driven anchoring (lands next). */
  focusSafeZonePercent?: number
  /**
   * Tailwind background class for the slide container. Defaults to `bg-black`
   * (fullscreen standby). In the "calendar window" standby framing pass
   * `bg-transparent` so any letterbox gaps reveal the art + veil behind the
   * rect instead of a solid black block.
   */
  background?: string
}

export interface PhotoSlideshowHandle {
  next: () => void
  prev: () => void
}

/** Parse a date from common filename patterns like 20240115, 2024-01-15, IMG_20240115, etc. */
function parseDateFromFilename(filename: string): number {
  const m = filename.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/)
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}`)
    if (!isNaN(d.getTime())) return d.getTime()
  }
  return 0
}

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const PhotoSlideshow = forwardRef<PhotoSlideshowHandle, PhotoSlideshowProps>(
  function PhotoSlideshow(
    {
      photos,
      sortOrder = 'filename',
      intervalMs = 8000,
      transition = 'fade',
      transitionDurationMs = 1500,
      cropMode = 'fit',
      focusSafeZonePercent: _focusSafeZonePercent = 60,
      background = 'bg-black',
    },
    ref
  ) {
    // Sort/shuffle photos — reshuffles only when photos list changes
    const sortedPhotos = useMemo(() => {
      if (photos.length === 0) return photos
      if (sortOrder === 'random') return shuffle(photos)
      if (sortOrder === 'date') {
        return [...photos].sort((a, b) => parseDateFromFilename(b) - parseDateFromFilename(a))
      }
      return [...photos].sort((a, b) => a.localeCompare(b))
    }, [photos, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

    const [frontIndex, setFrontIndex] = useState(0)
    const [backIndex,  setBackIndex]  = useState(1)
    const [showFront,  setShowFront]  = useState(true)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── Image preloader ───────────────────────────────────────────────────────
    // Holds a small window of fully-fetched + decoded HTMLImageElements so the
    // next swap's image is already in the browser cache. Without this, the
    // newly-mounted <img> kicks off a disk read + decode mid-transition and
    // pops in halfway through the fade.
    const preloadCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
    const preloadOrderRef = useRef<string[]>([])

    // ── Broken-photo skip ───────────────────────────────────────────────────
    // The disk cache can list names whose file is gone (evicted mid-rotation,
    // failed download). Their <img> fires onError → we remember the name for
    // this session and skip it in future rotations, and advance past it now.
    // Throttled so a run of broken names can't spin the buffer faster than the
    // interval (at most one advance per 300ms).
    const failedRef           = useRef<Set<string>>(new Set())
    const lastErrorAdvanceRef = useRef(0)
    const preload = (url: string) => {
      const cache = preloadCacheRef.current
      if (cache.has(url)) return
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      cache.set(url, img)
      preloadOrderRef.current.push(url)
      // Keep the last 5 — beyond that the browser cache + GC can take over.
      while (preloadOrderRef.current.length > 5) {
        const old = preloadOrderRef.current.shift()!
        cache.delete(old)
      }
      // Force decode so the bitmap is ready before the swap.
      if ('decode' in img) img.decode().catch(() => { /* skip if it fails */ })
    }

    // Refs that always mirror the latest values — needed for imperative navigate()
    const frontIdxRef   = useRef(frontIndex)
    const backIdxRef    = useRef(backIndex)
    const showFrontRef  = useRef(showFront)
    const sortedRef     = useRef(sortedPhotos)
    const intervalMsRef = useRef(intervalMs)

    frontIdxRef.current   = frontIndex
    backIdxRef.current    = backIndex
    showFrontRef.current  = showFront
    sortedRef.current     = sortedPhotos
    intervalMsRef.current = intervalMs

    const photoUrl = (filename: string) =>
      `cdphoto://photo/${encodeURIComponent(filename)}`

    // Next index after `from` whose photo hasn't failed this session. Falls back
    // to a plain +1 step if every photo is marked failed (avoids an infinite
    // loop and keeps the show moving).
    const nextLiveIndex = (from: number): number => {
      const arr = sortedRef.current
      const len = arr.length
      for (let step = 1; step <= len; step++) {
        const idx = (from + step) % len
        if (!failedRef.current.has(arr[idx])) return idx
      }
      return (from + 1) % len
    }

    // A rendered <img> failed to load. Remember the name so it's skipped from
    // now on; if the failed layer is the one currently on screen, advance past
    // it to the next live photo (throttled to one advance per 300ms).
    const handleImgError = (name: string, layer: 'front' | 'back') => {
      failedRef.current.add(name)
      const isVisible = layer === (showFrontRef.current ? 'front' : 'back')
      if (!isVisible) return
      const now = Date.now()
      if (now - lastErrorAdvanceRef.current < 300) return
      lastErrorAdvanceRef.current = now
      if (sortedRef.current.length < 2) return
      setShowFront((prev) => {
        const cur  = prev ? frontIdxRef.current : backIdxRef.current
        const next = nextLiveIndex(cur)
        if (prev) { backIdxRef.current  = next; setBackIndex(next)  }
        else      { frontIdxRef.current = next; setFrontIndex(next) }
        preload(photoUrl(sortedRef.current[nextLiveIndex(next)]))
        return !prev
      })
    }

    // Whenever the photo list changes, prime the preloader with the next
    // few images so the first transitions don't start cold.
    useEffect(() => {
      if (sortedPhotos.length === 0) return
      const start = Math.max(frontIdxRef.current, backIdxRef.current)
      for (let i = 0; i < 3; i++) {
        const idx = (start + i) % sortedPhotos.length
        preload(photoUrl(sortedPhotos[idx]))
      }
    }, [sortedPhotos]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-advance interval. Reads through refs so the closure isn't pinned
    // to the front/back indices captured on the first render — those would
    // never update (deps don't include them), causing the slideshow to
    // alternate between just two photos.
    useEffect(() => {
      if (sortedPhotos.length < 2) return

      intervalRef.current = setInterval(() => {
        setShowFront((prev) => {
          const len = sortedRef.current.length
          if (len < 2) return prev
          const cur  = prev ? frontIdxRef.current : backIdxRef.current
          const next = nextLiveIndex(cur)
          if (prev) {
            backIdxRef.current = next
            setBackIndex(next)
          } else {
            frontIdxRef.current = next
            setFrontIndex(next)
          }
          // Preload the image AFTER the one we just queued, so it's ready
          // and decoded when the next swap fires.
          preload(photoUrl(sortedRef.current[(next + 1) % len]))
          // Notify the queue manager that one slide was shown
          window.api.photos.advance().catch(() => {})
          return !prev
        })
      }, intervalMs)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, [sortedPhotos.length, intervalMs])

    // Restart auto-advance using ref values (called after manual swipe)
    const restartInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (sortedRef.current.length < 2) return
      intervalRef.current = setInterval(() => {
        setShowFront((p) => {
          const si  = nextLiveIndex(p ? frontIdxRef.current : backIdxRef.current)
          if (p) { backIdxRef.current  = si; setBackIndex(si)  }
          else   { frontIdxRef.current = si; setFrontIndex(si) }
          preload(photoUrl(sortedRef.current[nextLiveIndex(si)]))
          return !p
        })
      }, intervalMsRef.current)
    }

    // Navigate forward (+1) or backward (-1)
    const navigate = (direction: 1 | -1) => {
      const len = sortedRef.current.length
      if (len < 2) return
      const isFront = showFrontRef.current
      const curIdx  = isFront ? frontIdxRef.current : backIdxRef.current
      const newIdx  = ((curIdx + direction) % len + len) % len

      if (isFront) {
        backIdxRef.current = newIdx
        setBackIndex(newIdx)
      } else {
        frontIdxRef.current = newIdx
        setFrontIndex(newIdx)
      }
      showFrontRef.current = !isFront
      setShowFront(!isFront)

      // Preload the image past where we just navigated.
      preload(photoUrl(sortedRef.current[((newIdx + direction) % len + len) % len]))

      // Notify the queue manager that a slide was shown (manual navigation)
      window.api.photos.advance().catch(() => {})

      // Give the new photo its full display duration
      restartInterval()
    }

    useImperativeHandle(ref, () => ({
      next: () => navigate(1),
      prev: () => navigate(-1),
    }))

    if (sortedPhotos.length === 0) {
      return <div className={`absolute inset-0 ${background === 'bg-black' ? 'bg-gradient-to-br from-gray-800 to-gray-950' : background}`} />
    }

    const transMs      = `${transitionDurationMs}ms`
    const zoomDuration = `${intervalMs + transitionDurationMs}ms`
    const zoomStyle = (isActive: boolean): React.CSSProperties =>
      transition === 'zoom' && isActive
        ? { animation: `kenburns ${zoomDuration} linear forwards` }
        : {}

    /**
     * One full-bleed slide. Two layouts:
     *
     * `fit` — letterbox the whole photo on a heavy-blurred copy of itself.
     *   Eliminates awkward edge crops on portrait / panorama / off-center
     *   subjects; the entire photo always shows.
     *
     * `focus` — fill the screen with the photo (object-cover). Anchored at
     *   center for now; the next iteration will pan based on detected face /
     *   salient region while keeping the anchor inside the safe zone slider.
     */
    const renderLayer = (key: string, idx: number, visible: boolean, layer: 'front' | 'back') => {
      const name = sortedPhotos[idx % sortedPhotos.length] ?? sortedPhotos[0]
      const url  = photoUrl(name)
      const onError = () => handleImgError(name, layer)

      if (cropMode === 'focus') {
        return (
          <div
            key={key}
            className="absolute inset-0"
            style={{
              opacity: visible ? 1 : 0,
              transition: `opacity ${transMs} ease`,
              willChange: 'opacity',
            }}
          >
            <img
              src={url}
              alt=""
              decoding="async"
              loading="eager"
              onError={onError}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: '50% 50%',  // TODO: pan to focal point + safe zone
                willChange: 'transform',
                ...zoomStyle(visible),
              }}
              draggable={false}
            />
          </div>
        )
      }

      return (
        <div
          key={key}
          className="absolute inset-0"
          style={{
            opacity: visible ? 1 : 0,
            transition: `opacity ${transMs} ease`,
            willChange: 'opacity',
          }}
        >
          {/* Blurred backdrop — same image, scaled up + heavy blur fills the
              negative space without showing edge ringing. */}
          <img
            src={url}
            alt=""
            aria-hidden="true"
            decoding="async"
            loading="eager"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: 'blur(40px) brightness(0.55)',
              transform: 'scale(1.1)',
            }}
            draggable={false}
          />
          {/* Main image — full photo always visible (no crop) */}
          <img
            src={url}
            alt=""
            decoding="async"
            loading="eager"
            onError={onError}
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              willChange: 'transform',
              ...zoomStyle(visible),
            }}
            draggable={false}
          />
        </div>
      )
    }

    return (
      <div className={`absolute inset-0 ${background}`}>
        {renderLayer(`back-${backIndex}`,   backIndex,  !showFront, 'back')}
        {renderLayer(`front-${frontIndex}`, frontIndex,  showFront, 'front')}
        {/* Gradient overlay to make text readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      </div>
    )
  }
)

export default PhotoSlideshow
