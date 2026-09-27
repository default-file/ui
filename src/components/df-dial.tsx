"use client"

import * as React from "react"

import {
  useControllableState,
  useDragGesture,
  useLatestRef,
} from "../hooks"
import {
  applyPointerTravel,
  commitDialValue,
  followAngle,
  formatByStep,
  isTickFilled,
  lastDialValue,
  nearestTickIndex,
  pointerTravel,
  progressSweepDegrees,
  ratioAlongRange,
  tickRay,
  turnPixelsFromFace,
  valueDeltaFromTravel,
  valueToAngle,
  DIAL_TICK_INNER_RADIUS,
  type DialDragAxis,
} from "../lib/df-dial"
import {
  resumeUiScrubAudio,
  startUiScrub,
  stopUiScrub,
  updateUiScrub,
} from "../lib/df-scrub-sound"
import { playUiTick, resumeUiTickAudio } from "../lib/df-tick-sound"
import { cn } from "../lib/utils"

const DEFAULT_TICK_COUNT = 36

type DialSize = "sm" | "md" | "lg"

type DialThumb = "dot" | "tick"

type DialLabelPosition = "inside" | "top" | "bottom" | "left" | "right"

type DialValueFormat = "number" | "percent"

type DialRadius =
  | "none"
  | "xxs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "full"

type DialTickRenderContext = {
  index: number
  count: number
  active: boolean
  filled: boolean
  angle: number
  value: number
}

const DIAL_RADIUS_VAR: Record<DialRadius, string> = {
  none: "0px",
  xxs: "var(--radius-xxs)",
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  "3xl": "var(--radius-3xl)",
  "4xl": "var(--radius-4xl)",
  full: "var(--radius-full)",
}

type DialProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange" | "color"
> & {
  min?: number
  max?: number
  step?: number
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  wrap?: boolean
  invert?: boolean
  dragAxis?: DialDragAxis
  startAngle?: number
  sweep?: number
  size?: DialSize
  thumb?: DialThumb
  label?: React.ReactNode
  labelPosition?: DialLabelPosition
  labelGap?: string
  showValue?: boolean
  valueFormat?: DialValueFormat
  formatValue?: (value: number) => string
  tickCount?: number
  showTicks?: boolean
  tickFill?: boolean
  tickRadius?: DialRadius
  thumbRadius?: DialRadius
  renderTick?: (tick: DialTickRenderContext) => React.ReactNode
  tickSound?: boolean
  scrubSound?: boolean
  accent?: string
  tickMuted?: string
  tickFilled?: string
  tickActive?: string
  labelColor?: string
  valueColor?: string
  faceBackground?: string
  faceBorder?: string
  progress?: boolean
  progressColor?: string
  tickWidth?: string
  tickLength?: string
  thumbSize?: string
  disabled?: boolean
}

function formatDialValue(
  value: number,
  min: number,
  max: number,
  step: number,
  valueFormat: DialValueFormat,
  formatValue?: (value: number) => string,
  wrap = false
) {
  if (formatValue) return formatValue(value)
  if (valueFormat === "percent") {
    return `${Math.round(ratioAlongRange(value, min, max, wrap) * 100)}%`
  }
  return formatByStep(value, step)
}

