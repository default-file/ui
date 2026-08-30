"use client"

import * as React from "react"
import { Check } from "lucide-react"

import {
  useControllableState,
  useCssPx,
  useDragGesture,
  useLatestRef,
  useRovingTabIndex,
} from "../hooks"
import {
  buildInitialColumnState,
  moveGridFocus,
  nextSelectionFromClick,
  patchColumnWidth,
  resolveEditSessionEvent,
  resolveVisibleColumns,
  toggleAllSelection,
  type DataGridColumnState,
  type DataGridSelectionMode,
  type GridFocusCell,
} from "../lib/df-data-grid"
import { useDfStrings } from "../lib/df-intl"
import { useVirtualRows } from "../lib/df-virtual"
import { cn, composeEventHandlers } from "../lib/utils"

const SELECT_COLUMN_ID = "__df_select"
const LOADING_ROW_COUNT = 8

export type DataGridRow<T> = {
  id: string
  data: T
}

export type DataGridColumnDef<T> = {
  id: string
  header: React.ReactNode
  width?: number
  minWidth?: number
  /** Upper bound for resize. Defaults to `--df-data-grid-col-max-width`. */
  maxWidth?: number
  resizable?: boolean
  hidden?: boolean
  cell: (row: DataGridRow<T>) => React.ReactNode
  editCell?: (
    row: DataGridRow<T>,
    commit: (value?: unknown) => void
  ) => React.ReactNode
}

export type DataGridProps<T> = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  rows: DataGridRow<T>[]
  columns: DataGridColumnDef<T>[]
  columnState?: DataGridColumnState[]
  defaultColumnState?: DataGridColumnState[]
  onColumnStateChange?: (state: DataGridColumnState[]) => void
  selectionMode?: DataGridSelectionMode
  selectedIds?: string[]
  defaultSelectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  loading?: boolean
  emptyContent?: React.ReactNode
  overscan?: number
  estimateRowSize?: number
}

type ResizeDragData = {
  columnId: string
  startX: number
  startWidth: number
  minWidth: number
  maxWidth: number
}

type ResizableColumnBounds = {
  id: string
  width: number
  minWidth: number
  maxWidth: number
}

/** Single clamp for pointer and keyboard column resize. */
function clampColumnWidth(
  width: number,
  minWidth: number,
  maxWidth: number
): number {
  const low = Math.min(minWidth, maxWidth)
  const high = Math.max(minWidth, maxWidth)
  if (!Number.isFinite(width)) return low
  return Math.min(high, Math.max(low, Math.round(width)))
}

