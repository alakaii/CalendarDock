import { useEffect, useRef } from 'react'

export type DragAxis = 'x' | 'y'

interface DragSwipeOptions {
  enabled: boolean
  /** Which axes the gesture commits to. `axes: []` disables. */
  axes: ReadonlyArray<DragAxis>
  /** Pixels of movement before the axis is locked. Filters out incidental taps. */
  axisLockPx?: number
  /** Pixels past which a release counts as a commit (otherwise spring back). */
  commitPx?: number
  onDragStart?: () => void
  onDragMove?:  (dx: number, dy: number, axis: DragAxis) => void
  /**
   * dir: -1 = swiped left/up, +1 = swiped right/down, 0 = below commit threshold.
   * dx/dy are the final deltas before release.
   */
  onDragEnd?:   (dx: number, dy: number, axis: DragAxis, dir: -1 | 0 | 1) => void
}

/**
 * Touch-only drag gesture hook with axis locking + commit threshold. Use the
 * onDragMove callback to live-translate the wrapped element with the finger,
 * then the onDragEnd callback's dir to decide whether to commit (animate
 * off-screen + change content) or spring back to 0.
 *
 * Listeners attach in the capture phase so FullCalendar's interaction plugin
 * can't stopPropagation our touch events out of existence (same workaround
 * useSwipeGesture relies on).
 */
export function useDragSwipe(
  ref: React.RefObject<HTMLElement>,
  options: DragSwipeOptions,
) {
  const lockRef  = useRef<DragAxis | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const optsRef  = useRef(options)
  optsRef.current = options

  useEffect(() => {
    if (!options.enabled || options.axes.length === 0) return
    const el = ref.current
    if (!el) return

    const lockPx   = options.axisLockPx ?? 10
    const commitPx = options.commitPx   ?? 60

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY }
      lockRef.current = null
    }

    const onMove = (e: TouchEvent) => {
      const start = startRef.current
      if (!start) return
      const t   = e.touches[0]
      const dx  = t.clientX - start.x
      const dy  = t.clientY - start.y
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)

      if (lockRef.current === null) {
        if (adx < lockPx && ady < lockPx) return
        const allowed = optsRef.current.axes
        if      (adx >= ady && allowed.includes('x')) lockRef.current = 'x'
        else if (ady >  adx && allowed.includes('y')) lockRef.current = 'y'
        else { startRef.current = null; return }
        optsRef.current.onDragStart?.()
      }

      const ax = lockRef.current
      optsRef.current.onDragMove?.(
        ax === 'x' ? dx : 0,
        ax === 'y' ? dy : 0,
        ax,
      )
    }

    const onEnd = (e: TouchEvent) => {
      const start = startRef.current
      const ax    = lockRef.current
      startRef.current = null
      lockRef.current  = null
      if (!start || !ax) return

      const t  = e.changedTouches[0]
      const dx = ax === 'x' ? t.clientX - start.x : 0
      const dy = ax === 'y' ? t.clientY - start.y : 0
      const v  = ax === 'x' ? dx : dy

      let dir: -1 | 0 | 1 = 0
      if      (v <= -commitPx) dir = -1
      else if (v >=  commitPx) dir = 1

      optsRef.current.onDragEnd?.(dx, dy, ax, dir)
    }

    const onCancel = () => {
      const start = startRef.current
      const ax    = lockRef.current
      startRef.current = null
      lockRef.current  = null
      if (start && ax) optsRef.current.onDragEnd?.(0, 0, ax, 0)
    }

    const opts: AddEventListenerOptions = { passive: true, capture: true }
    el.addEventListener('touchstart',  onStart,  opts)
    el.addEventListener('touchmove',   onMove,   opts)
    el.addEventListener('touchend',    onEnd,    opts)
    el.addEventListener('touchcancel', onCancel, opts)

    return () => {
      el.removeEventListener('touchstart',  onStart,  opts)
      el.removeEventListener('touchmove',   onMove,   opts)
      el.removeEventListener('touchend',    onEnd,    opts)
      el.removeEventListener('touchcancel', onCancel, opts)
    }
  }, [options.enabled, options.axes.join(','), options.axisLockPx, options.commitPx, ref])
}
