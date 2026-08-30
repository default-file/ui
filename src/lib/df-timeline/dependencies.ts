import type { TimelineBarRect } from "./bars"

export type TimelineDependencyEdge = {
  fromId: string
  toId: string
}

export type TimelineDependencyAnchor = {
  id: string
  x: number
  width: number
  rowIndex: number
}

export type TimelineDependencyPath = {
  fromId: string
  toId: string
  d: string
}

export type RouteDependencyPathsOptions = {
  rowHeight: number
  /** Horizontal stub before the first elbow. Defaults to 8. */
  stubPx?: number
  /** Corner radius for elbows. Defaults to 4. */
  radiusPx?: number
  /** Extra loop clearance for backward edges. Defaults to stubPx. */
  loopClearancePx?: number
}

function clampRadius(
  radius: number,
  horizontal: number,
  vertical: number
): number {
  const limit = Math.min(Math.abs(horizontal) / 2, Math.abs(vertical) / 2)
  if (!Number.isFinite(radius) || radius <= 0) return 0
  if (!Number.isFinite(limit) || limit <= 0) return 0
  return Math.min(radius, limit)
}

function rowCenterY(rowIndex: number, rowHeight: number): number {
  return rowIndex * rowHeight + rowHeight / 2
}

function forwardPath(input: {
  startX: number
  startY: number
  endX: number
  endY: number
  stub: number
  radius: number
}): string {
  const { startX, startY, endX, endY, stub, radius } = input
  if (startY === endY) {
    return `M ${startX} ${startY} H ${endX}`
  }
  const elbowX = startX + stub
  const deltaY = endY - startY
  const sign = deltaY >= 0 ? 1 : -1
  const r = clampRadius(radius, stub, deltaY)
  if (r === 0) {
    return `M ${startX} ${startY} H ${elbowX} V ${endY} H ${endX}`
  }
  return [
    `M ${startX} ${startY}`,
    `H ${elbowX - r}`,
    `Q ${elbowX} ${startY} ${elbowX} ${startY + sign * r}`,
    `V ${endY - sign * r}`,
    `Q ${elbowX} ${endY} ${elbowX + r} ${endY}`,
    `H ${endX}`,
  ].join(" ")
}

function backwardPath(input: {
  startX: number
  startY: number
  endX: number
  endY: number
  stub: number
  radius: number
  loopClearance: number
  rowHeight: number
  sameRow: boolean
}): string {
  const {
    startX,
    startY,
    endX,
    endY,
    stub,
    radius,
    loopClearance,
    rowHeight,
    sameRow,
  } = input
  const outX = startX + stub
  const loopX = Math.max(outX, endX + stub) + loopClearance
  const sign = sameRow ? 1 : endY >= startY ? 1 : -1
  const midY = sameRow ? startY + rowHeight * 0.65 * sign : endY
  const r = clampRadius(radius, loopClearance, Math.abs(midY - startY) || rowHeight)

  if (sameRow) {
    if (r === 0) {
      return [
        `M ${startX} ${startY}`,
        `H ${outX}`,
        `V ${midY}`,
        `H ${endX - stub}`,
        `V ${endY}`,
        `H ${endX}`,
      ].join(" ")
    }
    return [
      `M ${startX} ${startY}`,
      `H ${outX - r}`,
      `Q ${outX} ${startY} ${outX} ${startY + sign * r}`,
      `V ${midY - sign * r}`,
      `Q ${outX} ${midY} ${outX + r} ${midY}`,
      `H ${endX - stub - r}`,
      `Q ${endX - stub} ${midY} ${endX - stub} ${midY - sign * r}`,
      `V ${endY + sign * r}`,
      `Q ${endX - stub} ${endY} ${endX - stub + r} ${endY}`,
      `H ${endX}`,
    ].join(" ")
  }

  if (r === 0) {
    return `M ${startX} ${startY} H ${loopX} V ${endY} H ${endX}`
  }
  return [
    `M ${startX} ${startY}`,
    `H ${loopX - r}`,
    `Q ${loopX} ${startY} ${loopX} ${startY + sign * r}`,
    `V ${endY - sign * r}`,
    `Q ${loopX} ${endY} ${loopX - r} ${endY}`,
    `H ${endX}`,
  ].join(" ")
}

/**
 * Build SVG path strings for finish to start dependency edges.
 * Paths exit the right of the source bar and enter the left of the target bar.
 * Backward targets loop around with rounded elbows.
 */
export function routeDependencyPaths(
  edges: readonly TimelineDependencyEdge[],
  anchors: readonly TimelineDependencyAnchor[],
  options: RouteDependencyPathsOptions
): TimelineDependencyPath[] {
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]))
  const stub = options.stubPx ?? 8
  const radius = options.radiusPx ?? 4
  const loopClearance = options.loopClearancePx ?? stub
  const rowHeight = options.rowHeight
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
    throw new Error("rowHeight must be a positive finite number")
  }

  const paths: TimelineDependencyPath[] = []

  for (const edge of edges) {
    const from = byId.get(edge.fromId)
    const to = byId.get(edge.toId)
    if (!from || !to) continue

    const startX = from.x + from.width
    const startY = rowCenterY(from.rowIndex, rowHeight)
    const endX = to.x
    const endY = rowCenterY(to.rowIndex, rowHeight)
    const sameRow = from.rowIndex === to.rowIndex
    const forward = endX >= startX + stub

    const d = forward
      ? forwardPath({ startX, startY, endX, endY, stub, radius })
      : backwardPath({
          startX,
          startY,
          endX,
          endY,
          stub,
          radius,
          loopClearance,
          rowHeight,
          sameRow,
        })

    paths.push({ fromId: edge.fromId, toId: edge.toId, d })
  }

  return paths
}

export function anchorsFromBars(
  bars: readonly TimelineBarRect[],
  rowIndexById: ReadonlyMap<string, number>
): TimelineDependencyAnchor[] {
  const anchors: TimelineDependencyAnchor[] = []
  for (const bar of bars) {
    const rowIndex = rowIndexById.get(bar.id)
    if (rowIndex === undefined) continue
    anchors.push({
      id: bar.id,
      x: bar.x,
      width: bar.width,
      rowIndex,
    })
  }
  return anchors
}
