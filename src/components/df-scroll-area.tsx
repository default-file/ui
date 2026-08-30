"use client"

import * as React from "react"

import { useCssPx, useDragGesture, useIsomorphicLayoutEffect, useLatestRef } from "../hooks"
import { cn, composeEventHandlers } from "../lib/utils"

type ScrollAreaVariant = "default" | "edge"
type ScrollAreaThumbShape = "rounded" | "flat"
type ScrollAreaOrientation = "vertical" | "horizontal" | "both"
type ScrollAreaSide = "left" | "right" | "top" | "bottom"
type ScrollAreaVisibility = "hover" | "always"
type ScrollAreaSpace = "auto" | "none"

type ScrollAreaProps = React.ComponentProps<"div"> & {
  viewportClassName?: string | undefined
  viewportRef?: React.Ref<HTMLDivElement> | undefined
  /**
   * Layer above the viewport and below scrollbar thumbs.
   * Use for interactive surfaces that must share the scrollport geometry.
   */
  overlay?: React.ReactNode | undefined
  overlayClassName?: string | undefined
  variant?: ScrollAreaVariant | undefined
  thumbShape?: ScrollAreaThumbShape | undefined
  orientation?: ScrollAreaOrientation | undefined
  side?: ScrollAreaSide | undefined
  visibility?: ScrollAreaVisibility | undefined
  /**
   * Track inset. `auto` reserves a gutter so the bar can appear without
   * shifting content. `none` overlays with no inset. Defaults to `none` for
   * edge, `auto` otherwise.
   */
  space?: ScrollAreaSpace | undefined
  width?: number | undefined
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value)
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value
}

type ThumbState = { size: number; offset: number; visible: boolean }
const HIDDEN_THUMB: ThumbState = { size: 0, offset: 0, visible: false }

type VerticalThumbDragData = {
  start: number
  startScroll: number
  maxScroll: number
  maxOffset: number
  viewport: HTMLDivElement
}

type HorizontalThumbDragData = {
  start: number
  startScroll: number
  maxScroll: number
  maxOffset: number
  viewport: HTMLDivElement
}

function trackContentSize(
  track: HTMLElement | null,
  axis: "x" | "y"
): number {
  if (!track) return 0
  const styles = getComputedStyle(track)
  if (axis === "y") {
    return (
      track.clientHeight -
      (parseFloat(styles.paddingTop) || 0) -
      (parseFloat(styles.paddingBottom) || 0)
    )
  }
  return (
    track.clientWidth -
    (parseFloat(styles.paddingLeft) || 0) -
    (parseFloat(styles.paddingRight) || 0)
  )
}

