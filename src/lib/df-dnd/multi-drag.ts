import { type BoardColumn } from "./reorder"

/**
 * Selected ids in visual order. When the active id is not selected, returns only the active id.
 */
export function orderedDragIds(
  visualOrder: readonly string[],
  selectedIds: ReadonlySet<string> | readonly string[] | undefined,
  activeId: string
): string[] {
  if (!selectedIds) return [activeId]
  const selected =
    selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  if (!selected.has(activeId)) return [activeId]
  return visualOrder.filter((id) => selected.has(id))
}

/** Flatten board column item ids in visual order. */
export function boardVisualOrder<T extends { id: string }>(
  columns: readonly BoardColumn<T>[]
): string[] {
  const ids: string[] = []
  for (const column of columns) {
    for (const item of column.items) ids.push(item.id)
  }
  return ids
}

/**
 * Remove a contiguous visual order group and splice it at `toIndex` in the remaining list.
 * `toIndex` is measured against the list after movers are removed.
 */
export function moveGroupInList<T extends { id: string }>(
  items: readonly T[],
  movingIds: readonly string[],
  toIndex: number
): T[] {
  if (movingIds.length === 0) return [...items]
  const movingSet = new Set(movingIds)
  const byId = new Map<string, T>()
  const remaining: T[] = []
  for (const item of items) {
    if (movingSet.has(item.id)) byId.set(item.id, item)
    else remaining.push(item)
  }
  const ordered: T[] = []
  for (const id of movingIds) {
    const item = byId.get(id)
    if (item) ordered.push(item)
  }
  if (ordered.length === 0) return [...items]
  const insertAt = Math.max(0, Math.min(toIndex, remaining.length))
  return [
    ...remaining.slice(0, insertAt),
    ...ordered,
    ...remaining.slice(insertAt),
  ]
}

/**
 * Move one or more cards into a column at `toIndex` (index in the destination after removal).
 * Movers keep the order given in `movingIds`.
 */
export function moveBoardGroup<T extends { id: string }>(
  columns: readonly BoardColumn<T>[],
  movingIds: readonly string[],
  toColumnId: string,
  toIndex: number
): BoardColumn<T>[] {
  if (movingIds.length === 0) return columns.map(cloneColumn)
  if (movingIds.length === 1) {
    const only = movingIds[0]
    if (!only) return columns.map(cloneColumn)
    return moveBoardGroupMany(columns, [only], toColumnId, toIndex)
  }
  return moveBoardGroupMany(columns, movingIds, toColumnId, toIndex)
}

function moveBoardGroupMany<T extends { id: string }>(
  columns: readonly BoardColumn<T>[],
  movingIds: readonly string[],
  toColumnId: string,
  toIndex: number
): BoardColumn<T>[] {
  const movingSet = new Set(movingIds)
  const byId = new Map<string, T>()
  const next = columns.map((column) => {
    const kept: T[] = []
    for (const item of column.items) {
      if (movingSet.has(item.id)) byId.set(item.id, item)
      else kept.push(item)
    }
    return { id: column.id, items: kept }
  })

  const ordered: T[] = []
  for (const id of movingIds) {
    const item = byId.get(id)
    if (item) ordered.push(item)
  }
  if (ordered.length === 0) return columns.map(cloneColumn)

  const toColumnIndex = next.findIndex((column) => column.id === toColumnId)
  if (toColumnIndex < 0) return columns.map(cloneColumn)
  const toColumn = next[toColumnIndex]
  if (!toColumn) return columns.map(cloneColumn)

  const insertAt = Math.max(0, Math.min(toIndex, toColumn.items.length))
  toColumn.items.splice(insertAt, 0, ...ordered)
  return next
}

function cloneColumn<T extends { id: string }>(
  column: BoardColumn<T>
): BoardColumn<T> {
  return { id: column.id, items: [...column.items] }
}
