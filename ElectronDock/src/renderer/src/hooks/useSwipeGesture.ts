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

    // capture: true so the gesture wins over inner consumers (e.g. FullCalendar's
    // interaction plugin, which otherwise stopPropagation's touch events on the
    // grid before they bubble up to the swipe container).
    const opts: AddEventListenerOptions = { passive: true, capture: true }
    el.addEventListener('touchstart', handleTouchStart, opts)
    el.addEventListener('touchend',   handleTouchEnd,   opts)

    return () => {
      el.removeEventListener('touchstart', handleTouchStart, opts)
      el.removeEventListener('touchend',   handleTouchEnd,   opts)
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
