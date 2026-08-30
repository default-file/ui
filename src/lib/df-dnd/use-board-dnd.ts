"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"

import { type AutoScrollAxis } from "./auto-scroll"
import {
  disposeAutoScrollSession,
  findScrollableAncestor,
  startAutoScrollSession,
  type AutoScrollSession,
} from "./auto-scroll-runtime"
import {
  inactiveDragOverlayState,
  type DragOverlayState,
} from "./drag-overlay"
import {
  dropIndicatorFromInsertIndex,
  EMPTY_DROP_INDICATOR,
  type DropIndicatorState,
} from "./drop-indicator"
import { prefersReducedMotion } from "./motion"
import {
  boardVisualOrder,
  moveBoardGroup,
  orderedDragIds,
} from "./multi-drag"
import {
  indexFromPointerY,
  moveBoardItem,
  type BoardColumn,
} from "./reorder"

export type BoardCard = { id: string }

export type BoardAutoScrollOption =
  | boolean
  | {
      containerRef?: RefObject<HTMLElement | null>
      axis?: AutoScrollAxis
    }

export type BoardCardBindings = {
  ref: (node: HTMLElement | null) => void
  style: CSSProperties
  isDragging: boolean
  isPlaceholder: boolean
  attributes: {
    role: "button"
    tabIndex: number
    "aria-roledescription": string
    "aria-grabbed": boolean
    "aria-describedby": string
    "data-df-dnd-placeholder"?: boolean
    "data-df-drop-indicator"?: "before" | "after" | "into"
  }
  listeners: {
    onPointerDown: (event: ReactPointerEvent) => void
    onKeyDown: (event: KeyboardEvent) => void
  }
}

export type BoardColumnBindings = {
  ref: (node: HTMLElement | null) => void
  "data-df-board-column": string
  "data-df-drop-active": boolean
}

type PendingDrop = {
  columnId: string
  index: number
}

