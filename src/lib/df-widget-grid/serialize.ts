import type { WidgetLayoutItem } from "./layout"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readOptionalPositiveInt(
  value: unknown
): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return undefined
  }
  return value
}

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value >= 1
}

function parseItem(value: unknown): WidgetLayoutItem | null {
  if (!isPlainObject(value)) return null
  if (typeof value.id !== "string" || value.id.length === 0) return null

  const x = value.x
  const y = value.y
  const w = value.w
  const h = value.h
  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    typeof w !== "number" ||
    !Number.isFinite(w) ||
    typeof h !== "number" ||
    !Number.isFinite(h)
  ) {
    return null
  }

  if (!isNonNegativeInt(x) || !isNonNegativeInt(y)) return null
  if (!isPositiveInt(w) || !isPositiveInt(h)) return null

  const item: WidgetLayoutItem = {
    id: value.id,
    x,
    y,
    w,
    h,
  }

  if ("minW" in value) {
    const minW = readOptionalPositiveInt(value.minW)
    if (minW === undefined) return null
    item.minW = minW
  }
  if ("minH" in value) {
    const minH = readOptionalPositiveInt(value.minH)
    if (minH === undefined) return null
    item.minH = minH
  }
  if ("maxW" in value) {
    const maxW = readOptionalPositiveInt(value.maxW)
    if (maxW === undefined) return null
    item.maxW = maxW
  }
  if ("maxH" in value) {
    const maxH = readOptionalPositiveInt(value.maxH)
    if (maxH === undefined) return null
    item.maxH = maxH
  }

  return item
}

/** Serialize a layout into a plain JSON safe array. */
export function serializeLayout(
  layout: readonly WidgetLayoutItem[]
): Array<Record<string, unknown>> {
  return layout.map((item) => {
    const entry: Record<string, unknown> = {
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }
    if (item.minW !== undefined) entry.minW = item.minW
    if (item.minH !== undefined) entry.minH = item.minH
    if (item.maxW !== undefined) entry.maxW = item.maxW
    if (item.maxH !== undefined) entry.maxH = item.maxH
    return entry
  })
}

/**
 * Parse a persisted layout payload.
 * Returns null when the root value or any entry is malformed.
 */
export function parseLayout(value: unknown): WidgetLayoutItem[] | null {
  if (!Array.isArray(value)) return null
  const items: WidgetLayoutItem[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    const item = parseItem(entry)
    if (item === null) return null
    if (seen.has(item.id)) return null
    seen.add(item.id)
    items.push(item)
  }
  return items
}
