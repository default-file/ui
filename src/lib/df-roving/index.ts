/**
 * Clamp a stored roving index into range and onto an enabled item.
 * When every item is disabled, returns a stable in-range index so one tab stop remains.
 */
export function resolveRovingActiveIndex(
  storedIndex: number,
  count: number,
  isItemDisabled?: (index: number) => boolean
): number {
  if (count <= 0) return 0

  const clamped = Math.min(Math.max(storedIndex, 0), count - 1)
  if (!isItemDisabled?.(clamped)) return clamped

  for (let i = clamped + 1; i < count; i++) {
    if (!isItemDisabled(i)) return i
  }
  for (let i = clamped - 1; i >= 0; i--) {
    if (!isItemDisabled(i)) return i
  }

  return clamped
}
