export type DataGridSelectionMode = "none" | "single" | "multi"

export type SelectionClickInput = {
  mode: DataGridSelectionMode
  selectedIds: string[]
  rowId: string
  rowIndex: number
  rowIds: string[]
  shiftKey: boolean
  anchorIndex: number | null
}

export type SelectionClickResult = {
  selectedIds: string[]
  anchorIndex: number | null
}

/** Compute the next selected id set for a row activation, including shift range multi select. */
export function nextSelectionFromClick(
  input: SelectionClickInput
): SelectionClickResult {
  const { mode, selectedIds, rowId, rowIndex, rowIds, shiftKey, anchorIndex } =
    input

  if (mode === "none") {
    return { selectedIds: [], anchorIndex: null }
  }

  if (mode === "single") {
    return { selectedIds: [rowId], anchorIndex: rowIndex }
  }

  if (shiftKey && anchorIndex != null && rowIds.length > 0) {
    const start = Math.min(anchorIndex, rowIndex)
    const end = Math.max(anchorIndex, rowIndex)
    return {
      selectedIds: rowIds.slice(start, end + 1),
      anchorIndex,
    }
  }

  const exists = selectedIds.includes(rowId)
  const next = exists
    ? selectedIds.filter((id) => id !== rowId)
    : [...selectedIds, rowId]

  return { selectedIds: next, anchorIndex: rowIndex }
}

export function toggleAllSelection(
  selectedIds: string[],
  rowIds: string[]
): string[] {
  if (rowIds.length === 0) return []
  const allSelected = rowIds.every((id) => selectedIds.includes(id))
  return allSelected ? [] : [...rowIds]
}
