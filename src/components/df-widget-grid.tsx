"use client"

import * as React from "react"

import { useCssPx, useDragGesture, useLatestRef } from "../hooks"
import { prefersReducedMotion } from "../lib/df-dnd"
import { useDfStrings, type DfStrings } from "../lib/df-intl"
import {
  DEFAULT_COLUMNS,
  cellDeltaFromPointer,
  cellMetricsFromGridRect,
  layoutById,
  layoutEquals,
  moveWidget,
  normalizeLayout,
  resizeWidget,
  translateFromCellDelta,
  type WidgetGridCellMetrics,
  type WidgetLayoutItem,
} from "../lib/df-widget-grid"
import { cn } from "../lib/utils"

const DRAG_HANDLE_SELECTOR = "[data-df-widget-drag-handle]"
const DEFAULT_ROW_HEIGHT_PX = 80
const DEFAULT_GAP_PX = 16

export type WidgetGridProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  layout: WidgetLayoutItem[]
  onLayoutChange?: (layout: WidgetLayoutItem[]) => void
  renderWidget: (id: string) => React.ReactNode
  columns?: number
  /** When false, drag, resize, and keyboard edit affordances are disabled. */
  editable?: boolean
  /**
   * Override `--df-widget-grid-row-height` for this instance.
   * Accepts a CSS length such as `5rem` or `80px`.
   */
  minRowHeight?: string
  emptyContent?: React.ReactNode
}

type GestureKind = "move" | "resize-se" | "resize-e" | "resize-s"

type PointerSession = {
  pointerId: number
  kind: GestureKind
  id: string
  origin: WidgetLayoutItem
  startClientX: number
  startClientY: number
  metrics: WidgetGridCellMetrics
}

type GesturePreview = {
  id: string
  kind: GestureKind
  draft: WidgetLayoutItem
  translateX: number
  translateY: number
  scaleX: number
  scaleY: number
}

type KeyboardDraft = {
  id: string
  originLayout: WidgetLayoutItem[]
  draftLayout: WidgetLayoutItem[]
}

function captureGridMetrics(
  root: HTMLElement,
  columns: number,
  rowHeight: number,
  gapFallback: number
): WidgetGridCellMetrics {
  const rect = root.getBoundingClientRect()
  const styles = getComputedStyle(root)
  const gapX =
    Number.parseFloat(styles.columnGap || styles.gap) || gapFallback
  const gapY =
    Number.parseFloat(styles.rowGap || styles.gap) || gapFallback
  return cellMetricsFromGridRect({
    width: rect.width,
    columns,
    rowHeight,
    gapX: Number.isFinite(gapX) ? gapX : gapFallback,
    gapY: Number.isFinite(gapY) ? gapY : gapFallback,
  })
}

function formatWidgetCell(s: DfStrings, item: WidgetLayoutItem): string {
  return s.widgetGridCell({
    column: item.x + 1,
    row: item.y + 1,
    width: item.w,
    height: item.h,
  })
}

function applyGestureDelta(
  kind: GestureKind,
  origin: WidgetLayoutItem,
  dx: number,
  dy: number,
  layout: readonly WidgetLayoutItem[],
  columns: number
): WidgetLayoutItem[] {
  if (kind === "move") {
    return moveWidget(layout, origin.id, origin.x + dx, origin.y + dy, columns)
  }
  let nextW = origin.w
  let nextH = origin.h
  if (kind === "resize-e" || kind === "resize-se") nextW = origin.w + dx
  if (kind === "resize-s" || kind === "resize-se") nextH = origin.h + dy
  return resizeWidget(layout, origin.id, nextW, nextH, columns)
}

