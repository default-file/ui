import { prefersReducedMotion } from "../df-motion"

export type TweenNumberOptions = {
  from?: number
  to?: number
  ms?: number
  waitMs?: number
  easing?: (t: number) => number
  onFrame: (value: number) => void
  onDone?: () => void
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

/** Animate a number. Returns a cancel function that clears the timer and frame. */
export function tweenNumber({
  from = 0,
  to = 100,
  ms = 1000,
  waitMs = 0,
  easing = easeOutCubic,
  onFrame,
  onDone,
}: TweenNumberOptions): () => void {
  let timerId: ReturnType<typeof setTimeout> | null = null
  let frameId: number | null = null
  let cancelled = false

  const cancel = () => {
    cancelled = true
    if (timerId != null) {
      clearTimeout(timerId)
      timerId = null
    }
    if (frameId != null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }

  const finish = () => {
    if (cancelled) return
    onFrame(to)
    onDone?.()
  }

  const duration = Number.isFinite(ms) ? ms : 0
  if (prefersReducedMotion() || !(duration > 0)) {
    timerId = setTimeout(() => {
      timerId = null
      finish()
    }, Math.max(0, waitMs))
    return cancel
  }

  const clockOrigin = performance.now() + waitMs
  const step = () => {
    if (cancelled) return
    const t = Math.min((performance.now() - clockOrigin) / duration, 1)
    onFrame(from + (to - from) * easing(t))
    if (t < 1) {
      frameId = requestAnimationFrame(step)
    } else {
      frameId = null
      onDone?.()
    }
  }

  timerId = setTimeout(() => {
    timerId = null
    if (cancelled) return
    frameId = requestAnimationFrame(step)
  }, waitMs)

  return cancel
}
