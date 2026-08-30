/** Pure reorder helpers for list and board drag. */

export function moveIndex<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item === undefined) return [...items]
  const clamped = Math.max(0, Math.min(to, next.length))
  next.splice(clamped, 0, item)
  return next
}

export type BoardColumn<T extends { id: string }> = {
  id: string
  items: T[]
}

/**
 * Move an item within one column or across columns.
 * `toIndex` is the insertion index in the destination column after removal.
 */
export function moveBoardItem<T extends { id: string }>(
  columns: readonly BoardColumn<T>[],
  itemId: string,
  toColumnId: string,
  toIndex: number
): BoardColumn<T>[] {
  let fromColumnIndex = -1
  let fromItemIndex = -1
  let moving: T | undefined

  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex]
    if (!column) continue
    const itemIndex = column.items.findIndex((item) => item.id === itemId)
    if (itemIndex >= 0) {
      fromColumnIndex = columnIndex
      fromItemIndex = itemIndex
      moving = column.items[itemIndex]
      break
    }
  }

  if (!moving || fromColumnIndex < 0) return columns.map(cloneColumn)

  const next = columns.map(cloneColumn)
  const fromColumn = next[fromColumnIndex]
  if (!fromColumn) return columns.map(cloneColumn)
  fromColumn.items.splice(fromItemIndex, 1)

  const toColumnIndex = next.findIndex((column) => column.id === toColumnId)
  if (toColumnIndex < 0) return columns.map(cloneColumn)
  const toColumn = next[toColumnIndex]
  if (!toColumn) return columns.map(cloneColumn)

  let insertAt = Math.max(0, Math.min(toIndex, toColumn.items.length))
  if (fromColumnIndex === toColumnIndex && fromItemIndex < insertAt) {
    insertAt -= 1
    insertAt = Math.max(0, insertAt)
  }
  toColumn.items.splice(insertAt, 0, moving)
  return next
}

function cloneColumn<T extends { id: string }>(
  column: BoardColumn<T>
): BoardColumn<T> {
  return { id: column.id, items: [...column.items] }
}

export function indexFromPointerY(
  clientY: number,
  itemRects: Array<{ id: string; top: number; bottom: number; height: number }>
): number {
  if (itemRects.length === 0) return 0
  for (let index = 0; index < itemRects.length; index += 1) {
    const rect = itemRects[index]
    if (!rect) continue
    const mid = rect.top + rect.height / 2
    if (clientY < mid) return index
  }
  return itemRects.length
}
