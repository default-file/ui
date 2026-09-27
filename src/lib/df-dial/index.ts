import { quantizeToStep, snapToStep } from "../df-step"

export type DialDragAxis = "all" | "horizontal" | "vertical"

export { formatByStep, snapToStep, stepPrecision } from "../df-step"

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Wrap a ring heading into 0 to 360. */
export function wrapDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360
}

/** Signed shortest turn from one ring heading to another. */
export function shortestAngleDelta(from: number, to: number) {
  const delta = wrapDegrees(to - from)
  return delta > 180 ? delta - 360 : delta
}

/** Wrap a value into [min, max). */
export function wrapValue(value: number, min: number, max: number) {
  const span = max - min
  if (!(span > 0)) return min
  let t = (value - min) % span
  if (t < 0) t += span
  const next = min + t
  return next >= max ? min : next
}

export function commitDialValue(
  raw: number,
  min: number,
  max: number,
  step: number,
  wrap: boolean
) {
  if (!Number.isFinite(raw)) return min
  if (wrap) return wrapValue(quantizeToStep(raw, min, step), min, max)
  return snapToStep(raw, min, max, step)
}

/** Last resting value in the range. Wrap excludes max. */
export function lastDialValue(
  min: number,
  max: number,
  step: number,
  wrap: boolean
) {
  if (!wrap) return snapToStep(max, min, max, step)
  const span = max - min
  if (!(span > 0)) return min
  const safeStep = step > 0 ? step : 1
  let steps = Math.floor(span / safeStep)
  if (min + steps * safeStep >= max) steps -= 1
  if (steps < 0) return min
  return wrapValue(
    quantizeToStep(min + steps * safeStep, min, safeStep),
    min,
    max
  )
}

/** Position of a value across min to max, from 0 to 1. */
export function ratioAlongRange(
  value: number,
  min: number,
  max: number,
  wrap = false
) {
  const span = max - min
  if (!(span > 0) || !Number.isFinite(value)) return 0
  const source = wrap ? wrapValue(value, min, max) : value
  return clamp((source - min) / span, 0, 1)
}

/**
 * Pointer travel in pixels along the configured drag axis.
 * all: right and up increase, left and down decrease, diagonals combine.
 * horizontal: only left and right. vertical: up increases, down decreases.
 */
export function pointerTravel(
  dx: number,
  dy: number,
  axis: DialDragAxis
) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0
  if (axis === "horizontal") return dx
  if (axis === "vertical") return -dy
  return (dx - dy) / Math.SQRT2
}

/** Pixel travel that maps to one full min to max loop. */
export function turnPixelsFromFace(size: number) {
  if (!(size > 0)) return 1
  return Math.PI * size
}

/** Next drag value from a value delta. Wrap keeps an open accumulator. */
export function applyPointerTravel(
  current: number,
  delta: number,
  min: number,
  max: number,
  wrap: boolean
) {
  const next = current + delta
  if (!Number.isFinite(next)) {
    return Number.isFinite(current) ? current : min
  }
  if (wrap) return next
  return clamp(next, min, max)
}

export function valueDeltaFromTravel(
  travel: number,
  min: number,
  max: number,
  turnPixels: number
) {
  const span = max - min
  if (!(turnPixels > 0) || !(span > 0) || !Number.isFinite(travel)) return 0
  return (travel / turnPixels) * span
}

/** Keep ring rotation continuous across wrap. */
export function followAngle(previous: number, target: number) {
  if (!Number.isFinite(previous)) return target
  if (!Number.isFinite(target)) return previous
  return previous + shortestAngleDelta(wrapDegrees(previous), wrapDegrees(target))
}

/**
 * Map a value onto the ring. Headings are clockwise from the top.
 * When min is 0 or greater, min sits at startAngle and max at startAngle plus sweep.
 * When min is below 0 and max is above 0, value 0 sits at startAngle.
 */
export function valueToAngle(
  value: number,
  min: number,
  max: number,
  startAngle: number,
  sweep: number
) {
  const safeSweep = sweep > 0 ? sweep : 360
  if (!Number.isFinite(value)) return startAngle
  if (min < 0 && max > 0) {
    const unit = Math.max(Math.abs(min), max)
    if (!(unit > 0)) return startAngle
    return startAngle + (value / unit) * safeSweep
  }
  const span = max - min || 1
  return startAngle + ((value - min) / span) * safeSweep
}

/** Clockwise arc from startAngle to the current value, in 0 to sweep. */
export function progressSweepDegrees(
  value: number,
  min: number,
  max: number,
  startAngle: number,
  sweep: number
) {
  const safeSweep = sweep > 0 ? sweep : 360
  const raw =
    valueToAngle(value, min, max, startAngle, safeSweep) - startAngle
  if (!Number.isFinite(raw) || raw === 0) return 0
  const wrapped = wrapDegrees(raw)
  if (wrapped === 0) return safeSweep
  return wrapped
}

/** Inner end of each SVG tick, in viewBox units. The CSS tick mask owns the visible length, so this must sit inside that band. */
export const DIAL_TICK_INNER_RADIUS = 20

/**
 * Line from the ring edge inward. angle 0 is the top, then clockwise.
 * viewBox is 0 0 100 100. Omit innerRadius to run to the center.
 */
export function tickRay(
  angleDeg: number,
  cx = 50,
  cy = 50,
  radius = 50,
  innerRadius?: number
) {
  if (!Number.isFinite(angleDeg) || !(radius > 0)) {
    return { x1: cx, y1: cy - radius, x2: cx, y2: cy }
  }
  const rad = (angleDeg * Math.PI) / 180
  const x1 = cx + radius * Math.sin(rad)
  const y1 = cy - radius * Math.cos(rad)
  const inner =
    innerRadius == null
      ? 0
      : Number.isFinite(innerRadius)
        ? Math.min(radius, Math.max(0, innerRadius))
        : 0
  return {
    x1,
    y1,
    x2: cx + inner * Math.sin(rad),
    y2: cy - inner * Math.cos(rad),
  }
}

export function nearestTickIndex(
  angle: number,
  tickCount: number,
  tickOrigin = 0
) {
  const count = Math.max(2, Math.floor(tickCount))
  const step = 360 / count
  let best = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (let index = 0; index < count; index++) {
    const tickAngle = tickOrigin + index * step
    const dist = Math.abs(shortestAngleDelta(angle, wrapDegrees(tickAngle)))
    if (dist < bestDist) {
      best = index
      bestDist = dist
    }
  }
  return best
}

/** True when a tick heading sits on the filled arc from min to the current ratio. */
export function isTickFilled(
  tickAngle: number,
  startAngle: number,
  sweep: number,
  ratio: number
) {
  const fillEps = 1e-6
  const safeSweep = sweep > 0 ? sweep : 360
  const fromStart = wrapDegrees(tickAngle - startAngle)
  const safeRatio = clamp(ratio, 0, 1)
  if (safeSweep < 360 && fromStart > safeSweep + fillEps) return false
  if (safeRatio >= 1) return true
  return fromStart <= safeSweep * safeRatio + fillEps
}
