"use client"

import * as React from "react"

import {
  useControllableState,
  useDragGesture,
  useIsomorphicLayoutEffect,
  useLatestRef,
} from "../hooks"
import { playUiTick, resumeUiTickAudio } from "../lib/df-tick-sound"
import { cn } from "../lib/utils"

const DEFAULT_TICK_COUNT = 22

type TickSliderRadius =
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

type TickSliderBounds = "both" | "start" | "end" | "none"

type TickSliderSize = "sm" | "md"

type TickSliderFade = "start" | "end" | "both"

type TickSliderLabelPosition = "header" | "footer" | "shell"

type TickSliderLabelAlign = "start" | "center" | "end"

type TickSliderBubbleSide = "auto" | "top" | "bottom"

type TickSliderResolvedBubbleSide = "top" | "bottom"

type TickSliderTickRenderContext = {
  index: number
  count: number
  active: boolean
  ratio: number
  value: number
}

const TICK_SLIDER_RADIUS_VAR: Record<TickSliderRadius, string> = {
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

type TickSliderProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange" | "color"
> & {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max: number
  step?: number
  startLabel?: React.ReactNode
  endLabel?: React.ReactNode
  bounds?: TickSliderBounds
  label?: React.ReactNode
  labelPosition?: TickSliderLabelPosition
  labelAlign?: TickSliderLabelAlign
  bubbleSide?: TickSliderBubbleSide
  formatValue?: (value: number) => string
  tickCount?: number
  showTicks?: boolean
  tickActive?: string
  tickMuted?: string
  tickWidth?: string
  tickHeight?: string
  tickRadius?: TickSliderRadius
  tickGap?: string
  thumbWidth?: string
  thumbHeight?: string
  renderTick?: (tick: TickSliderTickRenderContext) => React.ReactNode
  showValueBubble?: boolean
  bubbleLeading?: React.ReactNode
  tickSound?: boolean
  accent?: string
  accentForeground?: string
  boundForeground?: string
  radius?: TickSliderRadius
  boundRadius?: TickSliderRadius
  thumbRadius?: TickSliderRadius
  bubbleRadius?: TickSliderRadius
  size?: TickSliderSize
  disabled?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function snapToStep(value: number, min: number, max: number, step: number) {
  const stepped = Math.round((value - min) / step) * step + min
  const precision = String(step).includes(".")
    ? (String(step).split(".")[1]?.length ?? 0)
    : 0
  const rounded =
    precision > 0 ? Number(stepped.toFixed(precision)) : stepped
  return clamp(rounded, min, max)
}

function resolveFade(
  showStart: boolean,
  showEnd: boolean
): TickSliderFade | undefined {
  if (!showStart && !showEnd) return "both"
  if (!showStart) return "start"
  if (!showEnd) return "end"
  return undefined
}

function resolveBubbleSide(
  bubbleSide: TickSliderBubbleSide,
  hasLabel: boolean,
  labelPosition: TickSliderLabelPosition
): TickSliderResolvedBubbleSide {
  if (bubbleSide === "top" || bubbleSide === "bottom") return bubbleSide
  if (!hasLabel) return "top"
  if (labelPosition === "header") return "bottom"
  if (labelPosition === "footer") return "top"
  return "top"
}

function TickSlider({
  className,
  style,
  min = 0,
  max,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  startLabel,
  endLabel,
  bounds = "both",
  label,
  labelPosition = "header",
  labelAlign,
  bubbleSide = "auto",
  formatValue,
  tickCount = DEFAULT_TICK_COUNT,
  showTicks = true,
  tickActive,
  tickMuted,
  tickWidth,
  tickHeight,
  tickRadius = "full",
  tickGap,
  thumbWidth,
  thumbHeight,
  renderTick,
  showValueBubble = true,
  bubbleLeading,
  tickSound = true,
  accent,
  accentForeground,
  boundForeground,
  radius = "full",
  boundRadius = "full",
  thumbRadius = "full",
  bubbleRadius = "full",
  size = "md",
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: TickSliderProps) {
  const labelId = React.useId()
  const [rawValue, setValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? min,
    onChange: onValueChange,
  })

  const current = snapToStep(rawValue, min, max, step)
  const span = max - min || 1
  const pct = ((current - min) / span) * 100
  const largeStep = Math.max(step, span / 10)
  const displayValue = formatValue?.(current) ?? String(current)
  const resolvedTickCount = Math.max(2, Math.floor(tickCount))
  const hasLabel = label != null
  const resolvedBubbleSide = resolveBubbleSide(
    bubbleSide,
    hasLabel,
    labelPosition
  )
  const showHeaderLabel = hasLabel && labelPosition === "header"
  const showFooterLabel = hasLabel && labelPosition === "footer"
  const showShellLabel = hasLabel && labelPosition === "shell"
  const resolvedLabelAlign =
    labelAlign ?? (labelPosition === "shell" ? "center" : "start")
  const resolvedAriaLabelledBy =
    ariaLabelledBy ?? (hasLabel ? labelId : undefined)

  const shellRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const bubbleRef = React.useRef<HTMLSpanElement>(null)
  const shellLabelTextRef = React.useRef<HTMLSpanElement>(null)
  const currentRef = useLatestRef(current)
  const { begin: beginDrag } = useDragGesture()
  const [measuredBubbleShift, setMeasuredBubbleShift] = React.useState(0)
  const [measuredShellLabelTickRange, setMeasuredShellLabelTickRange] =
    React.useState<{
      start: number
      end: number
    } | null>(null)
  const bubbleShift = showValueBubble ? measuredBubbleShift : 0
  const shellLabelTickRange = showShellLabel
    ? measuredShellLabelTickRange
    : null

  const commitValue = React.useCallback(
    (next: number) => {
      const snapped = snapToStep(next, min, max, step)
      if (tickSound && snapped !== currentRef.current) {
        playUiTick()
      }
      setValue(snapped)
    },
    [currentRef, max, min, setValue, step, tickSound]
  )

  const commit = React.useCallback(
    (clientX: number, track: HTMLElement) => {
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
      commitValue(min + ratio * (max - min))
    },
    [commitValue, max, min]
  )

  useIsomorphicLayoutEffect(() => {
    if (!showValueBubble) return

    const updateShift = () => {
      const shell = shellRef.current
      const track = trackRef.current
      const bubble = bubbleRef.current
      if (!shell || !track || !bubble) {
        setMeasuredBubbleShift(0)
        return
      }

      const shellRect = shell.getBoundingClientRect()
      const trackRect = track.getBoundingClientRect()
      const bubbleWidth = bubble.offsetWidth
      if (bubbleWidth <= 0 || trackRect.width <= 0) {
        setMeasuredBubbleShift(0)
        return
      }

      const thumbCenterX = trackRect.left + (pct / 100) * trackRect.width
      const naturalLeft = thumbCenterX - bubbleWidth / 2
      let shift = 0
      if (naturalLeft < shellRect.left) {
        shift = shellRect.left - naturalLeft
      } else if (naturalLeft + bubbleWidth > shellRect.right) {
        shift = shellRect.right - (naturalLeft + bubbleWidth)
      }
      setMeasuredBubbleShift(shift)
    }

    updateShift()

    const shell = shellRef.current
    if (!shell || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(updateShift)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [displayValue, pct, showValueBubble, bubbleLeading, resolvedBubbleSide])

  useIsomorphicLayoutEffect(() => {
    if (!showShellLabel) return

    const updateTickRange = () => {
      const track = trackRef.current
      const labelText = shellLabelTextRef.current
      if (!track || !labelText) {
        setMeasuredShellLabelTickRange(null)
        return
      }

      const trackRect = track.getBoundingClientRect()
      const labelRect = labelText.getBoundingClientRect()
      if (trackRect.width <= 0 || labelRect.width <= 0) {
        setMeasuredShellLabelTickRange(null)
        return
      }

      setMeasuredShellLabelTickRange({
        start: clamp((labelRect.left - trackRect.left) / trackRect.width, 0, 1),
        end: clamp((labelRect.right - trackRect.left) / trackRect.width, 0, 1),
      })
    }

    updateTickRange()

    const track = trackRef.current
    const labelText = shellLabelTextRef.current
    if (!track || !labelText || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(updateTickRange)
    observer.observe(track)
    observer.observe(labelText)
    return () => observer.disconnect()
  }, [showShellLabel, label, size, resolvedLabelAlign])

  const onTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    if (tickSound) resumeUiTickAudio()
    const track = event.currentTarget
    commit(event.clientX, track)
    beginDrag(event, { track }, {
      onMove: (moveEvent, data) => {
        commit(moveEvent.clientX, data.track)
      },
    })
  }

  const onThumbKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return
    if (tickSound) resumeUiTickAudio()
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault()
      commitValue(current + step)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault()
      commitValue(current - step)
    } else if (event.key === "Home") {
      event.preventDefault()
      commitValue(min)
    } else if (event.key === "End") {
      event.preventDefault()
      commitValue(max)
    } else if (event.key === "PageUp") {
      event.preventDefault()
      commitValue(current + largeStep)
    } else if (event.key === "PageDown") {
      event.preventDefault()
      commitValue(current - largeStep)
    }
  }

  const showStart =
    (bounds === "both" || bounds === "start") && startLabel != null
  const showEnd = (bounds === "both" || bounds === "end") && endLabel != null
  const fade = resolveFade(showStart, showEnd)

  const ticks = showTicks
    ? Array.from({ length: resolvedTickCount }, (_, index) => {
        const ratio =
          resolvedTickCount <= 1 ? 0 : index / (resolvedTickCount - 1)
        const active = ratio * 100 <= pct + Number.EPSILON
        const underLabel =
          shellLabelTickRange != null &&
          ratio >= shellLabelTickRange.start &&
          ratio <= shellLabelTickRange.end
        const custom = renderTick?.({
          index,
          count: resolvedTickCount,
          active,
          ratio,
          value: current,
        })
        if (custom != null) {
          return (
            <span
              key={index}
              data-df="tick-slider-tick-host"
              data-under-label={underLabel ? "" : undefined}
            >
              {custom}
            </span>
          )
        }
        return (
          <span
            key={index}
            data-df="tick-slider-tick"
            data-active={active ? "" : undefined}
            data-under-label={underLabel ? "" : undefined}
          />
        )
      })
    : null

  const purposeLabel =
    hasLabel ? (
      <span data-df="tick-slider-label" id={labelId}>
        {label}
      </span>
    ) : null

  const tickSegments = Math.max(1, resolvedTickCount - 1)

  const rootStyle = {
    "--df-tick-slider-shell-radius": TICK_SLIDER_RADIUS_VAR[radius],
    "--df-tick-slider-bound-radius": TICK_SLIDER_RADIUS_VAR[boundRadius],
    "--df-tick-slider-thumb-radius": TICK_SLIDER_RADIUS_VAR[thumbRadius],
    "--df-tick-slider-bubble-radius": TICK_SLIDER_RADIUS_VAR[bubbleRadius],
    "--df-tick-slider-tick-radius": TICK_SLIDER_RADIUS_VAR[tickRadius],
    "--df-tick-slider-tick-segments": String(tickSegments),
    ...(accent ? { "--df-tick-slider-accent": accent } : null),
    ...(accentForeground
      ? { "--df-tick-slider-accent-foreground": accentForeground }
      : null),
    ...(boundForeground
      ? { "--df-tick-slider-bound-foreground": boundForeground }
      : null),
    ...(tickActive ? { "--df-tick-slider-tick-active": tickActive } : null),
    ...(tickMuted ? { "--df-tick-slider-tick-muted": tickMuted } : null),
    ...(tickWidth ? { "--df-tick-slider-tick-width": tickWidth } : null),
    ...(tickHeight ? { "--df-tick-slider-tick-height": tickHeight } : null),
    ...(tickGap ? { "--df-tick-slider-tick-gap": tickGap } : null),
    ...(thumbWidth ? { "--df-tick-slider-thumb-width": thumbWidth } : null),
    ...(thumbHeight ? { "--df-tick-slider-thumb-height": thumbHeight } : null),
    ...style,
  } as React.CSSProperties

  return (
    <div data-df="tick-slider-host" className={cn(className)}>
      <div
        data-df="tick-slider"
        data-disabled={disabled ? "" : undefined}
        data-bounds={bounds}
        data-size={size}
        data-radius={radius}
        data-bound-radius={boundRadius}
        data-thumb-radius={thumbRadius}
        data-bubble-radius={bubbleRadius}
        data-tick-radius={tickRadius}
        data-label-position={hasLabel ? labelPosition : undefined}
        data-label-align={hasLabel ? resolvedLabelAlign : undefined}
        data-bubble-side={showValueBubble ? resolvedBubbleSide : undefined}
        style={rootStyle}
        {...props}
      >
        {showHeaderLabel ? purposeLabel : null}
        <div data-df="tick-slider-shell" ref={shellRef}>
          {showStart ? (
            <span data-df="tick-slider-bound" aria-hidden="true">
              {startLabel}
            </span>
          ) : null}
          <div
            ref={trackRef}
            data-df="tick-slider-track"
            onPointerDown={onTrackPointerDown}
          >
            {showTicks ? (
              <div
                data-df="tick-slider-ticks"
                data-fade={fade}
                data-layout={tickGap != null ? "gap" : undefined}
                aria-hidden="true"
              >
                {ticks}
              </div>
            ) : null}
            {showShellLabel ? (
              <span data-df="tick-slider-shell-label" id={labelId}>
                <span
                  ref={shellLabelTextRef}
                  data-df="tick-slider-shell-label-text"
                >
                  <span
                    data-df="tick-slider-shell-label-wash"
                    aria-hidden="true"
                  />
                  <span data-df="tick-slider-shell-label-copy">{label}</span>
                </span>
              </span>
            ) : null}
            <span
              data-df="tick-slider-thumb"
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={ariaLabel}
              aria-labelledby={resolvedAriaLabelledBy}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={current}
              aria-valuetext={displayValue}
              aria-disabled={disabled || undefined}
              style={{ left: `${pct}%` }}
              onKeyDown={onThumbKeyDown}
            >
              {showValueBubble ? (
                <span
                  ref={bubbleRef}
                  data-df="tick-slider-bubble"
                  style={
                    {
                      "--df-tick-slider-bubble-shift": `${bubbleShift}px`,
                    } as React.CSSProperties
                  }
                >
                  {bubbleLeading ? (
                    <span data-df="tick-slider-bubble-leading">
                      {bubbleLeading}
                    </span>
                  ) : null}
                  {displayValue}
                </span>
              ) : null}
            </span>
          </div>
          {showEnd ? (
            <span data-df="tick-slider-bound" aria-hidden="true">
              {endLabel}
            </span>
          ) : null}
        </div>
        {showFooterLabel ? purposeLabel : null}
      </div>
    </div>
  )
}

export { TickSlider }
export type {
  TickSliderBounds,
  TickSliderBubbleSide,
  TickSliderLabelAlign,
  TickSliderLabelPosition,
  TickSliderRadius,
  TickSliderSize,
  TickSliderTickRenderContext,
}