function previewFromDelta(
  session: PointerSession,
  clientX: number,
  clientY: number,
  layout: readonly WidgetLayoutItem[],
  columns: number
): GesturePreview {
  const deltaPxX = clientX - session.startClientX
  const deltaPxY = clientY - session.startClientY
  const cellDelta = cellDeltaFromPointer(
    deltaPxX,
    deltaPxY,
    session.metrics
  )
  const nextLayout = applyGestureDelta(
    session.kind,
    session.origin,
    cellDelta.dx,
    cellDelta.dy,
    layout,
    columns
  )
  const draft = layoutById(nextLayout).get(session.id) ?? session.origin
  const snapped = translateFromCellDelta(
    {
      dx: draft.x - session.origin.x,
      dy: draft.y - session.origin.y,
    },
    session.metrics
  )

  if (session.kind === "move") {
    return {
      id: session.id,
      kind: session.kind,
      draft,
      translateX: snapped.x,
      translateY: snapped.y,
      scaleX: 1,
      scaleY: 1,
    }
  }

  const originW = Math.max(session.origin.w * session.metrics.colStride, 1)
  const originH = Math.max(session.origin.h * session.metrics.rowStride, 1)
  const nextW = Math.max(draft.w * session.metrics.colStride, 1)
  const nextH = Math.max(draft.h * session.metrics.rowStride, 1)

  return {
    id: session.id,
    kind: session.kind,
    draft,
    translateX: 0,
    translateY: 0,
    scaleX: nextW / originW,
    scaleY: nextH / originH,
  }
}

