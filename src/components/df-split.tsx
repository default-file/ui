"use client"

import * as React from "react"

import { useControllableState, useIsomorphicLayoutEffect } from "../hooks"
import { useDfStrings } from "../lib/df-intl"
import {
  clampRatio,
  normalizeRatioInput,
  ratioFromPointer,
  ratioToPercent,
  resolveRatioBounds,
  stepRatio,
  type SplitSizeConstraint,
} from "../lib/df-split"
import { cn } from "../lib/utils"

type SplitOrientation = "horizontal" | "vertical"

export type SplitProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "aria-label"
> & {
  orientation?: SplitOrientation
  ratio?: number
  defaultRatio?: number
  onRatioChange?: (ratio: number) => void
  minSize?: SplitSizeConstraint
  maxSize?: SplitSizeConstraint
  step?: number
  disabled?: boolean
  /** Accessible name for the resize separator. */
  "aria-label"?: string
  children: [React.ReactNode, React.ReactNode]
}

function Split({
  orientation = "horizontal",
  ratio,
  defaultRatio = 0.5,
  onRatioChange,
  minSize,
  maxSize,
  step = 0.02,
  disabled = false,
  className,
  children,
  style,
  "aria-label": ariaLabel,
  ...props
}: SplitProps) {
  const strings = useDfStrings()
  const separatorLabel = ariaLabel ?? strings.splitSeparator
  const [currentRatio, setRatio] = useControllableState({
    value: ratio === undefined ? undefined : normalizeRatioInput(ratio),
    defaultValue: normalizeRatioInput(defaultRatio),
    onChange: onRatioChange,
  })
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const draggingRef = React.useRef(false)
  const dragTrackRef = React.useRef<{ start: number; size: number } | null>(
    null
  )
  const [trackSize, setTrackSize] = React.useState(0)

  const primary = children[0]
  const secondary = children[1]

  const captureTrackRect = React.useCallback(() => {
    const root = rootRef.current
    if (root == null) return null
    const rect = root.getBoundingClientRect()
    const next = {
      start: orientation === "horizontal" ? rect.left : rect.top,
      size: orientation === "horizontal" ? rect.width : rect.height,
    }
    setTrackSize(next.size)
    if (draggingRef.current) {
      dragTrackRef.current = next
    }
    return next
  }, [orientation])

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current
    if (root == null) return

    captureTrackRect()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", captureTrackRect)
      return () => window.removeEventListener("resize", captureTrackRect)
    }

    const observer = new ResizeObserver(() => {
      captureTrackRect()
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [captureTrackRect])

  const bounds = React.useMemo(
    () =>
      resolveRatioBounds({
        minSize,
        maxSize,
        trackSize,
      }),
    [maxSize, minSize, trackSize]
  )

  const clamped = clampRatio(currentRatio, bounds)

  const commitRatio = React.useCallback(
    (next: number) => {
      if (disabled) return
      setRatio(clampRatio(next, bounds))
    },
    [bounds, disabled, setRatio]
  )

  const commitFromPointer = React.useCallback(
    (pointer: number) => {
      const track = dragTrackRef.current
      if (track == null) return
      commitRatio(
        ratioFromPointer({
          pointer,
          trackStart: track.start,
          trackSize: track.size,
          bounds,
        })
      )
    },
    [bounds, commitRatio]
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const track = captureTrackRect()
    if (track == null) return
    dragTrackRef.current = track
    commitFromPointer(
      orientation === "horizontal" ? event.clientX : event.clientY
    )
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return
    commitFromPointer(
      orientation === "horizontal" ? event.clientX : event.clientY
    )
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    dragTrackRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const percent = ratioToPercent(clamped)
  const primaryStyle = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis:
      orientation === "horizontal"
        ? `calc(${clamped * 100}% - var(--df-split-divider-size) / 2)`
        : `calc(${clamped * 100}% - var(--df-split-divider-size) / 2)`,
  } as React.CSSProperties

  return (
    <div
      ref={rootRef}
      data-df="split"
      data-orientation={orientation}
      data-disabled={disabled ? "" : undefined}
      className={cn(className)}
      style={style}
      {...props}
    >
      <div data-df="split-pane" data-pane="primary" style={primaryStyle}>
        {primary}
      </div>
      <div
        data-df="split-divider"
        role="separator"
        aria-label={separatorLabel}
        aria-orientation={orientation}
        aria-valuenow={percent}
        aria-valuemin={ratioToPercent(bounds.min)}
        aria-valuemax={ratioToPercent(bounds.max)}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          if (disabled) return
          commitRatio(normalizeRatioInput(defaultRatio))
        }}
        onKeyDown={(event) => {
          if (disabled) return
          const horizontal = orientation === "horizontal"
          if (
            (horizontal && event.key === "ArrowLeft") ||
            (!horizontal && event.key === "ArrowUp")
          ) {
            event.preventDefault()
            commitRatio(stepRatio(clamped, -1, step, bounds))
            return
          }
          if (
            (horizontal && event.key === "ArrowRight") ||
            (!horizontal && event.key === "ArrowDown")
          ) {
            event.preventDefault()
            commitRatio(stepRatio(clamped, 1, step, bounds))
            return
          }
          if (event.key === "Home") {
            event.preventDefault()
            commitRatio(bounds.min)
            return
          }
          if (event.key === "End") {
            event.preventDefault()
            commitRatio(bounds.max)
          }
        }}
      />
      <div
        data-df="split-pane"
        data-pane="secondary"
        style={{ flex: "1 1 0", minWidth: 0, minHeight: 0 }}
      >
        {secondary}
      </div>
    </div>
  )
}

export { Split }
export type { SplitOrientation, SplitSizeConstraint }
