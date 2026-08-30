export type GridFocusCell = {
  rowIndex: number
  colIndex: number
}

export type GridFocusBounds = {
  rowCount: number
  colCount: number
  pageSize: number
}

/** Move a roving grid focus cell for arrow, home/end, and page keys. */
export function moveGridFocus(
  focus: GridFocusCell,
  key: string,
  bounds: GridFocusBounds
): GridFocusCell | null {
  if (bounds.rowCount <= 0 || bounds.colCount <= 0) return null

  const rowMax = bounds.rowCount - 1
  const colMax = bounds.colCount - 1
  const page = Math.max(1, bounds.pageSize)
  const rowIndex = clamp(focus.rowIndex, 0, rowMax)
  const colIndex = clamp(focus.colIndex, 0, colMax)

  switch (key) {
    case "ArrowUp":
      return { rowIndex: Math.max(0, rowIndex - 1), colIndex }
    case "ArrowDown":
      return { rowIndex: Math.min(rowMax, rowIndex + 1), colIndex }
    case "ArrowLeft":
      return { rowIndex, colIndex: Math.max(0, colIndex - 1) }
    case "ArrowRight":
      return { rowIndex, colIndex: Math.min(colMax, colIndex + 1) }
    case "Home":
      return { rowIndex, colIndex: 0 }
    case "End":
      return { rowIndex, colIndex: colMax }
    case "PageUp":
      return { rowIndex: Math.max(0, rowIndex - page), colIndex }
    case "PageDown":
      return { rowIndex: Math.min(rowMax, rowIndex + page), colIndex }
    default:
      return null
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
