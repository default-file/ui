export type WidgetLayoutItem = {
  id: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export type WidgetGridLayout = WidgetLayoutItem[]

export type WidgetGridBounds = {
  columns: number
}

const DEFAULT_COLUMNS = 12

function finiteInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.trunc(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sortLayout(layout: readonly WidgetLayoutItem[]): WidgetLayoutItem[] {
  return [...layout].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
  )
}

function resolveColumns(columns: number | undefined): number {
  const next = finiteInt(columns ?? DEFAULT_COLUMNS, DEFAULT_COLUMNS)
  return Math.max(1, next)
}

/** Clamp a widget into column bounds and min/max size constraints. */
export function clampWidget(
  item: WidgetLayoutItem,
  columns: number = DEFAULT_COLUMNS
): WidgetLayoutItem {
  const cols = resolveColumns(columns)
  const minW = Math.max(1, finiteInt(item.minW ?? 1, 1))
  const minH = Math.max(1, finiteInt(item.minH ?? 1, 1))
  const maxW = Math.max(minW, finiteInt(item.maxW ?? cols, cols))
  const maxHRaw = item.maxH
  const maxH =
    maxHRaw === undefined || !Number.isFinite(maxHRaw)
      ? Number.POSITIVE_INFINITY
      : Math.max(minH, Math.trunc(maxHRaw))

  const w = clamp(finiteInt(item.w, minW), minW, Math.min(maxW, cols))
  const h = clamp(
    finiteInt(item.h, minH),
    minH,
    Number.isFinite(maxH) ? maxH : Number.MAX_SAFE_INTEGER
  )
  const x = clamp(finiteInt(item.x, 0), 0, Math.max(0, cols - w))
  const y = Math.max(0, finiteInt(item.y, 0))

  return {
    ...item,
    x,
    y,
    w,
    h,
    minW,
    minH,
    ...(item.maxW !== undefined ? { maxW } : {}),
    ...(item.maxH !== undefined && Number.isFinite(maxH) ? { maxH } : {}),
  }
}

export function widgetsOverlap(
  a: Pick<WidgetLayoutItem, "x" | "y" | "w" | "h">,
  b: Pick<WidgetLayoutItem, "x" | "y" | "w" | "h">
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

function pushClearOfPlaced(
  item: WidgetLayoutItem,
  placed: readonly WidgetLayoutItem[]
): WidgetLayoutItem {
  let next = item
  let guard = 0
  while (guard < 10_000) {
    guard += 1
    let blocker: WidgetLayoutItem | null = null
    for (const other of placed) {
      if (widgetsOverlap(next, other)) {
        if (
          blocker === null ||
          other.y + other.h > blocker.y + blocker.h ||
          (other.y + other.h === blocker.y + blocker.h &&
            other.id.localeCompare(blocker.id) < 0)
        ) {
          blocker = other
        }
      }
    }
    if (blocker === null) return next
    next = { ...next, y: blocker.y + blocker.h }
  }
  return next
}

/**
 * Clamp every widget and resolve overlaps by pushing later items down.
 * Sort order is row, then column, then id.
 */
export function normalizeLayout(
  layout: readonly WidgetLayoutItem[],
  columns: number = DEFAULT_COLUMNS
): WidgetLayoutItem[] {
  const cols = resolveColumns(columns)
  const clamped = sortLayout(layout.map((item) => clampWidget(item, cols)))
  const placed: WidgetLayoutItem[] = []
  for (const item of clamped) {
    placed.push(pushClearOfPlaced(item, placed))
  }
  return sortLayout(placed)
}

/**
 * Remove vertical gaps while preserving left to right, top to bottom order.
 */
export function compactLayout(
  layout: readonly WidgetLayoutItem[],
  columns: number = DEFAULT_COLUMNS
): WidgetLayoutItem[] {
  const cols = resolveColumns(columns)
  const ordered = sortLayout(layout.map((item) => clampWidget(item, cols)))
  const placed: WidgetLayoutItem[] = []
  for (const item of ordered) {
    placed.push(pushClearOfPlaced({ ...item, y: 0 }, placed))
  }
  return sortLayout(placed)
}

/**
 * Resolve a layout where `priorityId` keeps its clamped seat and others
 * are pushed down when they collide.
 */
export function resolveLayoutKeeping(
  layout: readonly WidgetLayoutItem[],
  priorityId: string,
  columns: number = DEFAULT_COLUMNS
): WidgetLayoutItem[] {
  const cols = resolveColumns(columns)
  const clamped = layout.map((item) => clampWidget(item, cols))
  const priority = clamped.find((item) => item.id === priorityId)
  if (!priority) return normalizeLayout(clamped, cols)

  const others = sortLayout(clamped.filter((item) => item.id !== priorityId))
  const placed: WidgetLayoutItem[] = [priority]
  for (const item of others) {
    placed.push(pushClearOfPlaced(item, placed))
  }
  return sortLayout(placed)
}

/** Move a widget to a cell origin and return a fully resolved layout. */
export function moveWidget(
  layout: readonly WidgetLayoutItem[],
  id: string,
  x: number,
  y: number,
  columns: number = DEFAULT_COLUMNS
): WidgetLayoutItem[] {
  const cols = resolveColumns(columns)
  const current = layout.find((item) => item.id === id)
  if (!current) return normalizeLayout(layout, cols)

  const nextX = finiteInt(x, current.x)
  const nextY = finiteInt(y, current.y)
  if (nextX === current.x && nextY === current.y) {
    return normalizeLayout(layout, cols)
  }

  const next = layout.map((item) =>
    item.id === id ? { ...item, x: nextX, y: nextY } : item
  )
  return resolveLayoutKeeping(next, id, cols)
}

/** Resize a widget and return a fully resolved layout. */
export function resizeWidget(
  layout: readonly WidgetLayoutItem[],
  id: string,
  w: number,
  h: number,
  columns: number = DEFAULT_COLUMNS
): WidgetLayoutItem[] {
  const cols = resolveColumns(columns)
  const current = layout.find((item) => item.id === id)
  if (!current) return normalizeLayout(layout, cols)

  const nextW = finiteInt(w, current.w)
  const nextH = finiteInt(h, current.h)
  if (nextW === current.w && nextH === current.h) {
    return normalizeLayout(layout, cols)
  }

  const next = layout.map((item) =>
    item.id === id ? { ...item, w: nextW, h: nextH } : item
  )
  return resolveLayoutKeeping(next, id, cols)
}

export function layoutById(
  layout: readonly WidgetLayoutItem[]
): Map<string, WidgetLayoutItem> {
  const map = new Map<string, WidgetLayoutItem>()
  for (const item of layout) map.set(item.id, item)
  return map
}

export function layoutEquals(
  a: readonly WidgetLayoutItem[],
  b: readonly WidgetLayoutItem[]
): boolean {
  if (a.length !== b.length) return false
  const bById = layoutById(b)
  for (const item of a) {
    const other = bById.get(item.id)
    if (!other) return false
    if (
      item.x !== other.x ||
      item.y !== other.y ||
      item.w !== other.w ||
      item.h !== other.h
    ) {
      return false
    }
  }
  return true
}

export { DEFAULT_COLUMNS }
