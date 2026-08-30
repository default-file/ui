export type SplitRatioBounds = {
  min: number
  max: number
}

const DEFAULT_BOUNDS: SplitRatioBounds = { min: 0.15, max: 0.85 }

/** Clamp a primary pane ratio into inclusive bounds. */
export function clampRatio(
  ratio: number,
  bounds: SplitRatioBounds = DEFAULT_BOUNDS
): number {
  if (!Number.isFinite(ratio)) return bounds.min
  return Math.min(bounds.max, Math.max(bounds.min, ratio))
}

/** Convert a percentage (0 to 100) or unit ratio (0 to 1) into a unit ratio. */
export function normalizeRatioInput(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  if (value > 1) return value / 100
  return value
}

export type SplitSizeConstraint =
  | number
  | `${number}%`
  | { px: number }

/** Resolve a size constraint into a unit ratio against the track length. */
export function resolveSizeRatio(
  constraint: SplitSizeConstraint | undefined,
  trackSize: number,
  fallback: number
): number {
  if (constraint == null) return fallback
  if (typeof constraint === "number") {
    return clampRatio(normalizeRatioInput(constraint), {
      min: 0,
      max: 1,
    })
  }
  if (typeof constraint === "string") {
    const match = /^(\d+(?:\.\d+)?)%$/.exec(constraint.trim())
    if (match == null) return fallback
    return clampRatio(Number(match[1]) / 100, { min: 0, max: 1 })
  }
  if (!Number.isFinite(trackSize) || trackSize <= 0) return fallback
  return clampRatio(constraint.px / trackSize, { min: 0, max: 1 })
}

/** Build min/max primary ratios from host constraints and track size. */
export function resolveRatioBounds(options: {
  minSize?: SplitSizeConstraint | undefined
  maxSize?: SplitSizeConstraint | undefined
  trackSize: number
  fallbackMin?: number | undefined
  fallbackMax?: number | undefined
}): SplitRatioBounds {
  const fallbackMin = options.fallbackMin ?? DEFAULT_BOUNDS.min
  const fallbackMax = options.fallbackMax ?? DEFAULT_BOUNDS.max
  let min = resolveSizeRatio(options.minSize, options.trackSize, fallbackMin)
  let max = resolveSizeRatio(options.maxSize, options.trackSize, fallbackMax)
  if (min > max) {
    const swap = min
    min = max
    max = swap
  }
  return { min, max }
}

/** Map a pointer position along the track into a clamped ratio. */
export function ratioFromPointer(options: {
  pointer: number
  trackStart: number
  trackSize: number
  bounds?: SplitRatioBounds
}): number {
  const { pointer, trackStart, trackSize } = options
  if (!Number.isFinite(trackSize) || trackSize <= 0) {
    return clampRatio(0.5, options.bounds)
  }
  return clampRatio((pointer - trackStart) / trackSize, options.bounds)
}

/** Nudge the ratio by a keyboard step in the given direction. */
export function stepRatio(
  ratio: number,
  direction: 1 | -1,
  step = 0.02,
  bounds: SplitRatioBounds = DEFAULT_BOUNDS
): number {
  const size = Number.isFinite(step) && step > 0 ? step : 0.02
  return clampRatio(ratio + direction * size, bounds)
}

/** Convert a unit ratio into a percentage value for ARIA. */
export function ratioToPercent(ratio: number): number {
  return Math.round(clampRatio(ratio, { min: 0, max: 1 }) * 100)
}
