import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '../store/ui.slice'

export function useInactivityTimer(timeoutMs: number) {
  const setMode = useUIStore((s) => s.setMode)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setMode('standby', 'inactivity-timer')
    }, timeoutMs)
  }, [timeoutMs, setMode])

  useEffect(() => {
    const events = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel']
    const handler = () => reset()

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }))
    reset() // Start the timer immediately

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [reset])
}