export function useBoardDnd<T extends BoardCard>(options: {
  columns: BoardColumn<T>[]
  onChange: (columns: BoardColumn<T>[]) => void
  disabled?: boolean
  /** Opt in edge auto scroll while pointer dragging. */
  autoScroll?: BoardAutoScrollOption
  /** Opt in portal ghost; host mounts `DragOverlay` with `overlay`. */
  overlay?: boolean
  /** Opt in multi item drag when the active id is in this set. */
  selectedIds?: ReadonlySet<string> | readonly string[]
  /** Called with ordered movers and insertion point after a successful drop. */
  onDropCommit?: (commit: {
    columns: BoardColumn<T>[]
    movingIds: string[]
    columnId: string
    insertIndex: number
  }) => void
  /** Opt in per slot drop indicator state. */
  dropIndicators?: boolean
}) {
  const {
    columns,
    onChange,
    disabled = false,
    autoScroll = false,
    overlay = false,
    selectedIds,
    onDropCommit,
    dropIndicators = false,
  } = options
  const instructionsId = useId()
  const cardNodes = useRef(new Map<string, HTMLElement>())
  const columnNodes = useRef(new Map<string, HTMLElement>())
  const columnsRef = useRef(columns)
  const selectedRef = useRef(selectedIds)

  useEffect(() => {
    columnsRef.current = columns
  }, [columns])

  useEffect(() => {
    selectedRef.current = selectedIds
  }, [selectedIds])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [keyboardActiveId, setKeyboardActiveId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState("")
  const [overlayState, setOverlayState] = useState<DragOverlayState>(
    inactiveDragOverlayState
  )
  const [dropIndicator, setDropIndicator] =
    useState<DropIndicatorState>(EMPTY_DROP_INDICATOR)
  const [dragIds, setDragIds] = useState<string[]>([])
  const pointerId = useRef<number | null>(null)
  const pendingDrop = useRef<PendingDrop | null>(null)
  const movingIdsRef = useRef<string[]>([])
  const autoScrollSession = useRef<AutoScrollSession | null>(null)

  const announce = useCallback((message: string) => {
    setLiveMessage(message)
  }, [])

  const findLocation = useCallback((itemId: string, source = columns) => {
    for (let columnIndex = 0; columnIndex < source.length; columnIndex += 1) {
      const column = source[columnIndex]
      if (!column) continue
      const itemIndex = column.items.findIndex((item) => item.id === itemId)
      if (itemIndex >= 0) {
        return { columnId: column.id, columnIndex, itemIndex }
      }
    }
    return null
  }, [columns])

  const setCardNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) cardNodes.current.set(id, node)
    else cardNodes.current.delete(id)
  }, [])

  const setColumnNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) columnNodes.current.set(id, node)
    else columnNodes.current.delete(id)
  }, [])

  const columnFromPoint = useCallback((clientX: number, clientY: number) => {
    for (const [columnId, node] of columnNodes.current) {
      const rect = node.getBoundingClientRect()
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return columnId
      }
    }
    return null
  }, [])

  const resolveMovingIds = useCallback((id: string, source: BoardColumn<T>[]) => {
    return orderedDragIds(boardVisualOrder(source), selectedRef.current, id)
  }, [])

  const stopAutoScroll = useCallback(() => {
    disposeAutoScrollSession(autoScrollSession)
  }, [])

  const startAutoScroll = useCallback(
    (origin: HTMLElement | null) => {
      if (!autoScroll) return
      stopAutoScroll()
      const config = typeof autoScroll === "object" ? autoScroll : {}
      const axis = config.axis ?? "both"
      autoScrollSession.current = startAutoScrollSession({
        axis,
        getContainer: () =>
          config.containerRef?.current ??
          findScrollableAncestor(origin, axis),
      })
    },
    [autoScroll, stopAutoScroll]
  )

  const clearDragChrome = useCallback(() => {
    setOverlayState(inactiveDragOverlayState())
    setDropIndicator(EMPTY_DROP_INDICATOR)
    setDragIds([])
    movingIdsRef.current = []
    stopAutoScroll()
  }, [stopAutoScroll])

  const commitDrop = useCallback(
    (
      current: BoardColumn<T>[],
      movingIds: string[],
      columnId: string,
      insertIndex: number
    ) => {
      const next = moveBoardGroup(current, movingIds, columnId, insertIndex)
      const unchanged = columnsEqual(current, next)
      if (unchanged) {
        announce("Board move finished")
        return
      }
      onChange(next)
      onDropCommit?.({
        columns: next,
        movingIds,
        columnId,
        insertIndex,
      })
      announce(
        movingIds.length > 1
          ? `Moved ${movingIds.length} cards to column ${columnId}, position ${insertIndex + 1}`
          : `Moved card to column ${columnId}, position ${insertIndex + 1}`
      )
    },
    [announce, onChange, onDropCommit]
  )

  useEffect(() => {
    if (pointerId.current === null || !activeId) return

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId.current) return
      const current = columnsRef.current
      const columnId = columnFromPoint(event.clientX, event.clientY)
      if (!columnId) return
      setOverColumnId(columnId)
      const column = current.find((entry) => entry.id === columnId)
      if (!column) return
      const moving = new Set(movingIdsRef.current)
      const visibleIds = column.items
        .filter((item) => !moving.has(item.id))
        .map((item) => item.id)
      const rects = visibleIds
        .map((id) => {
          const node = cardNodes.current.get(id)
          if (!node) return null
          const rect = node.getBoundingClientRect()
          return {
            id,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      const insertIndex = indexFromPointerY(event.clientY, rects)
      pendingDrop.current = { columnId, index: insertIndex }
      if (dropIndicators) {
        setDropIndicator(dropIndicatorFromInsertIndex(insertIndex, visibleIds))
      }
      autoScrollSession.current?.updatePointer(event.clientX, event.clientY)
      if (overlay) {
        setOverlayState({
          active: true,
          activeId,
          ids: movingIdsRef.current,
          count: movingIdsRef.current.length,
          x: event.clientX,
          y: event.clientY,
        })
      }
    }

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId.current) return
      const current = columnsRef.current
      const drop = pendingDrop.current
      const movingIds = movingIdsRef.current
      pointerId.current = null
      pendingDrop.current = null
      setActiveId(null)
      setOverColumnId(null)
      clearDragChrome()
      if (!drop || movingIds.length === 0) {
        announce("Board move finished")
        return
      }
      commitDrop(current, movingIds, drop.columnId, drop.index)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      stopAutoScroll()
    }
  }, [
    activeId,
    announce,
    clearDragChrome,
    columnFromPoint,
    commitDrop,
    dropIndicators,
    overlay,
    stopAutoScroll,
  ])

  const getColumnProps = useCallback(
    (columnId: string): BoardColumnBindings => ({
      ref: (node) => setColumnNode(columnId, node),
      "data-df-board-column": columnId,
      "data-df-drop-active": overColumnId === columnId,
    }),
    [overColumnId, setColumnNode]
  )

  const getCardProps = useCallback(
    (id: string): BoardCardBindings => {
      const location = findLocation(id)
      const inPayload = dragIds.includes(id)
      const isDragging =
        activeId === id || keyboardActiveId === id || inPayload
      const isPlaceholder = Boolean(overlay && activeId && inPayload)
      const reduced = prefersReducedMotion()
      const indicatorPlacement =
        dropIndicators && dropIndicator.targetId === id
          ? (dropIndicator.placement ?? undefined)
          : undefined

      return {
        ref: (node) => setCardNode(id, node),
        isDragging,
        isPlaceholder,
        style: {
          opacity: isPlaceholder
            ? undefined
            : isDragging
              ? "var(--opacity-subtle)"
              : undefined,
          transform:
            !overlay && isDragging && activeId === id && !reduced
              ? "scale(var(--df-dnd-lift-scale))"
              : undefined,
          transition: reduced
            ? "none"
            : "transform var(--df-duration-quick) var(--df-ease-standard), opacity var(--df-duration-quick) var(--df-ease-standard)",
          touchAction: "none",
          zIndex: isDragging && !overlay ? "var(--z-raised)" : undefined,
        },
        attributes: {
          role: "button",
          tabIndex: disabled ? -1 : 0,
          "aria-roledescription": "board card",
          "aria-grabbed": isDragging,
          "aria-describedby": instructionsId,
          ...(isPlaceholder ? { "data-df-dnd-placeholder": true } : null),
          ...(indicatorPlacement
            ? { "data-df-drop-indicator": indicatorPlacement }
            : null),
        },
        listeners: {
          onPointerDown: (event) => {
            if (disabled || event.button !== 0) return
            event.preventDefault()
            const movingIds = resolveMovingIds(id, columns)
            pointerId.current = event.pointerId
            pendingDrop.current = location
              ? { columnId: location.columnId, index: location.itemIndex }
              : null
            movingIdsRef.current = movingIds
            setDragIds(movingIds)
            setActiveId(id)
            setKeyboardActiveId(null)
            setOverColumnId(location?.columnId ?? null)
            startAutoScroll(event.currentTarget as HTMLElement)
            if (overlay) {
              setOverlayState({
                active: true,
                activeId: id,
                ids: movingIds,
                count: movingIds.length,
                x: event.clientX,
                y: event.clientY,
              })
            }
            announce(
              movingIds.length > 1
                ? `Picked up ${movingIds.length} board cards`
                : "Picked up board card"
            )
            ;(event.currentTarget as HTMLElement).setPointerCapture?.(
              event.pointerId
            )
          },
          onKeyDown: (event) => {
            if (disabled || !location) return
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault()
              if (keyboardActiveId === id) {
                setKeyboardActiveId(null)
                clearDragChrome()
                announce("Card dropped")
                return
              }
              const movingIds = resolveMovingIds(id, columns)
              movingIdsRef.current = movingIds
              setDragIds(movingIds)
              setKeyboardActiveId(id)
              setActiveId(null)
              announce(
                movingIds.length > 1
                  ? `${movingIds.length} cards grabbed. Arrow keys move within or across columns. Space drops. Escape cancels.`
                  : "Card grabbed. Arrow keys move within or across columns. Space drops. Escape cancels."
              )
              return
            }
            if (keyboardActiveId !== id) return
            if (event.key === "Escape") {
              event.preventDefault()
              setKeyboardActiveId(null)
              clearDragChrome()
              announce("Board move cancelled")
              return
            }
            const movingIds =
              movingIdsRef.current.length > 0
                ? movingIdsRef.current
                : resolveMovingIds(id, columns)
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              const delta = event.key === "ArrowUp" ? -1 : 1
              if (movingIds.length <= 1) {
                const toIndex = location.itemIndex + delta
                if (toIndex < 0) return
                onChange(
                  moveBoardItem(columns, id, location.columnId, toIndex)
                )
                announce(`Moved within column to position ${toIndex + 1}`)
                return
              }
              const column = columns[location.columnIndex]
              if (!column) return
              let insertAmong = 0
              for (const item of column.items) {
                if (item.id === movingIds[0]) break
                if (!movingIds.includes(item.id)) insertAmong += 1
              }
              const remainingInColumn = column.items.filter(
                (item) => !movingIds.includes(item.id)
              ).length
              const nextInsert = insertAmong + delta
              if (nextInsert < 0 || nextInsert > remainingInColumn) return
              commitDrop(columns, movingIds, location.columnId, nextInsert)
              return
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault()
              const columnDelta = event.key === "ArrowLeft" ? -1 : 1
              const nextColumn = columns[location.columnIndex + columnDelta]
              if (!nextColumn) return
              const toIndex = Math.min(
                location.itemIndex,
                nextColumn.items.length
              )
              if (movingIds.length <= 1) {
                onChange(moveBoardItem(columns, id, nextColumn.id, toIndex))
                announce(`Moved card to column ${nextColumn.id}`)
                return
              }
              commitDrop(columns, movingIds, nextColumn.id, toIndex)
            }
          },
        },
      }
    },
    [
      activeId,
      announce,
      clearDragChrome,
      columns,
      commitDrop,
      disabled,
      dragIds,
      dropIndicator.placement,
      dropIndicator.targetId,
      dropIndicators,
      findLocation,
      instructionsId,
      keyboardActiveId,
      onChange,
      overlay,
      resolveMovingIds,
      setCardNode,
      startAutoScroll,
    ]
  )

  return {
    activeId: activeId ?? keyboardActiveId,
    overColumnId,
    getCardProps,
    getColumnProps,
    instructionsId,
    instructions:
      "Press Space or Enter to pick up a card. Arrow keys move it. Space or Enter drops. Escape cancels.",
    liveMessage,
    overlay: overlayState,
    dropIndicator,
    movingIds: dragIds,
  }
}

function columnsEqual<T extends { id: string }>(
  left: readonly BoardColumn<T>[],
  right: readonly BoardColumn<T>[]
): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i]
    const b = right[i]
    if (!a || !b || a.id !== b.id || a.items.length !== b.items.length) {
      return false
    }
    for (let j = 0; j < a.items.length; j += 1) {
      if (a.items[j]?.id !== b.items[j]?.id) return false
    }
  }
  return true
}
