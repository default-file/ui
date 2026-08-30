export type WidgetGridCellMetrics = {
  /** Distance between consecutive column origins, including gap. */
  colStride: number
  /** Distance between consecutive row origins, including gap. */
  rowStride: number
}

export type WidgetGridCellDelta = {
  dx: number
  dy: number
}

/**
 * Build column and row strides from a grid bounding box captured at drag start.
 */
export function cellMetricsFromGridRect(input: {
  width: number
  columns: number
  rowHeight: number
  gapX: number
  gapY: number
}): WidgetGridCellMetrics {
  const columns = Math.max(1, Math.trunc(input.columns))
  const gapX = Number.isFinite(input.gapX) && input.gapX >= 0 ? input.gapX : 0
  const gapY = Number.isFinite(input.gapY) && input.gapY >= 0 ? input.gapY : 0
  const width = Number.isFinite(input.width) ? Math.max(0, input.width) : 0
  const rowHeight =
    Number.isFinite(input.rowHeight) && input.rowHeight > 0
      ? input.rowHeight
      : 1

  const colTrack =
    columns === 0 ? 0 : Math.max(0, (width - gapX * (columns - 1)) / columns)
  const colStride = colTrack + gapX
  const rowStride = rowHeight + gapY

  return {
    colStride: colStride > 0 ? colStride : 1,
    rowStride: rowStride > 0 ? rowStride : 1,
  }
}

function unitsFromDelta(deltaPx: number, stride: number): number {
  if (!Number.isFinite(deltaPx) || !Number.isFinite(stride) || stride <= 0) {
    return 0
  }
  // Half cell hysteresis with symmetric midpoint rounding away from zero.
  const ratio = deltaPx / stride
  const sign = ratio < 0 ? -1 : 1
  return sign * Math.round(Math.abs(ratio))
}

/**
 * Map pointer deltas to grid cell deltas using metrics captured at drag start.
 */
export function cellDeltaFromPointer(
  deltaPxX: number,
  deltaPxY: number,
  metrics: WidgetGridCellMetrics
): WidgetGridCellDelta {
  return {
    dx: unitsFromDelta(deltaPxX, metrics.colStride),
    dy: unitsFromDelta(deltaPxY, metrics.rowStride),
  }
}

/** Convert a cell delta back into a pixel translate for the drag layer. */
export function translateFromCellDelta(
  delta: WidgetGridCellDelta,
  metrics: WidgetGridCellMetrics
): { x: number; y: number } {
  return {
    x: delta.dx * metrics.colStride,
    y: delta.dy * metrics.rowStride,
  }
}
