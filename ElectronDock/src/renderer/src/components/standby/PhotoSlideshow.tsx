import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import type { SlideshowSortOrder, SlideshowTransition } from '../../../../preload/types'

interface PhotoSlideshowProps {
  photos: string[]
  sortOrder?: SlideshowSortOrder
  intervalMs?: number
  transition?: SlideshowTransition
  transitionDurationMs?: number
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
      transitionDurationMs = 1500
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

    // Auto-advance interval
    useEffect(() => {
      if (sortedPhotos.length < 2) return

      intervalRef.current = setInterval(() => {
        setShowFront((prev) => {
          const nextIndex = (prev ? frontIndex : backIndex) + 1
          const safeIndex = nextIndex % sortedPhotos.length
          if (prev) {
            setBackIndex(safeIndex)
          } else {
            setFrontIndex(safeIndex)
          }
          return !prev
        })
      }, intervalMs)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, [sortedPhotos.length, intervalMs]) // eslint-disable-line react-hooks/exhaustive-deps

    // Restart auto-advance using ref values (called after manual swipe)
    const restartInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (sortedRef.current.length < 2) return
      intervalRef.current = setInterval(() => {
        setShowFront((p) => {
          const ni = (p ? frontIdxRef.current : backIdxRef.current) + 1
          const si = ni % sortedRef.current.length
          if (p) { backIdxRef.current  = si; setBackIndex(si)  }
          else   { frontIdxRef.current = si; setFrontIndex(si) }
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

      // Give the new photo its full display duration
      restartInterval()
    }

    useImperativeHandle(ref, () => ({
      next: () => navigate(1),
      prev: () => navigate(-1),
    }))

    if (sortedPhotos.length === 0) {
      return <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-950" />
    }

    const photoUrl = (filename: string) =>
      `cdphoto://photo/${encodeURIComponent(filename)}`

    const transMs      = `${transitionDurationMs}ms`
    const zoomDuration = `${intervalMs + transitionDurationMs}ms`
    const zoomStyle = (isActive: boolean): React.CSSProperties =>
      transition === 'zoom' && isActive
        ? { animation: `kenburns ${zoomDuration} linear forwards` }
        : {}

    return (
      <div className="absolute inset-0">
        {/* Back layer */}
        <img
          key={`back-${backIndex}`}
          src={photoUrl(sortedPhotos[backIndex % sortedPhotos.length] ?? sortedPhotos[0])}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: showFront ? 0 : 1,
            transition: `opacity ${transMs} ease`,
            ...zoomStyle(!showFront)
          }}
          draggable={false}
        />
        {/* Front layer */}
        <img
          key={`front-${frontIndex}`}
          src={photoUrl(sortedPhotos[frontIndex % sortedPhotos.length] ?? sortedPhotos[0])}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: showFront ? 1 : 0,
            transition: `opacity ${transMs} ease`,
            ...zoomStyle(showFront)
          }}
          draggable={false}
        />
        {/* Gradient overlay to make text readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      </div>
    )
  }
)

export default PhotoSlideshow
