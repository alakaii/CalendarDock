import { useRef, useEffect } from 'react'

interface SwipeOptions {
  onSwipeLeft?:  () => void
  onSwipeRight?: () => void
  onSwipeUp?:    () => void
  onSwipeDown?:  () => void
  threshold?: number
}

export function useSwipeGesture(ref: React.RefObject<HTMLElement>, options: SwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)
  const threshold = options.threshold ?? 60

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const dx  = e.changedTouches[0].clientX - startX.current
      const dy  = e.changedTouches[0].clientY - startY.current
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)

      if (adx > threshold && adx > ady * 1.5) {
        if (dx < 0) options.onSwipeLeft?.()
        else        options.onSwipeRight?.()
      } else if (ady > threshold && ady > adx * 1.5) {
        if (dy < 0) options.onSwipeUp?.()
        else        options.onSwipeDown?.()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend',   handleTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend',   handleTouchEnd)
    }
  }, [
    ref,
    options.onSwipeLeft,
    options.onSwipeRight,
    options.onSwipeUp,
    options.onSwipeDown,
    threshold
  ])
}
