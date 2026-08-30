export type ChartPoint = {
  x: number
  y: number
  label?: string
}

export type ChartSeries = {
  id: string
  points: ChartPoint[]
}

export type ChartBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type SvgPoint = {
  x: number
  y: number
}

/** Inclusive bounds for one or more series. Empty input returns zeros. */
export function seriesBounds(series: readonly ChartSeries[]): ChartBounds {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let count = 0
  for (const row of series) {
    for (const point of row.points) {
      count += 1
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
  }
  if (count === 0) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 }
  }
  if (minX === maxX) maxX = minX + 1
  if (minY === maxY) maxY = minY + 1
  return { minX, maxX, minY, maxY }
}

/** Map data points into an SVG plot box. */
export function projectSeriesToSvg(
  series: ChartSeries,
  bounds: ChartBounds,
  width: number,
  height: number,
  padding = 8
): SvgPoint[] {
  const innerW = Math.max(width - padding * 2, 1)
  const innerH = Math.max(height - padding * 2, 1)
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  return series.points.map((point) => ({
    x: padding + ((point.x - bounds.minX) / spanX) * innerW,
    y: padding + (1 - (point.y - bounds.minY) / spanY) * innerH,
  }))
}

export function polylinePath(points: readonly SvgPoint[]): string {
  if (points.length === 0) return ""
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ")
}

/** Cumulative burndown style remaining series from daily burn values. */
export function remainingFromBurns(
  startRemaining: number,
  burns: readonly number[]
): ChartPoint[] {
  let remaining = startRemaining
  const points: ChartPoint[] = [{ x: 0, y: remaining }]
  burns.forEach((burn, index) => {
    remaining = Math.max(0, remaining - burn)
    points.push({ x: index + 1, y: remaining })
  })
  return points
}