function DataGrid<T>({
  className,
  rows,
  columns,
  columnState: columnStateProp,
  defaultColumnState,
  onColumnStateChange,
  selectionMode = "none",
  selectedIds: selectedIdsProp,
  defaultSelectedIds = [],
  onSelectionChange,
  loading = false,
  emptyContent,
  overscan = 6,
  estimateRowSize: estimateRowSizeProp,
  style,
  "aria-label": ariaLabel,
  ...props
}: DataGridProps<T>) {
  const s = useDfStrings()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const headerScrollRef = React.useRef<HTMLDivElement>(null)
  const bodyScrollRef = React.useRef<HTMLDivElement>(null)
  const selectionAnchorRef = React.useRef<number | null>(null)
  const resizeDrag = useDragGesture()

  const [columnState, setColumnState] = useControllableState<
    DataGridColumnState[]
  >({
    value: columnStateProp,
    defaultValue: defaultColumnState ?? buildInitialColumnState(columns),
    onChange: onColumnStateChange,
  })

  const [selectedIds, setSelectedIds] = useControllableState<string[]>({
    value: selectedIdsProp,
    defaultValue: defaultSelectedIds,
    onChange: onSelectionChange,
  })

  const [focusCell, setFocusCell] = React.useState<GridFocusCell>({
    rowIndex: 0,
    colIndex: 0,
  })
  const [editing, setEditing] = React.useState<{
    rowId: string
    columnId: string
  } | null>(null)

  const defaultColWidth = useCssPx(rootRef, "--df-data-grid-col-width", 160)
  const defaultMinWidth = useCssPx(rootRef, "--df-data-grid-col-min-width", 64)
  const defaultMaxWidth = useCssPx(rootRef, "--df-data-grid-col-max-width", 480)
  const tokenRowHeight = useCssPx(rootRef, "--df-data-grid-row-height", 36)
  const selectColWidth = useCssPx(rootRef, "--df-data-grid-select-col-width", 40)
  const resizeStepPx = useCssPx(rootRef, "--spacing-unit", 4)
  const rowHeight = estimateRowSizeProp ?? tokenRowHeight

  const columnsRef = useLatestRef(columns)
  const setColumnStateRef = useLatestRef(setColumnState)

  const visibleColumns = React.useMemo(() => {
    const resolved = resolveVisibleColumns(columns, columnState, {
      width: defaultColWidth,
      minWidth: defaultMinWidth,
    })
    return resolved.map((column) => {
      const maxWidth = Math.max(
        column.minWidth,
        column.maxWidth ?? defaultMaxWidth
      )
      return {
        ...column,
        maxWidth,
        width: clampColumnWidth(column.width, column.minWidth, maxWidth),
      }
    })
  }, [
    columnState,
    columns,
    defaultColWidth,
    defaultMaxWidth,
    defaultMinWidth,
  ])

  const resizableColumns = React.useMemo(
    () => visibleColumns.filter((column) => column.resizable),
    [visibleColumns]
  )
  // Up/Down move between handles so Left/Right stay free for column resize.
  const resizeRoving = useRovingTabIndex({
    count: resizableColumns.length,
    orientation: "vertical",
    loop: true,
  })

  const showSelectColumn = selectionMode === "multi"
  const focusColCount = visibleColumns.length + (showSelectColumn ? 1 : 0)
  const totalWidth =
    visibleColumns.reduce((sum, column) => sum + column.width, 0) +
    (showSelectColumn ? selectColWidth : 0)

  const rowIds = React.useMemo(() => rows.map((row) => row.id), [rows])

  const { items, totalSize, measureElement } = useVirtualRows({
    count: loading || rows.length === 0 ? 0 : rows.length,
    estimateSize: rowHeight,
    getScrollElement: () => bodyScrollRef.current,
    overscan,
  })

  const syncHeaderScroll = React.useCallback(() => {
    const body = bodyScrollRef.current
    const header = headerScrollRef.current
    if (!body || !header) return
    if (header.scrollLeft !== body.scrollLeft) {
      header.scrollLeft = body.scrollLeft
    }
  }, [])

  const applySelection = React.useCallback(
    (rowId: string, rowIndex: number, shiftKey: boolean) => {
      if (selectionMode === "none") return
      const next = nextSelectionFromClick({
        mode: selectionMode,
        selectedIds,
        rowId,
        rowIndex,
        rowIds,
        shiftKey,
        anchorIndex: selectionAnchorRef.current,
      })
      selectionAnchorRef.current = next.anchorIndex
      setSelectedIds(next.selectedIds)
    },
    [rowIds, selectedIds, selectionMode, setSelectedIds]
  )

  const exitEdit = React.useCallback(() => {
    setEditing(null)
  }, [])

  const commitEdit = React.useCallback(
    (value?: unknown) => {
      void value
      exitEdit()
    },
    [exitEdit]
  )

  const beginEdit = React.useCallback(
    (rowId: string, columnId: string) => {
      const column = visibleColumns.find((entry) => entry.id === columnId)
      if (!column?.editCell) return
      setEditing({ rowId, columnId })
    },
    [visibleColumns]
  )

  const applyEditSessionAction = React.useCallback(
    (action: ReturnType<typeof resolveEditSessionEvent>) => {
      if (action === "commit") commitEdit()
      else if (action === "cancel") exitEdit()
    },
    [commitEdit, exitEdit]
  )

  const focusColId = React.useCallback(
    (colIndex: number): string | null => {
      if (showSelectColumn && colIndex === 0) return SELECT_COLUMN_ID
      const dataIndex = showSelectColumn ? colIndex - 1 : colIndex
      return visibleColumns[dataIndex]?.id ?? null
    },
    [showSelectColumn, visibleColumns]
  )

  const onGridKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (editing) return

      const nextFocus = moveGridFocus(focusCell, event.key, {
        rowCount: rows.length,
        colCount: focusColCount,
        pageSize: Math.max(
          1,
          Math.floor(
            (bodyScrollRef.current?.clientHeight ?? rowHeight * 8) / rowHeight
          )
        ),
      })

      if (nextFocus) {
        event.preventDefault()
        setFocusCell(nextFocus)
        return
      }

      if (event.key === "Enter" && rows.length > 0) {
        const columnId = focusColId(focusCell.colIndex)
        const row = rows[focusCell.rowIndex]
        if (!row || !columnId || columnId === SELECT_COLUMN_ID) return
        event.preventDefault()
        beginEdit(row.id, columnId)
        return
      }

      if (
        (event.key === " " || event.key === "Spacebar") &&
        selectionMode !== "none"
      ) {
        const row = rows[focusCell.rowIndex]
        if (!row) return
        event.preventDefault()
        applySelection(row.id, focusCell.rowIndex, event.shiftKey)
      }
    },
    [
      applySelection,
      beginEdit,
      editing,
      focusCell,
      focusColCount,
      focusColId,
      rowHeight,
      rows,
      selectionMode,
    ]
  )

  const onResizePointerDown = React.useCallback(
    (
      event: React.PointerEvent<HTMLSpanElement>,
      column: ResizableColumnBounds
    ) => {
      event.preventDefault()
      const data: ResizeDragData = {
        columnId: column.id,
        startX: event.clientX,
        startWidth: column.width,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
      }
      resizeDrag.begin(event, data, {
        onMove: (moveEvent, session) => {
          const delta = moveEvent.clientX - session.startX
          const nextWidth = clampColumnWidth(
            session.startWidth + delta,
            session.minWidth,
            session.maxWidth
          )
          setColumnStateRef.current((prev) =>
            patchColumnWidth(
              prev,
              columnsRef.current,
              session.columnId,
              nextWidth
            )
          )
        },
      })
    },
    [columnsRef, resizeDrag, setColumnStateRef]
  )

  const applyResizeWidth = React.useCallback(
    (columnId: string, nextWidth: number, minWidth: number, maxWidth: number) => {
      setColumnState((prev) =>
        patchColumnWidth(
          prev,
          columns,
          columnId,
          clampColumnWidth(nextWidth, minWidth, maxWidth)
        )
      )
    },
    [columns, setColumnState]
  )

  const onResizeKeyDown = React.useCallback(
    (
      event: React.KeyboardEvent<HTMLSpanElement>,
      column: ResizableColumnBounds,
      rovingKeyDown: (event: React.KeyboardEvent) => void
    ) => {
      const step = event.shiftKey ? resizeStepPx * 8 : resizeStepPx
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        applyResizeWidth(
          column.id,
          column.width - step,
          column.minWidth,
          column.maxWidth
        )
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        applyResizeWidth(
          column.id,
          column.width + step,
          column.minWidth,
          column.maxWidth
        )
        return
      }
      // Home/End set the column to its bounds before the roving handler sees them.
      if (event.key === "Home") {
        event.preventDefault()
        applyResizeWidth(
          column.id,
          column.minWidth,
          column.minWidth,
          column.maxWidth
        )
        return
      }
      if (event.key === "End") {
        event.preventDefault()
        applyResizeWidth(
          column.id,
          column.maxWidth,
          column.minWidth,
          column.maxWidth
        )
        return
      }
      rovingKeyDown(event)
    },
    [applyResizeWidth, resizeStepPx]
  )

  React.useEffect(() => {
    if (editing) return
    const root = rootRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>(
      `[data-df="data-grid-cell"][data-row-index="${focusCell.rowIndex}"][data-col-index="${focusCell.colIndex}"]`
    )
    active?.focus({ preventScroll: true })
  }, [editing, focusCell, items])

  const allSelected =
    rows.length > 0 && rows.every((row) => selectedIds.includes(row.id))
  const someSelected = selectedIds.length > 0 && !allSelected
  const isEmpty = !loading && rows.length === 0

  return (
    <div
      {...props}
      ref={rootRef}
      data-df="data-grid"
      data-selection={selectionMode}
      data-loading={loading ? "true" : undefined}
      data-empty={isEmpty ? "true" : undefined}
      className={cn("df-data-grid", className)}
      style={style}
      role="grid"
      aria-label={ariaLabel ?? s.dataGridAriaLabel}
      aria-rowcount={loading ? LOADING_ROW_COUNT + 1 : rows.length + 1}
      aria-busy={loading || undefined}
      tabIndex={-1}
      onKeyDown={(event) => {
        composeEventHandlers(props.onKeyDown, onGridKeyDown)(event)
      }}
    >
      <div
        ref={headerScrollRef}
        className="df-data-grid-header-scroll"
        data-df="data-grid-header-scroll"
      >
        <div
          className="df-data-grid-header"
          data-df="data-grid-header"
          role="row"
          aria-rowindex={1}
          style={{ width: totalWidth }}
        >
          {showSelectColumn ? (
            <div
              className="df-data-grid-header-cell df-data-grid-select-cell"
              data-df="data-grid-columnheader"
              role="columnheader"
              aria-colindex={1}
              style={{
                width: "var(--df-data-grid-select-col-width)",
                minWidth: "var(--df-data-grid-select-col-width)",
              }}
            >
              <button
                type="button"
                className="df-data-grid-check"
                data-df="data-grid-check"
                role="checkbox"
                data-state={
                  allSelected
                    ? "checked"
                    : someSelected
                      ? "indeterminate"
                      : "unchecked"
                }
                aria-label={
                  allSelected
                    ? s.dataGridDeselectAllRows
                    : s.dataGridSelectAllRows
                }
                aria-checked={allSelected ? true : someSelected ? "mixed" : false}
                onClick={() => setSelectedIds(toggleAllSelection(selectedIds, rowIds))}
              >
                {allSelected || someSelected ? (
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : null}
              </button>
            </div>
          ) : null}
          {visibleColumns.map((column, index) => {
            const colIndex = index + (showSelectColumn ? 1 : 0)
            const resizeIndex = column.resizable
              ? resizableColumns.findIndex((entry) => entry.id === column.id)
              : -1
            const resizeRovingProps =
              resizeIndex >= 0
                ? resizeRoving.getItemProps(resizeIndex)
                : null
            const columnLabel =
              typeof column.header === "string" ? column.header : column.id
            return (
              <div
                key={column.id}
                className="df-data-grid-header-cell"
                data-df="data-grid-columnheader"
                role="columnheader"
                aria-colindex={colIndex + 1}
                style={{
                  width: column.width,
                  minWidth: column.minWidth,
                  maxWidth: column.maxWidth,
                }}
              >
                <span className="df-data-grid-header-label">{column.header}</span>
                {column.resizable && resizeRovingProps ? (
                  <span
                    className="df-data-grid-resize"
                    data-df="data-grid-resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-valuenow={Math.round(column.width)}
                    aria-valuemin={column.minWidth}
                    aria-valuemax={column.maxWidth}
                    aria-label={s.dataGridResizeColumn(columnLabel)}
                    tabIndex={resizeRovingProps.tabIndex}
                    ref={resizeRovingProps.ref}
                    onFocus={resizeRovingProps.onFocus}
                    onPointerDown={(event) => onResizePointerDown(event, column)}
                    onKeyDown={(event) =>
                      onResizeKeyDown(
                        event,
                        column,
                        resizeRovingProps.onKeyDown
                      )
                    }
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div
        ref={bodyScrollRef}
        className="df-data-grid-body"
        data-df="data-grid-body"
        onScroll={syncHeaderScroll}
      >
        {loading ? (
          <div
            className="df-data-grid-loading"
            data-df="data-grid-loading"
            style={{ width: totalWidth }}
          >
            {Array.from({ length: LOADING_ROW_COUNT }, (_, rowIndex) => (
              <div
                key={`loading-${rowIndex}`}
                className="df-data-grid-row"
                data-df="data-grid-row"
                role="row"
                aria-rowindex={rowIndex + 2}
                style={{ width: totalWidth, height: rowHeight }}
              >
                {showSelectColumn ? (
                  <div
                    className="df-data-grid-cell df-data-grid-select-cell"
                    role="gridcell"
                    style={{
                      width: "var(--df-data-grid-select-col-width)",
                      minWidth: "var(--df-data-grid-select-col-width)",
                    }}
                  >
                    <span className="df-data-grid-skeleton" />
                  </div>
                ) : null}
                {visibleColumns.map((column) => (
                  <div
                    key={column.id}
                    className="df-data-grid-cell"
                    role="gridcell"
                    style={{
                      width: column.width,
                      minWidth: column.minWidth,
                      maxWidth: column.maxWidth,
                    }}
                  >
                    <span className="df-data-grid-skeleton" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div
            className="df-data-grid-empty"
            data-df="data-grid-empty"
            aria-live="polite"
          >
            {emptyContent ?? s.dataGridEmpty}
          </div>
        ) : (
          <div
            className="df-data-grid-rows"
            data-df="data-grid-rows"
            style={{ height: totalSize, width: totalWidth }}
          >
            {items.map((item) => {
              const row = rows[item.index]
              if (!row) return null
              const selected = selectedIds.includes(row.id)
              return (
                <div
                  key={row.id}
                  ref={measureElement}
                  data-index={item.index}
                  className="df-data-grid-row"
                  data-df="data-grid-row"
                  data-selected={selected ? "true" : undefined}
                  role="row"
                  aria-rowindex={item.index + 2}
                  aria-selected={
                    selectionMode === "none" ? undefined : selected
                  }
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: totalWidth,
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  {showSelectColumn ? (
                    <div
                      className="df-data-grid-cell df-data-grid-select-cell"
                      data-df="data-grid-cell"
                      data-row-index={item.index}
                      data-col-index={0}
                      role="gridcell"
                      tabIndex={
                        focusCell.rowIndex === item.index &&
                        focusCell.colIndex === 0
                          ? 0
                          : -1
                      }
                      style={{
                        width: "var(--df-data-grid-select-col-width)",
                        minWidth: "var(--df-data-grid-select-col-width)",
                      }}
                      onClick={(event) => {
                        setFocusCell({ rowIndex: item.index, colIndex: 0 })
                        applySelection(row.id, item.index, event.shiftKey)
                      }}
                      onFocus={() =>
                        setFocusCell({ rowIndex: item.index, colIndex: 0 })
                      }
                    >
                      <span
                        className="df-data-grid-check"
                        data-df="data-grid-check"
                        data-state={selected ? "checked" : "unchecked"}
                        aria-hidden
                      >
                        {selected ? (
                          <Check className="size-3" strokeWidth={3} />
                        ) : null}
                      </span>
                    </div>
                  ) : null}
                  {visibleColumns.map((column, dataIndex) => {
                    const colIndex = dataIndex + (showSelectColumn ? 1 : 0)
                    const isFocused =
                      focusCell.rowIndex === item.index &&
                      focusCell.colIndex === colIndex
                    const isEditing =
                      editing?.rowId === row.id &&
                      editing.columnId === column.id

                    return (
                      <div
                        key={column.id}
                        className="df-data-grid-cell"
                        data-df="data-grid-cell"
                        data-row-index={item.index}
                        data-col-index={colIndex}
                        data-editing={isEditing ? "true" : undefined}
                        role="gridcell"
                        tabIndex={isFocused ? 0 : -1}
                        style={{
                          width: column.width,
                          minWidth: column.minWidth,
                          maxWidth: column.maxWidth,
                        }}
                        onClick={(event) => {
                          setFocusCell({
                            rowIndex: item.index,
                            colIndex,
                          })
                          if (selectionMode === "single") {
                            applySelection(row.id, item.index, false)
                          } else if (
                            selectionMode === "multi" &&
                            event.shiftKey
                          ) {
                            applySelection(row.id, item.index, true)
                          }
                          if (column.editCell && !event.shiftKey) {
                            beginEdit(row.id, column.id)
                          }
                        }}
                        onFocus={() =>
                          setFocusCell({
                            rowIndex: item.index,
                            colIndex,
                          })
                        }
                        onKeyDown={(event) => {
                          if (!isEditing) return
                          const action = resolveEditSessionEvent({
                            kind: "keydown",
                            key: event.key,
                            defaultPrevented: event.defaultPrevented,
                          })
                          if (action === "ignore") return
                          event.preventDefault()
                          event.stopPropagation()
                          applyEditSessionAction(action)
                        }}
                        onBlur={(event) => {
                          if (!isEditing) return
                          const next = event.relatedTarget
                          const focusRemainsInCell =
                            next instanceof Node &&
                            event.currentTarget.contains(next)
                          const action = resolveEditSessionEvent({
                            kind: "focusout",
                            focusRemainsInCell,
                            defaultPrevented: event.defaultPrevented,
                          })
                          if (action === "ignore") return
                          applyEditSessionAction(action)
                        }}
                      >
                        {isEditing && column.editCell
                          ? column.editCell(row, commitEdit)
                          : column.cell(row)}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export { DataGrid }
export type { DataGridColumnState, DataGridSelectionMode }