function Dial({
  className,
  style,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  wrap = false,
  invert = false,
  dragAxis = "all",
  startAngle = 0,
  sweep = 360,
  size = "md",
  thumb = "dot",
  label,
  labelPosition = "inside",
  labelGap,
  showValue = false,
  valueFormat = "number",
  formatValue,
  tickCount = DEFAULT_TICK_COUNT,
  showTicks = true,
  tickFill,
  tickRadius = "none",
  thumbRadius = "full",
  renderTick,
  tickSound = true,
  scrubSound = false,
  accent,
  tickMuted,
  tickFilled,
  tickActive,
  labelColor,
  valueColor,
  faceBackground,
  faceBorder,
  progress = false,
  progressColor,
  tickWidth,
  tickLength,
  thumbSize,
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ref,
  ...props
}: DialProps) {
  const labelId = React.useId()
  const safeStep = step > 0 ? step : 1
  const safeSweep = sweep > 0 ? sweep : 360
  const span = max - min || 1
  const largeStep = Math.max(safeStep, span / 10)

  const [rawValue, setValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? min,
    onChange: onValueChange,
  })

  const current = commitDialValue(rawValue, min, max, safeStep, wrap)
  const currentRef = useLatestRef(current)
  const dragValueRef = React.useRef(current)
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const turnPixelsRef = React.useRef(1)
  const displayAngleRef = React.useRef<number | null>(null)
  const { begin: beginDrag } = useDragGesture()
  const [dragging, setDragging] = React.useState(false)
  const [dragLive, setDragLive] = React.useState<number | null>(null)

  React.useEffect(() => {
    return () => {
      stopUiScrub()
    }
  }, [])

  const visualValue = dragLive ?? current
  const targetAngle = valueToAngle(
    visualValue,
    min,
    max,
    startAngle,
    safeSweep
  )
  const displayAngle =
    dragging || displayAngleRef.current == null
      ? targetAngle
      : followAngle(displayAngleRef.current, targetAngle)
  displayAngleRef.current = displayAngle

  const shownValue = commitDialValue(visualValue, min, max, safeStep, wrap)
  const displayText = formatDialValue(
    shownValue,
    min,
    max,
    safeStep,
    valueFormat,
    formatValue,
    wrap
  )
  const resolvedTickCount = Math.max(2, Math.floor(tickCount))
  const fillTicks = tickFill ?? !(wrap || min < 0)
  const travelSign = invert ? -1 : 1
  const hasLabel = label != null
  const showOutsideLabel =
    hasLabel && labelPosition !== "inside"
  const showInsideLabel = hasLabel && labelPosition === "inside"
  const showCenter = showInsideLabel || showValue
  const resolvedAriaLabelledBy =
    ariaLabelledBy ??
    (hasLabel && ariaLabel == null ? labelId : undefined)
  const activeTick = nearestTickIndex(displayAngle, resolvedTickCount)
  const scrubRatio = ratioAlongRange(visualValue, min, max, wrap)
  const progressAngle = progress
    ? progressSweepDegrees(
        visualValue,
        min,
        max,
        startAngle,
        safeSweep
      )
    : 0
  const hasFaceFill = faceBackground != null && faceBackground !== ""

  const commitValue = React.useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return
      const snapped = commitDialValue(next, min, max, safeStep, wrap)
      if (tickSound && snapped !== currentRef.current) {
        playUiTick()
      }
      setValue(snapped)
    },
    [currentRef, max, min, safeStep, setValue, tickSound, wrap]
  )

  const applyPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return
      const last = lastPointerRef.current
      if (last == null) {
        lastPointerRef.current = { x: clientX, y: clientY }
        return
      }
      const travel = pointerTravel(
        clientX - last.x,
        clientY - last.y,
        dragAxis
      )
      lastPointerRef.current = { x: clientX, y: clientY }
      if (travel === 0) return
      const next = applyPointerTravel(
        dragValueRef.current,
        valueDeltaFromTravel(
          travel * travelSign,
          min,
          max,
          turnPixelsRef.current
        ),
        min,
        max,
        wrap
      )
      dragValueRef.current = next
      setDragLive(next)
      commitValue(next)
      if (scrubSound) {
        updateUiScrub(ratioAlongRange(next, min, max, wrap))
      }
    },
    [commitValue, dragAxis, max, min, scrubSound, travelSign, wrap]
  )

  const onFacePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    const face = event.currentTarget
    const rect = face.getBoundingClientRect()
    turnPixelsRef.current = turnPixelsFromFace(
      Math.min(rect.width, rect.height)
    )
    dragValueRef.current = currentRef.current
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    setDragLive(currentRef.current)
    setDragging(true)
    if (tickSound) resumeUiTickAudio()
    if (scrubSound) {
      resumeUiScrubAudio()
      startUiScrub(scrubRatio)
    }
    beginDrag(event, null, {
      onMove: (moveEvent) => {
        applyPointer(moveEvent.clientX, moveEvent.clientY)
      },
      onEnd: () => {
        stopUiScrub()
        lastPointerRef.current = null
        setDragLive(null)
        setDragging(false)
      },
    })
  }

  const onFaceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (tickSound) resumeUiTickAudio()
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault()
      commitValue(current + travelSign * safeStep)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault()
      commitValue(current - travelSign * safeStep)
    } else if (event.key === "Home") {
      event.preventDefault()
      commitValue(min)
    } else if (event.key === "End") {
      event.preventDefault()
      commitValue(lastDialValue(min, max, safeStep, wrap))
    } else if (event.key === "PageUp") {
      event.preventDefault()
      commitValue(current + travelSign * largeStep)
    } else if (event.key === "PageDown") {
      event.preventDefault()
      commitValue(current - travelSign * largeStep)
    }
  }

  const purposeLabel = hasLabel ? (
    <span data-df="dial-label" id={labelId}>
      {label}
    </span>
  ) : null

  const ticks = showTicks
    ? Array.from({ length: resolvedTickCount }, (_, index) => {
        const angle = (index / resolvedTickCount) * 360
        const filled =
          fillTicks && isTickFilled(angle, startAngle, safeSweep, scrubRatio)
        const active = thumb === "tick" && index === activeTick
        const custom = renderTick?.({
          index,
          count: resolvedTickCount,
          active,
          filled,
          angle,
          value: shownValue,
        })
        const tickStyle = {
          "--df-dial-tick-angle": `${angle}deg`,
        } as React.CSSProperties
        if (custom != null) {
          return {
            kind: "custom" as const,
            node: (
              <span
                key={index}
                data-df="dial-tick-host"
                data-filled={filled ? "" : undefined}
                data-active={active ? "" : undefined}
                style={tickStyle}
              >
                {custom}
              </span>
            ),
          }
        }
        const ray = tickRay(angle, 50, 50, 50, DIAL_TICK_INNER_RADIUS)
        return {
          kind: "mark" as const,
          node: (
            <line
              key={index}
              data-df="dial-tick"
              data-filled={filled ? "" : undefined}
              data-active={active ? "" : undefined}
              x1={ray.x1}
              y1={ray.y1}
              x2={ray.x2}
              y2={ray.y2}
            />
          ),
        }
      })
    : []
  const tickMarks = ticks
    .filter((tick) => tick.kind === "mark")
    .map((tick) => tick.node)
  const tickHosts = ticks
    .filter((tick) => tick.kind === "custom")
    .map((tick) => tick.node)

  const rootStyle = {
    "--df-dial-angle": `${displayAngle}deg`,
    "--df-dial-tick-radius": DIAL_RADIUS_VAR[tickRadius],
    "--df-dial-tick-cap": tickRadius === "full" ? "round" : "butt",
    "--df-dial-thumb-radius": DIAL_RADIUS_VAR[thumbRadius],
    ...(accent ? { "--df-dial-accent": accent } : null),
    ...(tickMuted ? { "--df-dial-tick-muted": tickMuted } : null),
    ...(tickFilled ? { "--df-dial-tick-filled": tickFilled } : null),
    ...(tickActive ? { "--df-dial-tick-active": tickActive } : null),
    ...(labelColor ? { "--df-dial-label-color": labelColor } : null),
    ...(valueColor ? { "--df-dial-value-color": valueColor } : null),
    ...(faceBackground ? { "--df-dial-face-bg": faceBackground } : null),
    ...(faceBorder ? { "--df-dial-face-border": faceBorder } : null),
    ...(progress
      ? {
          "--df-dial-progress-from": `${startAngle}deg`,
          "--df-dial-progress-angle": `${progressAngle}deg`,
        }
      : null),
    ...(progressColor ? { "--df-dial-progress-color": progressColor } : null),
    ...(tickWidth ? { "--df-dial-tick-width": tickWidth } : null),
    ...(tickLength ? { "--df-dial-tick-length": tickLength } : null),
    ...(thumbSize ? { "--df-dial-thumb-size": thumbSize } : null),
    ...(labelGap ? { "--df-dial-label-gap": labelGap } : null),
    ...style,
  } as React.CSSProperties

  return (
    <div
      ref={ref}
      data-df="dial"
      data-size={size}
      data-thumb={thumb}
      data-drag-axis={dragAxis}
      data-wrap={wrap ? "" : undefined}
      data-invert={invert ? "" : undefined}
      data-face={hasFaceFill ? "fill" : undefined}
      data-progress={progress ? "" : undefined}
      data-label-position={hasLabel ? labelPosition : undefined}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn(className)}
      style={rootStyle}
      {...props}
    >
      {labelPosition === "top" && showOutsideLabel ? purposeLabel : null}
      {labelPosition === "left" && showOutsideLabel ? purposeLabel : null}
      <div
        data-df="dial-face"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={displayText}
        aria-disabled={disabled || undefined}
        onPointerDown={onFacePointerDown}
        onKeyDown={onFaceKeyDown}
      >
        {progress ? (
          <span data-df="dial-progress" aria-hidden="true" />
        ) : null}
        {(showTicks || thumb === "dot") ? (
          <div data-df="dial-ticks" aria-hidden="true">
            {showTicks && tickMarks.length > 0 ? (
              <svg viewBox="0 0 100 100" focusable="false">
                {tickMarks}
              </svg>
            ) : null}
            {showTicks ? tickHosts : null}
            {thumb === "dot" ? (
              <span data-df="dial-thumb-orbit">
                <span data-df="dial-thumb" />
              </span>
            ) : null}
          </div>
        ) : null}
        {showCenter ? (
          <span
            data-df="dial-center"
            data-with-value={
              showInsideLabel && showValue ? "" : undefined
            }
          >
            {showInsideLabel ? purposeLabel : null}
            {showValue ? (
              <span data-df="dial-value">{displayText}</span>
            ) : null}
          </span>
        ) : null}
      </div>
      {labelPosition === "right" && showOutsideLabel ? purposeLabel : null}
      {labelPosition === "bottom" && showOutsideLabel ? purposeLabel : null}
    </div>
  )
}

export { Dial }
export type {
  DialDragAxis,
  DialLabelPosition,
  DialProps,
  DialRadius,
  DialSize,
  DialThumb,
  DialTickRenderContext,
  DialValueFormat,
}
