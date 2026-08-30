/** Pure edge proximity scroll velocity for pointer drag auto scroll. */

/** Edge zone thickness in CSS pixels where auto scroll activates. */
export const DF_DND_AUTO_SCROLL_ZONE_PX = 48

/** Peak scroll speed in CSS pixels per animation frame. */
export const DF_DND_AUTO_SCROLL_MAX_VELOCITY_PX = 28

export type AutoScrollAxis = "x" | "y" | "both"

/**
 * Signed scroll delta for one axis from pointer proximity to the start or end edge.
 * Negative values scroll toward the start; positive toward the end. Zero outside the zone.
 */
export function edgeScrollVelocity(options: {
  pointer: number
  start: number
  end: number
  zone?: number | undefined
  maxVelocity?: number | undefined
}): number {
  const zone = options.zone ?? DF_DND_AUTO_SCROLL_ZONE_PX
  const maxVelocity = options.maxVelocity ?? DF_DND_AUTO_SCROLL_MAX_VELOCITY_PX
  if (
    !Number.isFinite(options.pointer) ||
    !Number.isFinite(options.start) ||
    !Number.isFinite(options.end) ||
    zone <= 0 ||
    maxVelocity <= 0
  ) {
    return 0
  }

  const span = options.end - options.start
  if (span <= 0) return 0

  const effectiveZone = Math.min(zone, span / 2)
  const distFromStart = options.pointer - options.start
  const distFromEnd = options.end - options.pointer

  if (distFromStart < effectiveZone && distFromStart >= 0) {
    const t = 1 - distFromStart / effectiveZone
    return -maxVelocity * clampUnit(t)
  }
  if (distFromEnd < effectiveZone && distFromEnd >= 0) {
    const t = 1 - distFromEnd / effectiveZone
    return maxVelocity * clampUnit(t)
  }
  return 0
}

/** Axis scroll deltas for a rectangular scrollport and pointer position. */
export function autoScrollDelta(options: {
  clientX: number
  clientY: number
  left: number
  top: number
  right: number
  bottom: number
  axis?: AutoScrollAxis | undefined
  zone?: number | undefined
  maxVelocity?: number | undefined
}): { dx: number; dy: number } {
  const axis = options.axis ?? "both"
  const dx =
    axis === "y"
      ? 0
      : edgeScrollVelocity({
          pointer: options.clientX,
          start: options.left,
          end: options.right,
          zone: options.zone,
          maxVelocity: options.maxVelocity,
        })
  const dy =
    axis === "x"
      ? 0
      : edgeScrollVelocity({
          pointer: options.clientY,
          start: options.top,
          end: options.bottom,
          zone: options.zone,
          maxVelocity: options.maxVelocity,
        })
  return { dx, dy }
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
