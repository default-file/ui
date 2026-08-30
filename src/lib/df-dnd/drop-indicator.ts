/** Per slot drop indicator placement for hosts that render a drop line. */

export type DropIndicatorPlacement = "before" | "after" | "into"

export type DropIndicatorState = {
  targetId: string | null
  placement: DropIndicatorPlacement | null
}

export const EMPTY_DROP_INDICATOR: DropIndicatorState = {
  targetId: null,
  placement: null,
}

/**
 * Map an insertion index over non dragging item ids to a before/after indicator.
 * `into` is reserved for tree hosts that set it explicitly.
 */
export function dropIndicatorFromInsertIndex(
  insertIndex: number,
  itemIds: readonly string[]
): DropIndicatorState {
  if (itemIds.length === 0) return EMPTY_DROP_INDICATOR
  if (!Number.isFinite(insertIndex)) return EMPTY_DROP_INDICATOR
  if (insertIndex <= 0) {
    return { targetId: itemIds[0] ?? null, placement: "before" }
  }
  if (insertIndex >= itemIds.length) {
    return {
      targetId: itemIds[itemIds.length - 1] ?? null,
      placement: "after",
    }
  }
  return { targetId: itemIds[insertIndex] ?? null, placement: "before" }
}

/** True when the slot should show the given placement. */
export function isDropIndicatorActive(
  state: DropIndicatorState,
  id: string,
  placement: DropIndicatorPlacement
): boolean {
  return state.targetId === id && state.placement === placement
}