function ScrollArea({
  className,
  children,
  viewportClassName,
  viewportRef: viewportRefProp,
  overlay,
  overlayClassName,
  variant = "default",
  thumbShape = "rounded",
  orientation = "vertical",
  side,
  visibility = "hover",
  space,
  width,
  ...props
}: ScrollAreaProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const setViewportRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node
      assignRef(viewportRefProp, node)
    },
    [viewportRefProp]
  )
  const vTrackRef = React.useRef<HTMLDivElement>(null)
  const hTrackRef = React.useRef<HTMLDivElement>(null)
  const vThumbRef = React.useRef<HTMLDivElement>(null)
  const hThumbRef = React.useRef<HTMLDivElement>(null)
  const hideTimerRef = React.useRef<number | null>(null)
  const thumbDrag = useDragGesture()
  const [vThumb, setVThumb] = React.useState<ThumbState>(HIDDEN_THUMB)
  const [hThumb, setHThumb] = React.useState<ThumbState>(HIDDEN_THUMB)
  const [scrolling, setScrolling] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)

  const trackVertical = orientation === "vertical" || orientation === "both"
  const trackHorizontal = orientation === "horizontal" || orientation === "both"
  const minThumbDefault = useCssPx(rootRef, "--df-scrollbar-min-thumb", 24)
  const minThumbEdge = useCssPx(rootRef, "--df-scrollbar-min-thumb-edge", 20)
  const minThumb = variant === "edge" ? minThumbEdge : minThumbDefault
  const verticalSide = side === "left" ? "left" : "right"
  const horizontalSide = side === "top" ? "top" : "bottom"
  const resolvedSpace = space ?? (variant === "edge" ? "none" : "auto")

  const syncThumb = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return

    if (trackVertical) {
      const { scrollTop, scrollHeight, clientHeight } = el
      const trackSize = trackContentSize(vTrackRef.current, "y") || clientHeight
      if (scrollHeight > clientHeight + 1 && trackSize > 0) {
        const size = Math.max((clientHeight / scrollHeight) * trackSize, minThumb)
        const maxOffset = Math.max(0, trackSize - size)
        const offset =
          maxOffset === 0
            ? 0
            : (scrollTop / (scrollHeight - clientHeight)) * maxOffset
        setVThumb({ size, offset, visible: true })
      } else {
        setVThumb(HIDDEN_THUMB)
      }
    }

    if (trackHorizontal) {
      const { scrollLeft, scrollWidth, clientWidth } = el
      const trackSize = trackContentSize(hTrackRef.current, "x") || clientWidth
      if (scrollWidth > clientWidth + 1 && trackSize > 0) {
        const size = Math.max((clientWidth / scrollWidth) * trackSize, minThumb)
        const maxOffset = Math.max(0, trackSize - size)
        const offset =
          maxOffset === 0
            ? 0
            : (scrollLeft / (scrollWidth - clientWidth)) * maxOffset
        setHThumb({ size, offset, visible: true })
      } else {
        setHThumb(HIDDEN_THUMB)
      }
    }
  }, [minThumb, trackVertical, trackHorizontal])

  const markScrolling = React.useCallback(() => {
    setScrolling(true)
    if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      setScrolling(false)
      hideTimerRef.current = null
    }, 900)
  }, [])

  const markScrollingRef = useLatestRef(markScrolling)

  // Measure before paint so overflow state does not shift layout after first frame.
  useIsomorphicLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onScroll = () => {
      syncThumb()
      markScrolling()
    }
    const ro = new ResizeObserver(syncThumb)
    const observeTargets = () => {
      ro.disconnect()
      ro.observe(el)
      if (el.firstElementChild) ro.observe(el.firstElementChild)
      if (vTrackRef.current) ro.observe(vTrackRef.current)
      if (hTrackRef.current) ro.observe(hTrackRef.current)
      syncThumb()
    }
    observeTargets()
    const mo = new MutationObserver(observeTargets)
    mo.observe(el, { childList: true })
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      mo.disconnect()
      ro.disconnect()
      el.removeEventListener("scroll", onScroll)
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current)
    }
  }, [syncThumb, markScrolling])

  const onVerticalThumbPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = viewportRef.current
      if (!el) return
      event.preventDefault()
      markScrolling()
      const start = event.clientY
      const startScroll = el.scrollTop
      const client = el.clientHeight
      const scrollSize = el.scrollHeight
      const thumbSize = vThumb.size
      const trackSize = trackContentSize(vTrackRef.current, "y") || client
      const maxScroll = scrollSize - client
      const maxOffset = trackSize - thumbSize
      const data: VerticalThumbDragData = {
        start,
        startScroll,
        maxScroll,
        maxOffset,
        viewport: el,
      }
      thumbDrag.begin(
        event,
        data,
        {
          onMove: (moveEvent, session) => {
            if (session.maxOffset <= 0) return
            markScrollingRef.current()
            const delta = moveEvent.clientY - session.start
            const next =
              session.startScroll +
              (delta / session.maxOffset) * session.maxScroll
            session.viewport.scrollTop = next
          },
        },
        { capture: false }
      )
    },
    [markScrolling, markScrollingRef, thumbDrag, vThumb.size]
  )

  const onHorizontalThumbPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = viewportRef.current
      if (!el) return
      event.preventDefault()
      markScrolling()
      const start = event.clientX
      const startScroll = el.scrollLeft
      const client = el.clientWidth
      const scrollSize = el.scrollWidth
      const thumbSize = hThumb.size
      const trackSize = trackContentSize(hTrackRef.current, "x") || client
      const maxScroll = scrollSize - client
      const maxOffset = trackSize - thumbSize
      const data: HorizontalThumbDragData = {
        start,
        startScroll,
        maxScroll,
        maxOffset,
        viewport: el,
      }
      thumbDrag.begin(
        event,
        data,
        {
          onMove: (moveEvent, session) => {
            if (session.maxOffset <= 0) return
            markScrollingRef.current()
            const delta = moveEvent.clientX - session.start
            const next =
              session.startScroll +
              (delta / session.maxOffset) * session.maxScroll
            session.viewport.scrollLeft = next
          },
        },
        { capture: false }
      )
    },
    [hThumb.size, markScrolling, markScrollingRef, thumbDrag]
  )

  const active = visibility === "always" || hovered || scrolling
  const showVBar = trackVertical && vThumb.visible && active
  const showHBar = trackHorizontal && hThumb.visible && active

  return (
    <div
      data-df="scroll-area"
      data-variant={variant}
      data-thumb-shape={thumbShape}
      data-orientation={orientation}
      data-visibility={visibility}
      data-space={resolvedSpace}
      data-overflow-y={trackVertical && vThumb.visible ? "" : undefined}
      data-overflow-x={trackHorizontal && hThumb.visible ? "" : undefined}
      data-vertical-side={verticalSide}
      data-horizontal-side={horizontalSide}
      className={cn("df-scroll-area", "relative", className)}
      {...props}
      ref={rootRef}
      onMouseEnter={(event) => {
        composeEventHandlers(props.onMouseEnter, () => {
          setHovered(true)
        })(event)
      }}
      onMouseLeave={(event) => {
        composeEventHandlers(props.onMouseLeave, () => {
          setHovered(false)
        })(event)
      }}
    >
      <div
        ref={setViewportRef}
        data-df="scroll-area-viewport"
        className={cn("df-scroll-area-viewport", viewportClassName)}
      >
        {children}
      </div>
      {overlay != null ? (
        <div
          data-df="scroll-area-overlay"
          className={cn(overlayClassName)}
        >
          {overlay}
        </div>
      ) : null}
      {trackVertical && (
        <div
          ref={vTrackRef}
          data-df="scroll-area-scrollbar"
          data-orientation="vertical"
          data-vertical=""
          data-variant={variant}
          data-side={verticalSide}
          aria-hidden={!showVBar}
          style={width != null ? { width } : undefined}
          className={cn(
            "transition-opacity duration-150",
            showVBar ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <div
            ref={vThumbRef}
            data-df="scroll-area-thumb"
            data-variant={variant}
            data-thumb-shape={thumbShape}
            onPointerDown={onVerticalThumbPointerDown}
            style={{
              height: vThumb.size,
              transform: `translateY(${vThumb.offset}px)`,
            }}
          />
        </div>
      )}
      {trackHorizontal && (
        <div
          ref={hTrackRef}
          data-df="scroll-area-scrollbar"
          data-orientation="horizontal"
          data-horizontal=""
          data-variant={variant}
          data-side={horizontalSide}
          aria-hidden={!showHBar}
          style={width != null ? { height: width } : undefined}
          className={cn(
            "transition-opacity duration-150",
            showHBar ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <div
            ref={hThumbRef}
            data-df="scroll-area-thumb"
            data-variant={variant}
            data-thumb-shape={thumbShape}
            onPointerDown={onHorizontalThumbPointerDown}
            style={{
              width: hThumb.size,
              transform: `translateX(${hThumb.offset}px)`,
            }}
          />
        </div>
      )}
    </div>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  side,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal"
  side?: ScrollAreaSide
}) {
  const resolvedSide =
    side ?? (orientation === "vertical" ? "right" : "bottom")
  return (
    <div
      data-df="scroll-area-scrollbar"
      data-orientation={orientation}
      data-vertical={orientation === "vertical" ? "" : undefined}
      data-horizontal={orientation === "horizontal" ? "" : undefined}
      data-side={resolvedSide}
      className={cn(className)}
      {...props}
    />
  )
}

export { ScrollArea, ScrollBar }
export type {
  ScrollAreaProps,
  ScrollAreaVariant,
  ScrollAreaThumbShape,
  ScrollAreaOrientation,
  ScrollAreaSide,
  ScrollAreaVisibility,
  ScrollAreaSpace,
}
