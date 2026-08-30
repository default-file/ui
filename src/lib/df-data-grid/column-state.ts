export type DataGridColumnState = {
  id: string
  width?: number | undefined
  hidden?: boolean | undefined
}

export type DataGridColumnInput = {
  id: string
  width?: number | undefined
  minWidth?: number | undefined
  hidden?: boolean | undefined
  resizable?: boolean | undefined
}

export type ResolvedDataGridColumn<T extends DataGridColumnInput> = T & {
  width: number
  minWidth: number
  hidden: false
  resizable: boolean
}

export function buildInitialColumnState(
  columns: DataGridColumnInput[]
): DataGridColumnState[] {
  return columns.map((column) => ({
    id: column.id,
    width: column.width,
    hidden: column.hidden,
  }))
}

export function resolveVisibleColumns<T extends DataGridColumnInput>(
  columns: T[],
  state: DataGridColumnState[],
  defaults: { width: number; minWidth: number }
): ResolvedDataGridColumn<T>[] {
  const stateById = new Map(state.map((entry) => [entry.id, entry]))
  const resolved: ResolvedDataGridColumn<T>[] = []

  for (const column of columns) {
    const entry = stateById.get(column.id)
    const hidden = entry?.hidden ?? column.hidden ?? false
    if (hidden) continue
    const minWidth = column.minWidth ?? defaults.minWidth
    const rawWidth = entry?.width ?? column.width ?? defaults.width
    resolved.push({
      ...column,
      width: Math.max(minWidth, rawWidth),
      minWidth,
      hidden: false,
      resizable: column.resizable !== false,
    })
  }

  return resolved
}

export function patchColumnWidth(
  state: DataGridColumnState[],
  columns: DataGridColumnInput[],
  columnId: string,
  width: number
): DataGridColumnState[] {
  const base = state.length > 0 ? state : buildInitialColumnState(columns)
  const byId = new Map(base.map((entry) => [entry.id, entry]))

  return columns.map((column) => {
    const prev = byId.get(column.id)
    if (column.id === columnId) {
      return {
        id: column.id,
        width,
        hidden: prev?.hidden ?? column.hidden,
      }
    }
    return {
      id: column.id,
      width: prev?.width ?? column.width,
      hidden: prev?.hidden ?? column.hidden,
    }
  })
}

export function patchColumnHidden(
  state: DataGridColumnState[],
  columns: DataGridColumnInput[],
  columnId: string,
  hidden: boolean
): DataGridColumnState[] {
  const base = state.length > 0 ? state : buildInitialColumnState(columns)
  const byId = new Map(base.map((entry) => [entry.id, entry]))

  return columns.map((column) => {
    const prev = byId.get(column.id)
    if (column.id === columnId) {
      return {
        id: column.id,
        width: prev?.width ?? column.width,
        hidden,
      }
    }
    return {
      id: column.id,
      width: prev?.width ?? column.width,
      hidden: prev?.hidden ?? column.hidden,
    }
  })
}
