import type { TimelineScale } from "./scale"

export type TimelineDragKind = "move" | "resize-start" | "resize-end"

export type TimelineDragOrigin = {
  start: string
  due: string
}

export type TimelineDragResult = {
  start: string
  due: string
}

export type ReduceTimelineDragInput = {
  kind: TimelineDragKind
  origin: TimelineDragOrigin
  deltaPx: number
  scale: Pick<
    TimelineScale,
    "dateToX" | "xToDate" | "snapDate" | "shiftDate" | "unitPx"
  >
}

function dayOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function clampDueOnOrAfterStart(start: string, due: string): TimelineDragResult {
  if (dayOrder(due, start) < 0) return { start, due: start }
  return { start, due }
}

function unitsFromDeltaPx(deltaPx: number, unitPx: number): number {
  if (!Number.isFinite(deltaPx) || !Number.isFinite(unitPx) || unitPx <= 0) {
    return 0
  }
  return Math.round(deltaPx / unitPx)
}

/**
 * Pure drag reducer for bar move and edge resize.
 * Snaps to the active zoom unit and clamps so due is never before start.
 */
export function reduceTimelineDrag(
  input: ReduceTimelineDragInput
): TimelineDragResult {
  const { kind, origin, deltaPx, scale } = input
  const units = unitsFromDeltaPx(deltaPx, scale.unitPx)
  const originStart = scale.snapDate(origin.start)
  const originDue = scale.snapDate(origin.due)

  if (kind === "move") {
    return clampDueOnOrAfterStart(
      scale.shiftDate(originStart, units),
      scale.shiftDate(originDue, units)
    )
  }

  if (kind === "resize-start") {
    const nextStart = scale.shiftDate(originStart, units)
    if (dayOrder(nextStart, originDue) > 0) {
      return { start: originDue, due: originDue }
    }
    return { start: nextStart, due: originDue }
  }

  const nextDue = scale.shiftDate(originDue, units)
  if (dayOrder(nextDue, originStart) < 0) {
    return { start: originStart, due: originStart }
  }
  return { start: originStart, due: nextDue }
}

/**
 * Keyboard nudge helper. Positive units move later in time.
 */
export function nudgeTimelineBar(input: {
  kind: TimelineDragKind
  origin: TimelineDragOrigin
  units: number
  scale: Pick<TimelineScale, "snapDate" | "shiftDate">
}): TimelineDragResult {
  const originStart = input.scale.snapDate(input.origin.start)
  const originDue = input.scale.snapDate(input.origin.due)
  const units = Number.isFinite(input.units) ? Math.trunc(input.units) : 0

  if (input.kind === "move") {
    return clampDueOnOrAfterStart(
      input.scale.shiftDate(originStart, units),
      input.scale.shiftDate(originDue, units)
    )
  }
  if (input.kind === "resize-start") {
    const nextStart = input.scale.shiftDate(originStart, units)
    if (dayOrder(nextStart, originDue) > 0) {
      return { start: originDue, due: originDue }
    }
    return { start: nextStart, due: originDue }
  }
  const nextDue = input.scale.shiftDate(originDue, units)
  if (dayOrder(nextDue, originStart) < 0) {
    return { start: originStart, due: originStart }
  }
  return { start: originStart, due: nextDue }
}

export function formatTimelineDateRange(start: string, due: string): string {
  if (start === due) return start
  return `${start} to ${due}`
}