function WidgetGrid({
  className,
  layout,
  onLayoutChange,
  renderWidget,
  columns = DEFAULT_COLUMNS,
  editable = true,
  minRowHeight,
  emptyContent,
  style,
  "aria-label": ariaLabel,
  ...props
}: WidgetGridProps) {
  const s = useDfStrings()
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const previewRef = React.useRef<GesturePreview | null>(null)
  const originLayoutRef = React.useRef<WidgetLayoutItem[]>(layout)
  const pointerDrag = useDragGesture()

  const [liveMessage, setLiveMessage] = React.useState("")
  const [activePointer, setActivePointer] = React.useState(false)
  const [preview, setPreview] = React.useState<GesturePreview | null>(null)
  const [keyboardDraft, setKeyboardDraft] =
    React.useState<KeyboardDraft | null>(null)

  const announce = React.useCallback((message: string) => {
    setLiveMessage(message)
  }, [])

  const tokenRowHeight = useCssPx(
    rootRef,
    "--df-widget-grid-row-height",
    DEFAULT_ROW_HEIGHT_PX
  )
  const tokenGap = useCssPx(rootRef, "--df-widget-grid-gap", DEFAULT_GAP_PX)

  const resolvedColumns = Math.max(1, Math.trunc(columns) || DEFAULT_COLUMNS)

  const baseLayout = React.useMemo(
    () => normalizeLayout(layout, resolvedColumns),
    [layout, resolvedColumns]
  )

  const displayLayout = keyboardDraft?.draftLayout ?? baseLayout
  const displayById = React.useMemo(
    () => layoutById(displayLayout),
    [displayLayout]
  )

  const updatePreview = React.useCallback((next: GesturePreview | null) => {
    previewRef.current = next
    setPreview(next)
  }, [])

  const commitLayout = React.useCallback(
    (next: WidgetLayoutItem[], origin: WidgetLayoutItem[]) => {
      const resolved = normalizeLayout(next, resolvedColumns)
      if (layoutEquals(resolved, normalizeLayout(origin, resolvedColumns))) {
        announce(s.widgetGridLayoutUnchanged)
        return
      }
      onLayoutChange?.(resolved)
      announce(s.widgetGridLayoutUpdated)
    },
    [announce, onLayoutChange, resolvedColumns, s]
  )

  const liveRef = useLatestRef({
    announce,
    commitLayout,
    resolvedColumns,
    updatePreview,
    s,
  })

  const beginPointerGesture = React.useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      item: WidgetLayoutItem,
      kind: GestureKind
    ) => {
      if (!editable || event.button !== 0) return
      const root = rootRef.current
      if (!root) return
      event.preventDefault()
      event.stopPropagation()

      originLayoutRef.current = baseLayout
      setKeyboardDraft(null)
      const metrics = captureGridMetrics(
        root,
        resolvedColumns,
        tokenRowHeight,
        tokenGap
      )
      const session: PointerSession = {
        pointerId: event.pointerId,
        kind,
        id: item.id,
        origin: item,
        startClientX: event.clientX,
        startClientY: event.clientY,
        metrics,
      }
      updatePreview({
        id: item.id,
        kind,
        draft: item,
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
      })
      setActivePointer(true)
      const cell = formatWidgetCell(s, item)
      announce(
        kind === "move"
          ? s.widgetGridMoving(cell)
          : s.widgetGridResizing(cell)
      )

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "Escape") return
        keyEvent.preventDefault()
        pointerDrag.end("cancel")
      }
      window.addEventListener("keydown", onKeyDown)

      pointerDrag.begin(event, session, {
        onMove: (moveEvent, activeSession) => {
          const live = liveRef.current
          live.updatePreview(
            previewFromDelta(
              activeSession,
              moveEvent.clientX,
              moveEvent.clientY,
              originLayoutRef.current,
              live.resolvedColumns
            )
          )
        },
        onEnd: (_event, activeSession, reason) => {
          window.removeEventListener("keydown", onKeyDown)
          const currentPreview = previewRef.current
          previewRef.current = null
          setPreview(null)
          setActivePointer(false)
          const live = liveRef.current
          if (
            reason !== "up" ||
            !currentPreview ||
            currentPreview.id !== activeSession.id
          ) {
            if (reason !== "unmount") {
              live.announce(live.s.widgetGridGestureCancelled)
            }
            return
          }
          const committed =
            activeSession.kind === "move"
              ? moveWidget(
                  originLayoutRef.current,
                  activeSession.id,
                  currentPreview.draft.x,
                  currentPreview.draft.y,
                  live.resolvedColumns
                )
              : resizeWidget(
                  originLayoutRef.current,
                  activeSession.id,
                  currentPreview.draft.w,
                  currentPreview.draft.h,
                  live.resolvedColumns
                )
          live.commitLayout(committed, originLayoutRef.current)
        },
      })
    },
    [
      announce,
      baseLayout,
      editable,
      liveRef,
      pointerDrag,
      resolvedColumns,
      s,
      tokenGap,
      tokenRowHeight,
      updatePreview,
    ]
  )

  const onItemPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, item: WidgetLayoutItem) => {
      if (!editable) return
      const target = event.target
      if (!(target instanceof Element)) return
      const handle = target.closest(DRAG_HANDLE_SELECTOR)
      if (!handle || !event.currentTarget.contains(handle)) return
      beginPointerGesture(event, item, "move")
    },
    [beginPointerGesture, editable]
  )

  const onHandleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>, item: WidgetLayoutItem) => {
      if (!editable) return

      if (event.key === "Escape") {
        if (!keyboardDraft || keyboardDraft.id !== item.id) return
        event.preventDefault()
        setKeyboardDraft(null)
        announce(s.widgetGridEditCancelled)
        return
      }

      if (event.key === "Enter") {
        if (!keyboardDraft || keyboardDraft.id !== item.id) return
        event.preventDefault()
        const { originLayout, draftLayout } = keyboardDraft
        setKeyboardDraft(null)
        commitLayout(draftLayout, originLayout)
        return
      }

      const isArrow =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      if (!isArrow) return
      event.preventDefault()

      const originLayout = keyboardDraft?.originLayout ?? baseLayout
      const liveLayout = keyboardDraft?.draftLayout ?? baseLayout
      const live = layoutById(liveLayout).get(item.id) ?? item

      let nextLayout: WidgetLayoutItem[]
      if (event.shiftKey) {
        const dw =
          event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
        const dh =
          event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
        nextLayout = resizeWidget(
          liveLayout,
          item.id,
          live.w + dw,
          live.h + dh,
          resolvedColumns
        )
      } else {
        const dx =
          event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
        const dy =
          event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
        nextLayout = moveWidget(
          liveLayout,
          item.id,
          live.x + dx,
          live.y + dy,
          resolvedColumns
        )
      }

      setKeyboardDraft({
        id: item.id,
        originLayout,
        draftLayout: nextLayout,
      })
      const nextItem = layoutById(nextLayout).get(item.id) ?? live
      const cell = formatWidgetCell(s, nextItem)
      announce(
        event.shiftKey
          ? s.widgetGridResizedCommit(cell)
          : s.widgetGridMovedCommit(cell)
      )
    },
    [
      announce,
      baseLayout,
      commitLayout,
      editable,
      keyboardDraft,
      resolvedColumns,
      s,
    ]
  )

  const isEmpty = displayLayout.length === 0
  const reducedMotion = prefersReducedMotion()

  const rootStyle = {
    ...style,
    "--df-widget-grid-columns": String(resolvedColumns),
    ...(minRowHeight
      ? { "--df-widget-grid-row-height": minRowHeight }
      : {}),
  } as React.CSSProperties

  return (
    <div
      {...props}
      ref={rootRef}
      data-df="widget-grid"
      data-editable={editable ? "true" : "false"}
      data-empty={isEmpty ? "true" : undefined}
      data-dragging={activePointer ? "true" : undefined}
      className={cn("df-widget-grid", className)}
      style={rootStyle}
      role="grid"
      aria-label={ariaLabel ?? s.widgetGridAriaLabel}
      aria-rowcount={
        displayLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0) ||
        1
      }
      aria-colcount={resolvedColumns}
    >
      {isEmpty ? (
        <div
          className="df-widget-grid-empty"
          data-df="widget-grid-empty"
          role="status"
        >
          {emptyContent ?? s.widgetGridEmpty}
        </div>
      ) : (
        displayLayout.map((item) => {
          const activePreview =
            preview?.id === item.id ? preview : null
          const draftItem =
            activePreview?.draft ?? displayById.get(item.id) ?? item
          const ghostItem = activePreview?.draft

          return (
            <React.Fragment key={item.id}>
              <div
                className="df-widget-grid-item"
                data-df="widget-grid-item"
                data-widget-id={item.id}
                data-dragging={activePreview ? "true" : undefined}
                role="gridcell"
                aria-colindex={item.x + 1}
                aria-rowindex={item.y + 1}
                style={{
                  gridColumn: `${item.x + 1} / span ${item.w}`,
                  gridRow: `${item.y + 1} / span ${item.h}`,
                  transform: activePreview
                    ? `translate(${activePreview.translateX}px, ${activePreview.translateY}px) scale(${activePreview.scaleX}, ${activePreview.scaleY})`
                    : undefined,
                  transformOrigin: "top left",
                  transition:
                    activePreview || reducedMotion
                      ? "none"
                      : "transform var(--df-duration-quick) var(--df-ease-standard)",
                }}
                {...(editable
                  ? {
                      onPointerDown: (
                        event: React.PointerEvent<HTMLDivElement>
                      ) => onItemPointerDown(event, item),
                      onKeyDown: (
                        event: React.KeyboardEvent<HTMLDivElement>
                      ) => {
                        const target = event.target
                        if (!(target instanceof Element)) return
                        const onHandle =
                          target.closest(DRAG_HANDLE_SELECTOR) != null ||
                          target.closest(
                            '[data-df="widget-grid-keyboard-handle"]'
                          ) != null
                        if (!onHandle) return
                        onHandleKeyDown(event, item)
                      },
                    }
                  : {})}
              >
                <div className="df-widget-grid-item-body">
                  {renderWidget(item.id)}
                </div>
                {editable ? (
                  <>
                    <button
                      type="button"
                      className="df-widget-grid-keyboard-handle"
                      data-df="widget-grid-keyboard-handle"
                      aria-label={s.widgetGridMoveOrResize(
                        formatWidgetCell(s, draftItem)
                      )}
                    />
                    <span
                      className="df-widget-grid-resize df-widget-grid-resize-e"
                      data-df="widget-grid-resize"
                      data-edge="e"
                      onPointerDown={(event) =>
                        beginPointerGesture(event, item, "resize-e")
                      }
                    />
                    <span
                      className="df-widget-grid-resize df-widget-grid-resize-s"
                      data-df="widget-grid-resize"
                      data-edge="s"
                      onPointerDown={(event) =>
                        beginPointerGesture(event, item, "resize-s")
                      }
                    />
                    <span
                      className="df-widget-grid-resize df-widget-grid-resize-se"
                      data-df="widget-grid-resize"
                      data-edge="se"
                      onPointerDown={(event) =>
                        beginPointerGesture(event, item, "resize-se")
                      }
                    />
                  </>
                ) : null}
              </div>
              {ghostItem ? (
                <div
                  className="df-widget-grid-ghost"
                  data-df="widget-grid-ghost"
                  aria-hidden
                  style={{
                    gridColumn: `${ghostItem.x + 1} / span ${ghostItem.w}`,
                    gridRow: `${ghostItem.y + 1} / span ${ghostItem.h}`,
                  }}
                />
              ) : null}
            </React.Fragment>
          )
        })
      )}

      <div
        className="df-widget-grid-live"
        data-df="widget-grid-live"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </div>
    </div>
  )
}

export { WidgetGrid }
export type { WidgetLayoutItem }
