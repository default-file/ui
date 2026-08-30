"use client"

import * as React from "react"

import { useCssPx, useDragGesture, useLatestRef } from "../hooks"
import {
  disposeAutoScrollSession,
  prefersReducedMotion,
  startAutoScrollSession,
  type AutoScrollSession,
} from "../lib/df-dnd"
import { useDfStrings } from "../lib/df-intl"
import {
  anchorsFromBars,
  buildTimelineScale,
  formatTimelineDateRange,
  layoutTimelineBars,
  nudgeTimelineBar,
  reduceTimelineDrag,
  routeDependencyPaths,
  type TimelineBarRect,
  type TimelineDependencyEdge,
  type TimelineDragKind,
  type TimelineVisibleRange,
  type TimelineZoom,
} from "../lib/df-timeline"
import { useVirtualRows } from "../lib/df-virtual"
import { cn } from "../lib/utils"

const LOADING_ROW_COUNT = 8
const DEFAULT_UNIT_PX = 40
const DEFAULT_ROW_HEIGHT = 36
const DEFAULT_LABEL_WIDTH = 220

export type TimelineRow = {
  id: string
  label: React.ReactNode
  start?: string
  due?: string
  progress?: number
  /** CSS custom property name used as the bar fill, e.g. `--success`. */
  colorToken?: string
}

export type TimelineBarChange = {
  start: string
  due: string
}

export type TimelineProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  rows: TimelineRow[]
  dependencies?: TimelineDependencyEdge[]
  zoom?: TimelineZoom
  visibleRange: TimelineVisibleRange
  loading?: boolean
  emptyContent?: React.ReactNode
  overscan?: number
  estimateRowSize?: number
  onBarChange?: (id: string, next: TimelineBarChange) => void
  onRowClick?: (id: string) => void
  renderRowMeta?: (row: TimelineRow) => React.ReactNode
}

type PointerDragSession = {
  pointerId: number
  kind: TimelineDragKind
  rowId: string
  originStart: string
  originDue: string
  originX: number
  originWidth: number
  startClientX: number
  scrollLeftAtStart: number
}

type DragPreview = {
  rowId: string
  kind: TimelineDragKind
  start: string
  due: string
  translateX: number
  widthScale: number
}

type KeyboardDraft = {
  rowId: string
  originStart: string
  originDue: string
  draftStart: string
  draftDue: string
}

function resolveBarDates(row: TimelineRow): TimelineBarChange | null {
  if (!row.start && !row.due) return null
  if (row.start && row.due) return { start: row.start, due: row.due }
  if (row.start) return { start: row.start, due: row.start }
  return { start: row.due!, due: row.due! }
}

function rowAriaName(
  row: TimelineRow,
  fallback: string
): string {
  return typeof row.label === "string" && row.label.trim()
    ? row.label
    : fallback
}

