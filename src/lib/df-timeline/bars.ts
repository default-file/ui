import type { TimelineScale } from "./scale"

export type TimelineBarInput = {
  id: string
  start?: string | undefined
  due?: string | undefined
  progress?: number | undefined
}

export type TimelineBarRect = {
  id: string
  x: number
  width: number
  missingStart: boolean
  missingDue: boolean
  progress: number | null
}

export type LayoutTimelineBarsOptions = {
  /** Width used when one date is missing. Defaults to one fine unit. */
  openEndedWidth?: number
  /** Minimum rendered bar width in pixels. */
  minWidth?: number
}

function clampProgress(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}

/**
 * Project row dates onto the scale as bar rectangles.
 * Rows missing both dates produce no bar. A single missing bound yields an open ended bar.
 */
export function layoutTimelineBars(
  rows: readonly TimelineBarInput[],
  scale: Pick<TimelineScale, "dateToX" | "unitPx" | "totalWidth">,
  options: LayoutTimelineBarsOptions = {}
): TimelineBarRect[] {
  const openEndedWidth = options.openEndedWidth ?? scale.unitPx
  const minWidth = options.minWidth ?? 1
  const rects: TimelineBarRect[] = []

  for (const row of rows) {
    const hasStart = typeof row.start === "string" && row.start.length > 0
    const hasDue = typeof row.due === "string" && row.due.length > 0
    if (!hasStart && !hasDue) continue

    const missingStart = !hasStart
    const missingDue = !hasDue
    let x = 0
    let width = openEndedWidth

    if (hasStart && hasDue) {
      const startX = scale.dateToX(row.start!)
      const dueX = scale.dateToX(row.due!)
      x = Math.min(startX, dueX)
      width = Math.max(minWidth, Math.abs(dueX - startX) + scale.unitPx)
    } else if (hasStart) {
      x = scale.dateToX(row.start!)
      width = Math.max(minWidth, openEndedWidth)
    } else {
      const dueX = scale.dateToX(row.due!)
      width = Math.max(minWidth, openEndedWidth)
      x = Math.max(0, dueX + scale.unitPx - width)
    }

    if (x + width < 0 || x > scale.totalWidth) continue

    rects.push({
      id: row.id,
      x,
      width,
      missingStart,
      missingDue,
      progress: clampProgress(row.progress),
    })
  }

  return rects
}

export function timelineBarsById(
  rects: readonly TimelineBarRect[]
): Map<string, TimelineBarRect> {
  const map = new Map<string, TimelineBarRect>()
  for (const rect of rects) map.set(rect.id, rect)
  return map
}
