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
import { moveGroupInList, orderedDragIds } from "./multi-drag"
import { indexFromPointerY, moveIndex } from "./reorder"

export type SortableItem = { id: string }

export type SortableAutoScrollOption =
  | boolean
  | {
      containerRef?: RefObject<HTMLElement | null>
      axis?: AutoScrollAxis
    }

export type SortableItemBindings = {
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

export function useSortableList<T extends SortableItem>(options: {
  items: T[]
  onReorder: (items: T[]) => void
  disabled?: boolean
  /** Opt in edge auto scroll while pointer dragging. */
  autoScroll?: SortableAutoScrollOption
  /** Opt in portal ghost; host mounts `DragOverlay` with `overlay`. */
  overlay?: boolean
  /** Opt in multi item drag when the active id is in this set. */
  selectedIds?: ReadonlySet<string> | readonly string[]
  /** Called with ordered movers and insert index after a successful drop. */
  onDropCommit?: (commit: {
    items: T[]
    movingIds: string[]
    insertIndex: number
  }) => void
  /** Opt in per slot drop indicator state. */
  dropIndicators?: boolean
}) {
  const {
    items,
    onReorder,
    disabled = false,
    autoScroll = false,
    overlay = false,
    selectedIds,
    onDropCommit,
    dropIndicators = false,
  } = options
  const instructionsId = useId()
  const itemNodes = useRef(new Map<string, HTMLElement>())
  const itemsRef = useRef(items)
  const selectedRef = useRef(selectedIds)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    selectedRef.current = selectedIds
  }, [selectedIds])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [keyboardActiveId, setKeyboardActiveId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState("")
  const [overlayState, setOverlayState] = useState<DragOverlayState>(
    inactiveDragOverlayState
  )
  const [dropIndicator, setDropIndicator] =
    useState<DropIndicatorState>(EMPTY_DROP_INDICATOR)
  const [dragIds, setDragIds] = useState<string[]>([])
  const pointerId = useRef<number | null>(null)
  const pendingToIndex = useRef<number | null>(null)
  const movingIdsRef = useRef<string[]>([])
  const autoScrollSession = useRef<AutoScrollSession | null>(null)

  const setNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) itemNodes.current.set(id, node)
    else itemNodes.current.delete(id)
  }, [])

  const announce = useCallback((message: string) => {
    setLiveMessage(message)
  }, [])

  const resolveMovingIds = useCallback((id: string, source: T[]) => {
    return orderedDragIds(
      source.map((item) => item.id),
      selectedRef.current,
      id
    )
  }, [])

  const stopAutoScroll = useCallback(() => {
    disposeAutoScrollSession(autoScrollSession)
  }, [])

  const startAutoScroll = useCallback(
    (origin: HTMLElement | null) => {
      if (!autoScroll) return
      stopAutoScroll()
      const config = typeof autoScroll === "object" ? autoScroll : {}
      const axis = config.axis ?? "y"
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

  const commitMove = useCallback(
    (current: T[], movingIds: string[], insertIndex: number) => {
      const next = moveGroupInList(current, movingIds, insertIndex)
      const unchanged =
        next.length === current.length &&
        next.every((item, index) => item.id === current[index]?.id)
      if (unchanged) {
        announce("Reorder finished")
        return
      }
      onReorder(next)
      onDropCommit?.({ items: next, movingIds, insertIndex })
      announce(
        movingIds.length > 1
          ? `Moved ${movingIds.length} items to position ${insertIndex + 1}`
          : `Moved item to position ${insertIndex + 1} of ${current.length}`
      )
    },
    [announce, onDropCommit, onReorder]
  )

  useEffect(() => {
    if (pointerId.current === null || !activeId) return

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId.current) return
      const current = itemsRef.current
      const moving = new Set(movingIdsRef.current)
      const visibleIds = current
        .filter((item) => !moving.has(item.id))
        .map((item) => item.id)
      const rects = visibleIds
        .map((id) => {
          const node = itemNodes.current.get(id)
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
      pendingToIndex.current = insertIndex
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
      const current = itemsRef.current
      const to = pendingToIndex.current
      const movingIds = movingIdsRef.current
      pointerId.current = null
      pendingToIndex.current = null
      setActiveId(null)
      clearDragChrome()
      if (to === null || movingIds.length === 0) {
        announce("Reorder finished")
        return
      }
      commitMove(current, movingIds, to)
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
    commitMove,
    dropIndicators,
    overlay,
    stopAutoScroll,
  ])

  const getItemProps = useCallback(
    (id: string): SortableItemBindings => {
      const index = items.findIndex((item) => item.id === id)
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
        ref: (node) => setNode(id, node),
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
          "aria-roledescription": "sortable",
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
            const movingIds = resolveMovingIds(id, items)
            pointerId.current = event.pointerId
            pendingToIndex.current = index
            movingIdsRef.current = movingIds
            setDragIds(movingIds)
            setActiveId(id)
            setKeyboardActiveId(null)
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
                ? `Picked up ${movingIds.length} items`
                : `Picked up item ${index + 1} of ${items.length}`
            )
            ;(event.currentTarget as HTMLElement).setPointerCapture?.(
              event.pointerId
            )
          },
          onKeyDown: (event) => {
            if (disabled) return
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault()
              if (keyboardActiveId === id) {
                setKeyboardActiveId(null)
                clearDragChrome()
                announce("Item dropped")
                return
              }
              const movingIds = resolveMovingIds(id, items)
              movingIdsRef.current = movingIds
              setDragIds(movingIds)
              setKeyboardActiveId(id)
              setActiveId(null)
              announce(
                movingIds.length > 1
                  ? `${movingIds.length} items grabbed. Use up and down arrows to reorder, Space to drop, Escape to cancel.`
                  : "Item grabbed. Use up and down arrows to reorder, Space to drop, Escape to cancel."
              )
              return
            }
            if (keyboardActiveId !== id) return
            if (event.key === "Escape") {
              event.preventDefault()
              setKeyboardActiveId(null)
              clearDragChrome()
              announce("Reorder cancelled")
              return
            }
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              const movingIds =
                movingIdsRef.current.length > 0
                  ? movingIdsRef.current
                  : resolveMovingIds(id, items)
              const delta = event.key === "ArrowUp" ? -1 : 1
              if (movingIds.length <= 1) {
                const from = items.findIndex((item) => item.id === id)
                if (from < 0) return
                const to = from + delta
                if (to < 0 || to >= items.length) return
                const next = moveIndex(items, from, to)
                onReorder(next)
                onDropCommit?.({
                  items: next,
                  movingIds,
                  insertIndex: to,
                })
                announce(`Moved item to position ${to + 1} of ${items.length}`)
                return
              }
              const firstId = movingIds[0]
              if (!firstId) return
              let insertAmongRemaining = 0
              for (const item of items) {
                if (item.id === firstId) break
                if (!movingIds.includes(item.id)) insertAmongRemaining += 1
              }
              const remainingCount = items.length - movingIds.length
              const nextInsert = insertAmongRemaining + delta
              if (nextInsert < 0 || nextInsert > remainingCount) return
              commitMove(items, movingIds, nextInsert)
            }
          },
        },
      }
    },
    [
      activeId,
      announce,
      clearDragChrome,
      commitMove,
      disabled,
      dragIds,
      dropIndicator.placement,
      dropIndicator.targetId,
      dropIndicators,
      instructionsId,
      items,
      keyboardActiveId,
      onDropCommit,
      onReorder,
      overlay,
      resolveMovingIds,
      setNode,
      startAutoScroll,
    ]
  )

  return {
    activeId: activeId ?? keyboardActiveId,
    getItemProps,
    instructionsId,
    instructions:
      "Press Space or Enter to pick up an item, Arrow keys to move, Space or Enter to drop, Escape to cancel.",
    liveMessage,
    overlay: overlayState,
    dropIndicator,
    movingIds: dragIds,
  }
}