function Timeline({
  className,
  rows,
  dependencies = [],
  zoom = "day",
  visibleRange,
  loading = false,
  emptyContent,
  overscan = 6,
  estimateRowSize: estimateRowSizeProp,
  onBarChange,
  onRowClick,
  renderRowMeta,
  style,
  "aria-label": ariaLabel,
  ...props
}: TimelineProps) {
  const s = useDfStrings()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const labelScrollRef = React.useRef<HTMLDivElement>(null)
  const gridScrollRef = React.useRef<HTMLDivElement>(null)
  const headerScrollRef = React.useRef<HTMLDivElement>(null)
  const syncingScrollRef = React.useRef(false)
  const dragPreviewRef = React.useRef<DragPreview | null>(null)
  const autoScrollSession = React.useRef<AutoScrollSession | null>(null)
  const barDrag = useDragGesture()

  const [liveMessage, setLiveMessage] = React.useState("")
  const [dragPreview, setDragPreview] = React.useState<DragPreview | null>(null)
  const [keyboardDraft, setKeyboardDraft] = React.useState<KeyboardDraft | null>(
    null
  )

  const unitPx = useCssPx(rootRef, "--df-timeline-unit-px", DEFAULT_UNIT_PX)
  const tokenRowHeight = useCssPx(
    rootRef,
    "--df-timeline-row-height",
    DEFAULT_ROW_HEIGHT
  )
  const rowHeight = estimateRowSizeProp ?? tokenRowHeight
  const labelWidth = useCssPx(
    rootRef,
    "--df-timeline-label-width",
    DEFAULT_LABEL_WIDTH
  )
  const stubPx = useCssPx(rootRef, "--df-timeline-dependency-stub", 8)
  const radiusPx = useCssPx(rootRef, "--df-timeline-dependency-radius", 4)

  const scale = React.useMemo(
    () =>
      buildTimelineScale({
        visibleRange,
        zoom,
        unitPx,
      }),
    [unitPx, visibleRange, zoom]
  )

  const effectiveRows = React.useMemo(() => {
    if (!keyboardDraft) return rows
    return rows.map((row) =>
      row.id === keyboardDraft.rowId
        ? {
            ...row,
            start: keyboardDraft.draftStart,
            due: keyboardDraft.draftDue,
          }
        : row
    )
  }, [keyboardDraft, rows])

  const barRects = React.useMemo(
    () =>
      layoutTimelineBars(
        effectiveRows.map((row) => ({
          id: row.id,
          start: row.start,
          due: row.due,
          progress: row.progress,
        })),
        scale
      ),
    [effectiveRows, scale]
  )

  const barById = React.useMemo(() => {
    const map = new Map<string, TimelineBarRect>()
    for (const rect of barRects) map.set(rect.id, rect)
    return map
  }, [barRects])

  const rowIndexById = React.useMemo(() => {
    const map = new Map<string, number>()
    effectiveRows.forEach((row, index) => map.set(row.id, index))
    return map
  }, [effectiveRows])

  const dependencyPaths = React.useMemo(() => {
    const anchors = anchorsFromBars(barRects, rowIndexById)
    return routeDependencyPaths(dependencies, anchors, {
      rowHeight,
      stubPx,
      radiusPx,
    })
  }, [barRects, dependencies, radiusPx, rowHeight, rowIndexById, stubPx])

  const { items, totalSize, measureElement } = useVirtualRows({
    count: loading || rows.length === 0 ? 0 : rows.length,
    estimateSize: rowHeight,
    getScrollElement: () => gridScrollRef.current,
    overscan,
  })

  const announce = React.useCallback((message: string) => {
    setLiveMessage(message)
  }, [])

  const syncLabelScroll = React.useCallback(() => {
    const grid = gridScrollRef.current
    const labels = labelScrollRef.current
    if (!grid || !labels || syncingScrollRef.current) return
    if (labels.scrollTop !== grid.scrollTop) {
      syncingScrollRef.current = true
      labels.scrollTop = grid.scrollTop
      syncingScrollRef.current = false
    }
  }, [])

  const syncHeaderScroll = React.useCallback(() => {
    const grid = gridScrollRef.current
    const header = headerScrollRef.current
    if (!grid || !header) return
    if (header.scrollLeft !== grid.scrollLeft) {
      header.scrollLeft = grid.scrollLeft
    }
  }, [])

  const onGridScroll = React.useCallback(() => {
    syncLabelScroll()
    syncHeaderScroll()
  }, [syncHeaderScroll, syncLabelScroll])

  const onLabelScroll = React.useCallback(() => {
    const grid = gridScrollRef.current
    const labels = labelScrollRef.current
    if (!grid || !labels || syncingScrollRef.current) return
    if (grid.scrollTop !== labels.scrollTop) {
      syncingScrollRef.current = true
      grid.scrollTop = labels.scrollTop
      syncingScrollRef.current = false
    }
  }, [])

  React.useEffect(() => {
    const header = headerScrollRef.current
    if (!header) return
    const onWheel = (event: WheelEvent) => {
      const grid = gridScrollRef.current
      if (!grid) return
      const deltaX =
        event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0
      const deltaY =
        event.deltaX !== 0 || event.shiftKey ? 0 : event.deltaY
      if (deltaX === 0 && deltaY === 0) return
      event.preventDefault()
      if (deltaX !== 0) grid.scrollLeft += deltaX
      if (deltaY !== 0) grid.scrollTop += deltaY
    }
    header.addEventListener("wheel", onWheel, { passive: false })
    return () => header.removeEventListener("wheel", onWheel)
  }, [])

  const stopAutoScroll = React.useCallback(() => {
    disposeAutoScrollSession(autoScrollSession)
  }, [])

  const updateDragPreview = React.useCallback((next: DragPreview | null) => {
    dragPreviewRef.current = next
    setDragPreview(next)
  }, [])

  const commitBarChange = React.useCallback(
    (rowId: string, next: TimelineBarChange, origin: TimelineBarChange) => {
      if (next.start === origin.start && next.due === origin.due) {
        announce(s.timelineBarUnchanged)
        return
      }
      onBarChange?.(rowId, next)
      announce(
        s.timelineUpdated(formatTimelineDateRange(next.start, next.due))
      )
    },
    [announce, onBarChange, s]
  )

  const applyPointerDelta = React.useCallback(
    (session: PointerDragSession, clientX: number) => {
      const grid = gridScrollRef.current
      const scrollDelta = grid
        ? grid.scrollLeft - session.scrollLeftAtStart
        : 0
      const deltaPx = clientX - session.startClientX + scrollDelta
      const proposed = reduceTimelineDrag({
        kind: session.kind,
        origin: { start: session.originStart, due: session.originDue },
        deltaPx,
        scale,
      })

      let translateX = 0
      let widthScale = 1
      if (session.kind === "move") {
        translateX = scale.dateToX(proposed.start) - session.originX
      } else if (session.kind === "resize-end") {
        const nextWidth = Math.max(
          scale.unitPx,
          scale.dateToX(proposed.due) + scale.unitPx - session.originX
        )
        widthScale = nextWidth / Math.max(session.originWidth, 1)
      } else {
        const nextX = scale.dateToX(proposed.start)
        const nextWidth = Math.max(
          scale.unitPx,
          session.originX + session.originWidth - nextX
        )
        translateX = nextX - session.originX
        widthScale = nextWidth / Math.max(session.originWidth, 1)
      }

      updateDragPreview({
        rowId: session.rowId,
        kind: session.kind,
        start: proposed.start,
        due: proposed.due,
        translateX,
        widthScale,
      })
    },
    [scale, updateDragPreview]
  )

  const liveRef = useLatestRef({
    announce,
    applyPointerDelta,
    commitBarChange,
    stopAutoScroll,
    updateDragPreview,
    s,
  })

  const beginPointerDrag = React.useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      row: TimelineRow,
      kind: TimelineDragKind,
      rect: TimelineBarRect
    ) => {
      if (event.button !== 0 || (!row.start && !row.due)) return
      const dates = resolveBarDates(row)
      if (!dates) return
      event.preventDefault()
      event.stopPropagation()

      const originStart = scale.snapDate(dates.start)
      const originDue = scale.snapDate(dates.due)
      const session: PointerDragSession = {
        pointerId: event.pointerId,
        kind,
        rowId: row.id,
        originStart,
        originDue,
        originX: rect.x,
        originWidth: rect.width,
        startClientX: event.clientX,
        scrollLeftAtStart: gridScrollRef.current?.scrollLeft ?? 0,
      }
      setKeyboardDraft(null)
      updateDragPreview({
        rowId: row.id,
        kind,
        start: originStart,
        due: originDue,
        translateX: 0,
        widthScale: 1,
      })
      announce(
        kind === "move"
          ? s.timelineMovingBar(
              formatTimelineDateRange(originStart, originDue)
            )
          : s.timelineResizingBar(
              formatTimelineDateRange(originStart, originDue)
            )
      )
      stopAutoScroll()
      autoScrollSession.current = startAutoScrollSession({
        axis: "both",
        getContainer: () => gridScrollRef.current,
      })

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "Escape") return
        keyEvent.preventDefault()
        barDrag.end("cancel")
      }
      window.addEventListener("keydown", onKeyDown)

      barDrag.begin(event, session, {
        onMove: (moveEvent, activeSession) => {
          autoScrollSession.current?.updatePointer(
            moveEvent.clientX,
            moveEvent.clientY
          )
          liveRef.current.applyPointerDelta(activeSession, moveEvent.clientX)
        },
        onEnd: (_event, activeSession, reason) => {
          window.removeEventListener("keydown", onKeyDown)
          const preview = dragPreviewRef.current
          dragPreviewRef.current = null
          setDragPreview(null)
          const live = liveRef.current
          live.stopAutoScroll()
          if (
            reason !== "up" ||
            !preview ||
            preview.rowId !== activeSession.rowId
          ) {
            if (reason !== "unmount") {
              live.announce(live.s.timelineBarDragCancelled)
            }
            return
          }
          live.commitBarChange(
            activeSession.rowId,
            { start: preview.start, due: preview.due },
            {
              start: activeSession.originStart,
              due: activeSession.originDue,
            }
          )
        },
      })
    },
    [
      announce,
      barDrag,
      liveRef,
      s,
      scale,
      stopAutoScroll,
      updateDragPreview,
    ]
  )

  const onBarKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>, row: TimelineRow) => {
      const liveRow =
        keyboardDraft?.rowId === row.id
          ? {
              ...row,
              start: keyboardDraft.draftStart,
              due: keyboardDraft.draftDue,
            }
          : row
      const dates = resolveBarDates(liveRow)
      if (!dates) return

      if (event.key === "Escape") {
        if (!keyboardDraft || keyboardDraft.rowId !== row.id) return
        event.preventDefault()
        setKeyboardDraft(null)
        announce(s.timelineBarEditCancelled)
        return
      }

      if (event.key === "Enter") {
        if (!keyboardDraft || keyboardDraft.rowId !== row.id) return
        event.preventDefault()
        const next = {
          start: keyboardDraft.draftStart,
          due: keyboardDraft.draftDue,
        }
        const origin = {
          start: keyboardDraft.originStart,
          due: keyboardDraft.originDue,
        }
        setKeyboardDraft(null)
        commitBarChange(row.id, next, origin)
        return
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      const units = event.key === "ArrowRight" ? 1 : -1
      const kind: TimelineDragKind = event.altKey
        ? "resize-start"
        : event.shiftKey
          ? "resize-end"
          : "move"
      const origin =
        keyboardDraft?.rowId === row.id
          ? {
              start: keyboardDraft.originStart,
              due: keyboardDraft.originDue,
            }
          : dates
      const next = nudgeTimelineBar({
        kind,
        origin: dates,
        units,
        scale,
      })
      setKeyboardDraft({
        rowId: row.id,
        originStart: origin.start,
        originDue: origin.due,
        draftStart: next.start,
        draftDue: next.due,
      })
      const range = formatTimelineDateRange(next.start, next.due)
      announce(
        kind === "move"
          ? s.timelineMovedCommit(range)
          : s.timelineResizedCommit(range)
      )
    },
    [announce, commitBarChange, keyboardDraft, s, scale]
  )

  const isEmpty = !loading && rows.length === 0
  const reducedMotion = prefersReducedMotion()
  const weekendColumns =
    zoom === "day"
      ? scale.fineColumns.filter((column) => column.isWeekend)
      : []

  return (
    <div
      {...props}
      ref={rootRef}
      data-df="timeline"
      data-zoom={zoom}
      data-loading={loading ? "true" : undefined}
      data-empty={isEmpty ? "true" : undefined}
      className={cn("df-timeline", className)}
      style={style}
      role="treegrid"
      aria-label={ariaLabel ?? s.timelineAriaLabel}
      aria-rowcount={loading ? LOADING_ROW_COUNT + 1 : rows.length + 1}
      aria-busy={loading || undefined}
    >
      <div className="df-timeline-chrome" data-df="timeline-chrome">
        <div
          className="df-timeline-corner"
          data-df="timeline-corner"
          style={{ width: labelWidth, minWidth: labelWidth }}
        >
          <span className="df-timeline-corner-label">{s.timelineNameColumn}</span>
        </div>
        <div
          ref={headerScrollRef}
          className="df-timeline-header-scroll"
          data-df="timeline-header-scroll"
        >
          <div
            className="df-timeline-header"
            data-df="timeline-header"
            style={{ width: scale.totalWidth }}
          >
            <div
              className="df-timeline-header-row"
              data-df="timeline-header-coarse"
            >
              {scale.coarseHeaders.map((cell) => (
                <div
                  key={cell.key}
                  className="df-timeline-header-cell"
                  style={{ left: cell.x, width: cell.width }}
                >
                  {cell.label}
                </div>
              ))}
            </div>
            <div
              className="df-timeline-header-row"
              data-df="timeline-header-fine"
            >
              {scale.fineHeaders.map((cell) => (
                <div
                  key={cell.key}
                  className="df-timeline-header-cell"
                  style={{ left: cell.x, width: cell.width }}
                >
                  {cell.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="df-timeline-body" data-df="timeline-body">
        <div
          ref={labelScrollRef}
          className="df-timeline-labels"
          data-df="timeline-labels"
          style={{ width: labelWidth, minWidth: labelWidth }}
          onScroll={onLabelScroll}
        >
          {loading ? (
            <div className="df-timeline-loading" data-df="timeline-loading">
              {Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
                <div
                  key={`label-loading-${index}`}
                  className="df-timeline-label-row"
                  style={{ height: rowHeight }}
                >
                  <span className="df-timeline-skeleton" />
                </div>
              ))}
            </div>
          ) : isEmpty ? null : (
            <div className="df-timeline-label-rows" style={{ height: totalSize }}>
              {items.map((item) => {
                const row = effectiveRows[item.index]
                if (!row) return null
                return (
                  <div
                    key={row.id}
                    ref={measureElement}
                    data-index={item.index}
                    className="df-timeline-label-row"
                    data-df="timeline-label-row"
                    role="row"
                    aria-rowindex={item.index + 2}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: item.size,
                      transform: `translateY(${item.start}px)`,
                    }}
                    onClick={() => onRowClick?.(row.id)}
                  >
                    <div className="df-timeline-label-main">
                      <span className="df-timeline-label-text">{row.label}</span>
                      {renderRowMeta ? (
                        <span className="df-timeline-label-meta">
                          {renderRowMeta(row)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div
          ref={gridScrollRef}
          className="df-timeline-grid"
          data-df="timeline-grid"
          onScroll={onGridScroll}
        >
          {loading ? (
            <div
              className="df-timeline-loading"
              data-df="timeline-loading"
              style={{ width: scale.totalWidth }}
            >
              {Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
                <div
                  key={`grid-loading-${index}`}
                  className="df-timeline-track-row"
                  style={{ height: rowHeight, width: scale.totalWidth }}
                >
                  <span className="df-timeline-skeleton df-timeline-skeleton-bar" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div
              className="df-timeline-empty"
              data-df="timeline-empty"
              aria-live="polite"
            >
              {emptyContent ?? s.timelineEmpty}
            </div>
          ) : (
            <div
              className="df-timeline-tracks"
              data-df="timeline-tracks"
              style={{ height: totalSize, width: scale.totalWidth }}
            >
              {weekendColumns.map((column) => (
                <div
                  key={`weekend-${column.key}`}
                  className="df-timeline-weekend"
                  data-df="timeline-weekend"
                  style={{ left: column.x, width: column.width }}
                />
              ))}

              {scale.fineColumns.map((column) => (
                <div
                  key={`col-${column.key}`}
                  className="df-timeline-column-line"
                  style={{ left: column.x }}
                />
              ))}

              {scale.todayX !== null ? (
                <div
                  className="df-timeline-today"
                  data-df="timeline-today"
                  style={{ left: scale.todayX }}
                />
              ) : null}

              <svg
                className="df-timeline-dependencies"
                data-df="timeline-dependencies"
                width={scale.totalWidth}
                height={totalSize}
                aria-hidden
              >
                {dependencyPaths.map((path) => (
                  <path
                    key={`${path.fromId}-${path.toId}`}
                    d={path.d}
                    className="df-timeline-dependency-path"
                  />
                ))}
              </svg>

              {items.map((item) => {
                const row = effectiveRows[item.index]
                if (!row) return null
                const rect = barById.get(row.id)
                const preview =
                  dragPreview?.rowId === row.id ? dragPreview : null
                const color = row.colorToken
                  ? `var(${row.colorToken})`
                  : undefined
                const labelDates = preview
                  ? formatTimelineDateRange(preview.start, preview.due)
                  : formatTimelineDateRange(
                      row.start ?? row.due ?? "",
                      row.due ?? row.start ?? ""
                    )

                return (
                  <div
                    key={row.id}
                    className="df-timeline-track-row"
                    data-df="timeline-track-row"
                    role="row"
                    aria-rowindex={item.index + 2}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: scale.totalWidth,
                      height: item.size,
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    {rect ? (
                      <div
                        className="df-timeline-bar"
                        data-df="timeline-bar"
                        data-missing-start={
                          rect.missingStart ? "true" : undefined
                        }
                        data-missing-due={rect.missingDue ? "true" : undefined}
                        data-dragging={preview ? "true" : undefined}
                        role="gridcell"
                        tabIndex={0}
                        aria-label={`${rowAriaName(row, s.timelineItemFallback)} ${labelDates}`}
                        style={{
                          left: rect.x,
                          width: rect.width,
                          background: color,
                          transform: preview
                            ? `translateX(${preview.translateX}px) scaleX(${preview.widthScale})`
                            : undefined,
                          transformOrigin: "left center",
                          transition:
                            preview || reducedMotion
                              ? "none"
                              : "transform var(--df-duration-quick) var(--df-ease-standard)",
                        }}
                        onKeyDown={(event) => onBarKeyDown(event, row)}
                        onPointerDown={(event) =>
                          beginPointerDrag(event, row, "move", rect)
                        }
                      >
                        {rect.progress !== null ? (
                          <span
                            className="df-timeline-bar-progress"
                            style={{
                              width: `${Math.round(rect.progress * 100)}%`,
                            }}
                          />
                        ) : null}
                        <span
                          className="df-timeline-bar-handle df-timeline-bar-handle-start"
                          data-df="timeline-bar-handle"
                          data-edge="start"
                          onPointerDown={(event) =>
                            beginPointerDrag(event, row, "resize-start", rect)
                          }
                        />
                        <span
                          className="df-timeline-bar-handle df-timeline-bar-handle-end"
                          data-df="timeline-bar-handle"
                          data-edge="end"
                          onPointerDown={(event) =>
                            beginPointerDrag(event, row, "resize-end", rect)
                          }
                        />
                      </div>
                    ) : null}

                    {preview ? (
                      <div
                        className="df-timeline-ghost"
                        data-df="timeline-ghost"
                        style={{
                          left: scale.dateToX(preview.start),
                          width: Math.max(
                            scale.unitPx,
                            scale.dateToX(preview.due) +
                              scale.unitPx -
                              scale.dateToX(preview.start)
                          ),
                        }}
                      >
                        <span className="df-timeline-ghost-label">
                          {formatTimelineDateRange(preview.start, preview.due)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="df-timeline-live"
        data-df="timeline-live"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </div>
    </div>
  )
}

export { Timeline }
export type { TimelineDependencyEdge, TimelineVisibleRange, TimelineZoom }
