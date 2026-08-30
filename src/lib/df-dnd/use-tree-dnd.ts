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
import { indexFromPointerY } from "./reorder"
import {
  applyTreeDrop,
  DF_DND_TREE_INDENT_PX,
  resolveTreeDrop,
  type TreeDropTarget,
  type TreeFlatNode,
} from "./tree"

export type TreeDndAutoScrollOption =
  | boolean
  | {
      containerRef?: RefObject<HTMLElement | null>
      axis?: AutoScrollAxis
    }

export type TreeItemBindings = {
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
    "data-df-tree-depth": number
  }
  listeners: {
    onPointerDown: (event: ReactPointerEvent) => void
    onKeyDown: (event: KeyboardEvent) => void
  }
}

/**
 * Nested list reorder foundation over a flat `{ id, parentId, depth }` array.
 * Pointer x offset resolves indent and outdent; Y uses the sortable insert index.
 */
export function useTreeDnd<T extends TreeFlatNode>(options: {
  nodes: readonly T[]
  onChange: (nodes: readonly T[]) => void
  disabled?: boolean
  indentThreshold?: number
  autoScroll?: TreeDndAutoScrollOption
  overlay?: boolean
  dropIndicators?: boolean
  onDropCommit?: (commit: {
    nodes: readonly T[]
    activeId: string
    target: TreeDropTarget
  }) => void
}) {
  const {
    nodes,
    onChange,
    disabled = false,
    indentThreshold = DF_DND_TREE_INDENT_PX,
    autoScroll = false,
    overlay = false,
    dropIndicators = false,
    onDropCommit,
  } = options
  const instructionsId = useId()
  const itemNodes = useRef(new Map<string, HTMLElement>())
  const listNode = useRef<HTMLElement | null>(null)
  const nodesRef = useRef(nodes)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [keyboardActiveId, setKeyboardActiveId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState("")
  const [overlayState, setOverlayState] = useState<DragOverlayState>(
    inactiveDragOverlayState
  )
  const [dropIndicator, setDropIndicator] =
    useState<DropIndicatorState>(EMPTY_DROP_INDICATOR)
  const [pendingTarget, setPendingTarget] = useState<TreeDropTarget | null>(
    null
  )
  const pointerId = useRef<number | null>(null)
  const pendingRef = useRef<TreeDropTarget | null>(null)
  const pointerOffsetX = useRef(0)
  const autoScrollSession = useRef<AutoScrollSession | null>(null)

  const setNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) itemNodes.current.set(id, node)
    else itemNodes.current.delete(id)
  }, [])

  const announce = useCallback((message: string) => {
    setLiveMessage(message)
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
    setPendingTarget(null)
    pendingRef.current = null
    stopAutoScroll()
  }, [stopAutoScroll])

  const resolveFromPointer = useCallback(
    (clientX: number, clientY: number, id: string) => {
      const current = nodesRef.current
      const listLeft =
        listNode.current?.getBoundingClientRect().left ??
        itemNodes.current.get(id)?.getBoundingClientRect().left ??
        clientX
      pointerOffsetX.current = clientX - listLeft
      const visible = current.filter((node) => node.id !== id)
      const rects = visible
        .map((node) => {
          const element = itemNodes.current.get(node.id)
          if (!element) return null
          const rect = element.getBoundingClientRect()
          return {
            id: node.id,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      const insertIndex = indexFromPointerY(clientY, rects)
      const target = resolveTreeDrop({
        nodes: current,
        activeId: id,
        insertIndex,
        pointerOffsetX: pointerOffsetX.current,
        indentThreshold,
      })
      pendingRef.current = target
      setPendingTarget(target)
      if (!target) {
        setDropIndicator(EMPTY_DROP_INDICATOR)
        return null
      }
      if (dropIndicators) {
        const visibleIds = visible.map((node) => node.id)
        const base = dropIndicatorFromInsertIndex(insertIndex, visibleIds)
        if (target.depth > 0 && insertIndex > 0) {
          const previous = visible[insertIndex - 1]
          if (previous && target.targetParentId === previous.id) {
            setDropIndicator({ targetId: previous.id, placement: "into" })
            return target
          }
        }
        setDropIndicator(base)
      }
      return target
    },
    [dropIndicators, indentThreshold]
  )

  useEffect(() => {
    if (pointerId.current === null || !activeId) return

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId.current) return
      resolveFromPointer(event.clientX, event.clientY, activeId)
      autoScrollSession.current?.updatePointer(event.clientX, event.clientY)
      if (overlay) {
        setOverlayState({
          active: true,
          activeId,
          ids: [activeId],
          count: 1,
          x: event.clientX,
          y: event.clientY,
        })
      }
    }

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId.current) return
      const current = nodesRef.current
      const target = pendingRef.current
      pointerId.current = null
      setActiveId(null)
      clearDragChrome()
      if (!target) {
        announce("Tree reorder finished")
        return
      }
      const next = applyTreeDrop(current, activeId, target)
      const unchanged =
        next.length === current.length &&
        next.every(
          (node, index) =>
            node.id === current[index]?.id &&
            node.parentId === current[index]?.parentId &&
            node.depth === current[index]?.depth
        )
      if (unchanged) {
        announce("Tree reorder finished")
        return
      }
      onChange(next)
      onDropCommit?.({ nodes: next, activeId, target })
      announce(`Moved item to depth ${target.depth + 1}`)
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
    onChange,
    onDropCommit,
    overlay,
    resolveFromPointer,
    stopAutoScroll,
  ])

  const getListProps = useCallback(
    () => ({
      ref: (node: HTMLElement | null) => {
        listNode.current = node
      },
    }),
    []
  )

  const getItemProps = useCallback(
    (id: string): TreeItemBindings => {
      const node = nodes.find((entry) => entry.id === id)
      const depth = node?.depth ?? 0
      const isDragging = activeId === id || keyboardActiveId === id
      const isPlaceholder = Boolean(overlay && activeId === id)
      const reduced = prefersReducedMotion()
      const indicatorPlacement =
        dropIndicators && dropIndicator.targetId === id
          ? (dropIndicator.placement ?? undefined)
          : undefined

      return {
        ref: (element) => setNode(id, element),
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
          "aria-roledescription": "tree item",
          "aria-grabbed": isDragging,
          "aria-describedby": instructionsId,
          "data-df-tree-depth": depth,
          ...(isPlaceholder ? { "data-df-dnd-placeholder": true } : null),
          ...(indicatorPlacement
            ? { "data-df-drop-indicator": indicatorPlacement }
            : null),
        },
        listeners: {
          onPointerDown: (event) => {
            if (disabled || event.button !== 0) return
            event.preventDefault()
            pointerId.current = event.pointerId
            setActiveId(id)
            setKeyboardActiveId(null)
            startAutoScroll(event.currentTarget as HTMLElement)
            resolveFromPointer(event.clientX, event.clientY, id)
            if (overlay) {
              setOverlayState({
                active: true,
                activeId: id,
                ids: [id],
                count: 1,
                x: event.clientX,
                y: event.clientY,
              })
            }
            announce("Picked up tree item")
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
                announce("Tree item dropped")
                return
              }
              setKeyboardActiveId(id)
              setActiveId(null)
              announce(
                "Tree item grabbed. Arrow up and down reorder. Arrow left and right change depth. Space drops. Escape cancels."
              )
              return
            }
            if (keyboardActiveId !== id) return
            if (event.key === "Escape") {
              event.preventDefault()
              setKeyboardActiveId(null)
              clearDragChrome()
              announce("Tree reorder cancelled")
              return
            }
            const index = nodes.findIndex((entry) => entry.id === id)
            if (index < 0) return
            const current = nodes[index]
            if (!current) return
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              const siblings = nodes.filter(
                (entry) => entry.parentId === current.parentId
              )
              const siblingIndex = siblings.findIndex((entry) => entry.id === id)
              const nextSiblingIndex =
                event.key === "ArrowUp" ? siblingIndex - 1 : siblingIndex + 1
              if (
                nextSiblingIndex < 0 ||
                nextSiblingIndex >= siblings.length
              ) {
                return
              }
              const target: TreeDropTarget = {
                targetParentId: current.parentId,
                index: nextSiblingIndex,
                depth: current.depth,
              }
              const next = applyTreeDrop(nodes, id, target)
              onChange(next)
              onDropCommit?.({ nodes: next, activeId: id, target })
              announce(`Moved tree item to position ${nextSiblingIndex + 1}`)
              return
            }
            if (event.key === "ArrowRight") {
              event.preventDefault()
              if (index === 0) return
              const previous = nodes[index - 1]
              if (!previous || previous.depth !== current.depth) return
              const target: TreeDropTarget = {
                targetParentId: previous.id,
                index: 0,
                depth: current.depth + 1,
              }
              const next = applyTreeDrop(nodes, id, target)
              onChange(next)
              onDropCommit?.({ nodes: next, activeId: id, target })
              announce("Indented tree item")
              return
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault()
              if (current.depth === 0 || current.parentId == null) return
              const parent = nodes.find(
                (entry) => entry.id === current.parentId
              )
              if (!parent) return
              const parentSiblingIndex =
                nodes
                  .filter((entry) => entry.parentId === parent.parentId)
                  .findIndex((entry) => entry.id === parent.id) + 1
              const target: TreeDropTarget = {
                targetParentId: parent.parentId,
                index: parentSiblingIndex,
                depth: parent.depth,
              }
              const next = applyTreeDrop(nodes, id, target)
              onChange(next)
              onDropCommit?.({ nodes: next, activeId: id, target })
              announce("Outdented tree item")
            }
          },
        },
      }
    },
    [
      activeId,
      announce,
      clearDragChrome,
      disabled,
      dropIndicator.placement,
      dropIndicator.targetId,
      dropIndicators,
      instructionsId,
      keyboardActiveId,
      nodes,
      onChange,
      onDropCommit,
      overlay,
      resolveFromPointer,
      setNode,
      startAutoScroll,
    ]
  )

  return {
    activeId: activeId ?? keyboardActiveId,
    getItemProps,
    getListProps,
    instructionsId,
    instructions:
      "Press Space or Enter to pick up a tree item. Arrow up and down reorder. Arrow left and right change depth. Space drops. Escape cancels.",
    liveMessage,
    overlay: overlayState,
    dropIndicator,
    pendingTarget,
  }
}
