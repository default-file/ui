"use client"

import { Minus, Plus } from "lucide-react"
import * as React from "react"

import { useControllableState, useDragGesture } from "../hooks"
import {
  resumeUiScrubAudio,
  startUiScrub,
  stopUiScrub,
  updateUiScrub,
} from "../lib/df-scrub-sound"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"
import { Button } from "./df-button"

type SliderVariant = "bar" | "line"

type SliderOrientation = "horizontal" | "vertical"

type SliderThickness = "sm" | "md" | "lg"

type SliderValueFormat = "number" | "percent"

type SliderValuePosition =
  | "auto"
  | "header"
  | "footer"
  | "start"
  | "end"
  | "ends"
  | "ends-reverse"
  | "thumb"
  | "thumbs"
  | "bubble"

type SliderThumbValueOrder = "label-first" | "value-first"

type SliderMarksSide = "start" | "end"

type SliderMark = {
  value: number
  label?: React.ReactNode
}

type SliderMarkInput = number | SliderMark

type SliderChromeSlot = "header" | "footer" | "start" | "end"

type SliderChromeContent = "both" | "heading" | "value"

const SLIDER_CHROME_SLOT = {
  header: "slider-header",
  footer: "slider-footer",
  start: "slider-start",
  end: "slider-end",
} as const satisfies Record<SliderChromeSlot, `slider-${SliderChromeSlot}`>

type SliderProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange" | "color"
> & {
  min?: number
  max?: number
  step?: number
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
  disabled?: boolean
  variant?: SliderVariant
  orientation?: SliderOrientation
  thickness?: SliderThickness
  minStepsBetween?: number
  marks?: SliderMarkInput[]
  valuePosition?: SliderValuePosition
  thumbValueOrder?: SliderThumbValueOrder
  marksSide?: SliderMarksSide
  label?: React.ReactNode
  description?: React.ReactNode
  leading?: React.ReactNode
  showStepButtons?: boolean
  stepButtonSteps?: number
  showValue?: boolean
  valueFormat?: SliderValueFormat
  formatValue?: (value: number) => string
  formatValues?: (values: number[]) => React.ReactNode
  valueSlot?:
    | React.ReactNode
    | ((values: number[]) => React.ReactNode)
  scrubSound?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function snapToStep(value: number, min: number, max: number, step: number) {
  const safeStep = step > 0 ? step : 1
  const stepped = Math.round((value - min) / safeStep) * safeStep + min
  const precision = String(safeStep).includes(".")
    ? (String(safeStep).split(".")[1]?.length ?? 0)
    : 0
  const rounded =
    precision > 0 ? Number(stepped.toFixed(precision)) : stepped
  return clamp(rounded, min, max)
}

function formatByStep(value: number, step: number) {
  const safeStep = step > 0 ? step : 1
  const digits = safeStep >= 1 ? 0 : safeStep >= 0.1 ? 1 : 2
  return value.toFixed(digits)
}

function resolveMarks(
  marks: SliderMarkInput[] | undefined,
  min: number,
  max: number
): SliderMark[] {
  if (!marks?.length) return []
  return marks
    .map((mark) =>
      typeof mark === "number"
        ? { value: mark }
        : { value: mark.value, label: mark.label }
    )
    .filter((mark) => mark.value >= min && mark.value <= max)
    .sort((a, b) => a.value - b.value)
}

function snapToMarks(value: number, marks: readonly SliderMark[]): number {
  if (!marks.length) return value
  let best = marks[0]!
  let bestDist = Math.abs(best.value - value)
  for (let i = 1; i < marks.length; i++) {
    const mark = marks[i]!
    const dist = Math.abs(mark.value - value)
    if (dist < bestDist) {
      best = mark
      bestDist = dist
    }
  }
  return best.value
}

function markIndex(value: number, marks: readonly SliderMark[]): number {
  const snapped = snapToMarks(value, marks)
  return Math.max(
    0,
    marks.findIndex((mark) => mark.value === snapped)
  )
}

function normalizePair(
  values: readonly number[],
  min: number,
  max: number,
  step: number,
  marks: readonly SliderMark[],
  minStepsBetween: number
): readonly [number, number] {
  const snap = (v: number) =>
    marks.length
      ? snapToMarks(v, marks)
      : snapToStep(v, min, max, step)
  let a = snap(values[0] ?? min)
  let b = snap(values[1] ?? a)
  if (a > b) {
    const prevA = a
    a = b
    b = prevA
  }
  if (marks.length && minStepsBetween > 0) {
    const iA = markIndex(a, marks)
    const iB = markIndex(b, marks)
    if (iB - iA < minStepsBetween) {
      const nextB = Math.min(marks.length - 1, iA + minStepsBetween)
      const nextA = Math.max(0, nextB - minStepsBetween)
      a = marks[nextA]!.value
      b = marks[nextB]!.value
    }
  }
  return [a, b] as const
}

function rangeFloorFor(
  thumbIndex: 0 | 1,
  low: number,
  high: number,
  min: number,
  max: number,
  step: number,
  marks: readonly SliderMark[],
  minStepsBetween: number
) {
  if (thumbIndex === 0) return min
  if (marks.length) {
    return marks[
      Math.min(
        marks.length - 1,
        markIndex(low, marks) + minStepsBetween
      )
    ]!.value
  }
  const gap = Math.max(0, minStepsBetween) * step
  return snapToStep(low + gap, min, max, step)
}

function rangeCeilingFor(
  thumbIndex: 0 | 1,
  low: number,
  high: number,
  min: number,
  max: number,
  step: number,
  marks: readonly SliderMark[],
  minStepsBetween: number
) {
  if (thumbIndex === 1) return max
  if (marks.length) {
    return marks[
      Math.max(0, markIndex(high, marks) - minStepsBetween)
    ]!.value
  }
  const gap = Math.max(0, minStepsBetween) * step
  return snapToStep(high - gap, min, max, step)
}

function Slider({
  className,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  disabled,
  variant = "bar",
  orientation = "horizontal",
  thickness = "md",
  minStepsBetween = 0,
  marks,
  valuePosition = "auto",
  thumbValueOrder = "label-first",
  marksSide = "end",
  label,
  description,
  leading,
  showStepButtons = false,
  stepButtonSteps = 1,
  showValue,
  valueFormat = "number",
  formatValue,
  formatValues,
  valueSlot,
  scrubSound = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ref,
  ...props
}: SliderProps) {
  const s = useDfStrings()
  const labelId = React.useId()
  const safeStep = step > 0 ? step : 1

  React.useEffect(() => {
    return () => {
      stopUiScrub()
    }
  }, [])

  const buttonSteps = Math.max(
    1,
    Math.floor(Number.isFinite(stepButtonSteps) ? stepButtonSteps : 1)
  )
  const buttonDelta = buttonSteps * safeStep
  const [values, setValues] = useControllableState({
    value,
    defaultValue: defaultValue ?? [min],
    onChange: onValueChange,
  })
  const [dragging, setDragging] = React.useState(false)
  const [activeThumb, setActiveThumb] = React.useState(0)
  const [dragPct, setDragPct] = React.useState<number | null>(null)
  const valuesRef = React.useRef(values)
  const activeThumbRef = React.useRef(activeThumb)
  const { begin: beginDrag } = useDragGesture()

  React.useEffect(() => {
    valuesRef.current = values
  }, [values])

  React.useEffect(() => {
    activeThumbRef.current = activeThumb
  }, [activeThumb])

  const resolvedMarks = React.useMemo(
    () => resolveMarks(marks, min, max),
    [marks, max, min]
  )
  const useMarks = resolvedMarks.length > 0
  const span = max - min || 1
  const gap = Math.max(0, minStepsBetween) * safeStep
  const isRange =
    (value?.length ?? 0) >= 2 ||
    (defaultValue?.length ?? 0) >= 2 ||
    values.length >= 2
  const isVertical = orientation === "vertical"

  const snapValue = React.useCallback(
    (raw: number) =>
      useMarks
        ? snapToMarks(raw, resolvedMarks)
        : snapToStep(raw, min, max, safeStep),
    [max, min, resolvedMarks, safeStep, useMarks]
  )

  const [low, high, single] = React.useMemo(() => {
    const nextSingle = snapValue(values[0] ?? min)
    if (!isRange) {
      return [nextSingle, nextSingle, nextSingle] as const
    }
    const pair = normalizePair(
      values,
      min,
      max,
      safeStep,
      resolvedMarks,
      minStepsBetween
    )
    return [pair[0], pair[1], nextSingle] as const
  }, [
    isRange,
    max,
    min,
    minStepsBetween,
    resolvedMarks,
    safeStep,
    snapValue,
    values,
  ])

  const pctOf = React.useCallback(
    (v: number) => ((v - min) / span) * 100,
    [min, span]
  )

  const lowPct = pctOf(low)
  const highPct = pctOf(high)
  const singlePct =
    !isRange && !useMarks && dragPct != null ? dragPct : pctOf(single)

  const resolvedShowValue =
    showValue ??
    (formatValue != null ||
      formatValues != null ||
      valueSlot != null ||
      label != null ||
      description != null ||
      leading != null)

  const resolvedValuePosition = React.useMemo(() => {
    let next = valuePosition
    if (next === "auto") {
      if (useMarks && isVertical && !isRange) next = "thumb"
      else if (isVertical) next = "footer"
      else next = "header"
    }
    if (next === "thumb" && !isVertical) next = "header"
    return next
  }, [isRange, isVertical, useMarks, valuePosition])

  const formatOne = React.useCallback(
    (v: number) => {
      if (formatValue) return formatValue(v)
      if (valueFormat === "percent") {
        return `${Math.round(pctOf(v))}%`
      }
      return formatByStep(v, safeStep)
    },
    [formatValue, pctOf, safeStep, valueFormat]
  )

  const displayValue = React.useMemo(() => {
    const values = isRange ? [low, high] : [single]
    if (valueSlot != null) {
      return typeof valueSlot === "function" ? valueSlot(values) : valueSlot
    }
    if (formatValues) return formatValues(values)
    if (isRange) {
      const sep = <span data-df="slider-value-sep">to</span>
      if (isVertical && resolvedValuePosition !== "header") {
        return (
          <>
            <span>{formatOne(high)}</span>
            {sep}
            <span>{formatOne(low)}</span>
          </>
        )
      }
      return (
        <>
          <span>{formatOne(low)}</span> {sep} <span>{formatOne(high)}</span>
        </>
      )
    }
    return formatOne(single)
  }, [
    formatOne,
    formatValues,
    high,
    isRange,
    isVertical,
    low,
    resolvedValuePosition,
    single,
    valueSlot,
  ])

  const hasCustomValueSlot =
    valueSlot != null ||
    (formatValues != null &&
      typeof displayValue !== "string" &&
      typeof displayValue !== "number")

  const resolvedAriaLabelledBy =
    ariaLabelledBy ?? (label != null ? labelId : undefined)
  const baseName =
    ariaLabel ??
    (typeof label === "string" && !resolvedAriaLabelledBy ? label : undefined)

  const thumbAria = (index: 0 | 1) => {
    if (!isRange) {
      return {
        ariaLabel: baseName,
        ariaLabelledBy: resolvedAriaLabelledBy,
      }
    }
    return {
      ariaLabel: baseName
        ? index === 0
          ? s.sliderMinimumThumb(baseName)
          : s.sliderMaximumThumb(baseName)
        : index === 0
          ? s.sliderMinimum
          : s.sliderMaximum,
      ariaLabelledBy:
        ariaLabelledBy ??
        (!baseName && label != null ? labelId : undefined),
    }
  }

  const ratioFromPointer = React.useCallback(
    (clientX: number, clientY: number, track: HTMLElement) => {
      const rect = track.getBoundingClientRect()
      if (isVertical) {
        if (rect.height <= 0) return 0
        return clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
      }
      if (rect.width <= 0) return 0
      return clamp((clientX - rect.left) / rect.width, 0, 1)
    },
    [isVertical]
  )

  const commitAtRatio = React.useCallback(
    (index: number, ratio: number) => {
      const raw = min + ratio * (max - min)

      if (!isRange) {
        setValues([snapValue(raw)])
        return
      }

      const [currentLow, currentHigh] = normalizePair(
        valuesRef.current,
        min,
        max,
        safeStep,
        resolvedMarks,
        minStepsBetween
      )

      if (useMarks) {
        const next = snapValue(raw)
        const iNext = markIndex(next, resolvedMarks)
        if (index === 0) {
          const iHigh = markIndex(currentHigh, resolvedMarks)
          const iLow = Math.min(iNext, Math.max(0, iHigh - minStepsBetween))
          setValues([resolvedMarks[iLow]!.value, currentHigh])
          return
        }
        const iLow = markIndex(currentLow, resolvedMarks)
        const iHigh = Math.max(
          iNext,
          Math.min(resolvedMarks.length - 1, iLow + minStepsBetween)
        )
        setValues([currentLow, resolvedMarks[iHigh]!.value])
        return
      }

      if (index === 0) {
        setValues([
          snapToStep(raw, min, Math.max(min, currentHigh - gap), safeStep),
          currentHigh,
        ])
        return
      }
      setValues([
        currentLow,
        snapToStep(raw, Math.min(max, currentLow + gap), max, safeStep),
      ])
    },
    [
      gap,
      isRange,
      max,
      min,
      minStepsBetween,
      resolvedMarks,
      safeStep,
      setValues,
      snapValue,
      useMarks,
    ]
  )

  const pickThumbIndex = React.useCallback(
    (ratio: number, fromThumb?: number) => {
      if (!isRange) return 0
      const [currentLow, currentHigh] = normalizePair(
        valuesRef.current,
        min,
        max,
        safeStep,
        resolvedMarks,
        minStepsBetween
      )
      const pointer = min + ratio * (max - min)
      if (currentLow === currentHigh) {
        if (pointer < currentLow) return 0
        if (pointer > currentLow) return 1
        if (fromThumb === 0 || fromThumb === 1) return fromThumb
        return activeThumbRef.current === 1 ? 1 : 0
      }
      if (fromThumb === 0 || fromThumb === 1) return fromThumb
      return Math.abs(pointer - currentLow) <= Math.abs(pointer - currentHigh)
        ? 0
        : 1
    },
    [isRange, max, min, minStepsBetween, resolvedMarks, safeStep]
  )

  const onControlPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (disabled) return
    if (
      (event.target as HTMLElement | null)?.closest?.(
        "[data-df='slider-mark']"
      )
    ) {
      return
    }
    event.preventDefault()
    const track = event.currentTarget
    const thumbAttr = (event.target as HTMLElement | null)
      ?.closest?.("[data-df='slider-thumb']")
      ?.getAttribute("data-index")
    const fromThumb =
      thumbAttr === "0" || thumbAttr === "1" ? Number(thumbAttr) : undefined
    const ratio = ratioFromPointer(event.clientX, event.clientY, track)
    const data = { dragIndex: pickThumbIndex(ratio, fromThumb) }
    setActiveThumb(data.dragIndex)
    setDragging(true)
    if (!isRange && !useMarks) setDragPct(ratio * 100)
    if (scrubSound) {
      resumeUiScrubAudio()
      startUiScrub(ratio)
    }
    commitAtRatio(data.dragIndex, ratio)

    beginDrag(event, data, {
      onMove: (moveEvent, gesture) => {
        const nextRatio = ratioFromPointer(
          moveEvent.clientX,
          moveEvent.clientY,
          track
        )
        if (isRange) {
          const [currentLow, currentHigh] = normalizePair(
            valuesRef.current,
            min,
            max,
            safeStep,
            resolvedMarks,
            minStepsBetween
          )
          if (currentLow === currentHigh) {
            const pointer = min + nextRatio * (max - min)
            if (pointer < currentLow) gesture.dragIndex = 0
            else if (pointer > currentLow) gesture.dragIndex = 1
            setActiveThumb(gesture.dragIndex)
          }
        }
        if (!isRange && !useMarks) setDragPct(nextRatio * 100)
        if (scrubSound) updateUiScrub(nextRatio)
        commitAtRatio(gesture.dragIndex, nextRatio)
      },
      onEnd: () => {
        stopUiScrub()
        setDragging(false)
        setDragPct(null)
      },
    })
  }

  const moveThumbByMarks = React.useCallback(
    (index: number, deltaMarks: number) => {
      if (!useMarks) return
      if (!isRange) {
        const i = clamp(
          markIndex(single, resolvedMarks) + deltaMarks,
          0,
          resolvedMarks.length - 1
        )
        setValues([resolvedMarks[i]!.value])
        return
      }
      const iLow = markIndex(low, resolvedMarks)
      const iHigh = markIndex(high, resolvedMarks)
      if (index === 0) {
        const next = clamp(iLow + deltaMarks, 0, iHigh - minStepsBetween)
        setValues([resolvedMarks[next]!.value, high])
        return
      }
      const next = clamp(
        iHigh + deltaMarks,
        iLow + minStepsBetween,
        resolvedMarks.length - 1
      )
      setValues([low, resolvedMarks[next]!.value])
    },
    [
      high,
      isRange,
      low,
      minStepsBetween,
      resolvedMarks,
      setValues,
      single,
      useMarks,
    ]
  )

  const moveThumb = React.useCallback(
    (index: number, delta: number) => {
      if (useMarks) {
        moveThumbByMarks(index, delta > 0 ? 1 : -1)
        return
      }
      if (!isRange) {
        setValues([snapToStep(single + delta, min, max, safeStep)])
        return
      }
      const [currentLow, currentHigh] = normalizePair(
        valuesRef.current,
        min,
        max,
        safeStep,
        resolvedMarks,
        minStepsBetween
      )
      if (index === 0) {
        setValues([
          snapToStep(
            currentLow + delta,
            min,
            currentHigh - gap,
            safeStep
          ),
          currentHigh,
        ])
        return
      }
      setValues([
        currentLow,
        snapToStep(
          currentHigh + delta,
          currentLow + gap,
          max,
          safeStep
        ),
      ])
    },
    [
      gap,
      isRange,
      max,
      min,
      minStepsBetween,
      moveThumbByMarks,
      resolvedMarks,
      safeStep,
      setValues,
      single,
      useMarks,
    ]
  )

  const handleThumbKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLSpanElement>
  ) => {
    if (disabled) return
    const large = useMarks
      ? Math.max(1, Math.round(resolvedMarks.length / 10))
      : Math.max(safeStep, span / 10)

    const activate = () => setActiveThumb(index)

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault()
      activate()
      if (useMarks) moveThumbByMarks(index, 1)
      else moveThumb(index, safeStep)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault()
      activate()
      if (useMarks) moveThumbByMarks(index, -1)
      else moveThumb(index, -safeStep)
    } else if (event.key === "PageUp") {
      event.preventDefault()
      activate()
      if (useMarks) moveThumbByMarks(index, large)
      else moveThumb(index, large)
    } else if (event.key === "PageDown") {
      event.preventDefault()
      activate()
      if (useMarks) moveThumbByMarks(index, -large)
      else moveThumb(index, -large)
    } else if (event.key === "Home") {
      event.preventDefault()
      activate()
      if (!isRange) {
        setValues([useMarks ? resolvedMarks[0]!.value : min])
      } else if (index === 0) {
        setValues([useMarks ? resolvedMarks[0]!.value : min, high])
      } else {
        setValues([
          low,
          rangeFloorFor(
            1,
            low,
            high,
            min,
            max,
            safeStep,
            resolvedMarks,
            minStepsBetween
          ),
        ])
      }
    } else if (event.key === "End") {
      event.preventDefault()
      activate()
      if (!isRange) {
        setValues([
          useMarks
            ? resolvedMarks[resolvedMarks.length - 1]!.value
            : max,
        ])
      } else if (index === 1) {
        setValues([
          low,
          useMarks
            ? resolvedMarks[resolvedMarks.length - 1]!.value
            : max,
        ])
      } else {
        setValues([
          rangeCeilingFor(
            0,
            low,
            high,
            min,
            max,
            safeStep,
            resolvedMarks,
            minStepsBetween
          ),
          high,
        ])
      }
    }
  }

  const selectMark = (markValue: number) => {
    if (disabled) return
    if (!isRange) {
      setValues([markValue])
      return
    }
    const ratio = (markValue - min) / span
    const index = pickThumbIndex(ratio)
    setActiveThumb(index)
    commitAtRatio(index, ratio)
  }

  const thumbChrome =
    resolvedValuePosition === "thumb" && !isRange && isVertical
  const showThumbValue = resolvedShowValue && thumbChrome
  const showThumbDescription = description != null && thumbChrome
  const showThumbMeta =
    thumbChrome &&
    (showThumbValue ||
      showThumbDescription ||
      label != null ||
      leading != null)
  const showBubbleValue =
    resolvedShowValue && resolvedValuePosition === "bubble" && !isRange
  const showThumbsValue =
    resolvedShowValue && resolvedValuePosition === "thumbs"
  const hasChromeHeading =
    label != null || leading != null || description != null
  const showHeaderChrome =
    resolvedValuePosition === "header"
      ? hasChromeHeading || resolvedShowValue
      : (resolvedValuePosition === "thumbs" ||
          resolvedValuePosition === "bubble") &&
        hasChromeHeading
  const headerChromeContent: SliderChromeContent =
    resolvedValuePosition === "header" ? "both" : "heading"
  const showFooterChrome =
    resolvedValuePosition === "footer" &&
    (hasChromeHeading || resolvedShowValue)
  const showStartChrome =
    resolvedValuePosition === "start" &&
    (hasChromeHeading || resolvedShowValue)
  const showEndChrome =
    resolvedValuePosition === "end" &&
    (hasChromeHeading || resolvedShowValue)
  const showEndsChrome =
    resolvedValuePosition === "ends" &&
    (hasChromeHeading || resolvedShowValue)
  const showEndsReverseChrome =
    resolvedValuePosition === "ends-reverse" &&
    (hasChromeHeading || resolvedShowValue)
  const showInlineChrome =
    showStartChrome ||
    showEndChrome ||
    showEndsChrome ||
    showEndsReverseChrome

  const stepThumbIndex: 0 | 1 = isRange
    ? activeThumb === 1
      ? 1
      : 0
    : 0
  const stepValue = isRange
    ? stepThumbIndex === 0
      ? low
      : high
    : single
  const stepFloor = !isRange
    ? useMarks
      ? resolvedMarks[0]!.value
      : min
    : rangeFloorFor(
        stepThumbIndex,
        low,
        high,
        min,
        max,
        safeStep,
        resolvedMarks,
        minStepsBetween
      )
  const stepCeil = !isRange
    ? useMarks
      ? resolvedMarks[resolvedMarks.length - 1]!.value
      : max
    : rangeCeilingFor(
        stepThumbIndex,
        low,
        high,
        min,
        max,
        safeStep,
        resolvedMarks,
        minStepsBetween
      )
  const canStepDown = !disabled && stepValue > stepFloor
  const canStepUp = !disabled && stepValue < stepCeil

  const nudgeByStep = (direction: -1 | 1) => {
    if (disabled) return
    if (useMarks) moveThumbByMarks(stepThumbIndex, direction * buttonSteps)
    else moveThumb(stepThumbIndex, direction * buttonDelta)
  }

  const stepControlName =
    (typeof label === "string" && label) ||
    (typeof ariaLabel === "string" && ariaLabel) ||
    s.sliderValue

  const bubbleFor = (text: string) =>
    showBubbleValue ? (
      <span data-df="slider-bubble" aria-hidden="true">
        {text}
      </span>
    ) : null

  const pctStyle = (
    pct: number,
    centerCrossAxis = false
  ): React.CSSProperties =>
    isVertical
      ? centerCrossAxis
        ? { bottom: `${pct}%`, left: "50%" }
        : { bottom: `${pct}%` }
      : { left: `${pct}%` }

  const thumbsValueNode = showThumbsValue ? (
    <div data-df="slider-thumb-values" aria-hidden="true">
      {isRange ? (
        <>
          <span data-df="slider-thumb-value" style={pctStyle(lowPct)}>
            {formatOne(low)}
          </span>
          <span data-df="slider-thumb-value" style={pctStyle(highPct)}>
            {formatOne(high)}
          </span>
        </>
      ) : (
        <span data-df="slider-thumb-value" style={pctStyle(singlePct)}>
          {formatOne(single)}
        </span>
      )}
    </div>
  ) : null

  const rangeStyle = isRange
    ? isVertical
      ? {
          bottom: `${Math.min(lowPct, highPct)}%`,
          height: `${Math.abs(highPct - lowPct)}%`,
        }
      : {
          left: `${Math.min(lowPct, highPct)}%`,
          width: `${Math.abs(highPct - lowPct)}%`,
        }
    : isVertical
      ? { bottom: 0, height: `${singlePct}%` }
      : { width: `${singlePct}%` }

  const thumbHeading =
    leading != null || label != null ? (
      <span data-df="slider-thumb-heading">
        {leading != null ? (
          <span data-df="slider-leading" aria-hidden="true">
            {leading}
          </span>
        ) : null}
        {label != null ? (
          <span data-df="slider-thumb-title">{label}</span>
        ) : null}
      </span>
    ) : null
  const thumbDescriptionNode = showThumbDescription ? (
    <span data-df="slider-description">{description}</span>
  ) : null
  const thumbValueNode = showThumbValue ? (
    <span
      data-df="slider-value"
      data-custom={hasCustomValueSlot ? "" : undefined}
    >
      {displayValue}
    </span>
  ) : null
  const thumbMetaContent =
    thumbValueOrder === "value-first" ? (
      <>
        {thumbValueNode}
        {thumbHeading}
        {thumbDescriptionNode}
      </>
    ) : (
      <>
        {thumbHeading}
        {thumbDescriptionNode}
        {thumbValueNode}
      </>
    )

  const activeMarkValue = isRange ? null : single

  const marksNode = useMarks ? (
    <div data-df="slider-marks" aria-hidden="true">
      {resolvedMarks.map((mark) => {
        const active =
          activeMarkValue != null
            ? mark.value === activeMarkValue
            : mark.value === low || mark.value === high
        return (
          <button
            key={mark.value}
            type="button"
            data-df="slider-mark"
            data-active={active ? "" : undefined}
            style={pctStyle(pctOf(mark.value))}
            tabIndex={-1}
            disabled={disabled}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              selectMark(mark.value)
            }}
          >
            {mark.label ?? formatOne(mark.value)}
          </button>
        )
      })}
    </div>
  ) : null

  const renderThumb = (index: 0 | 1, pct: number, now: number) => {
    const aria = thumbAria(index)
    return (
      <span
        data-df="slider-thumb"
        data-index={String(index)}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={aria.ariaLabel}
        aria-labelledby={aria.ariaLabelledBy}
        aria-orientation={orientation}
        aria-valuemin={isRange ? (index === 0 ? min : low) : min}
        aria-valuemax={isRange ? (index === 0 ? high : max) : max}
        aria-valuenow={now}
        aria-valuetext={String(formatOne(now))}
        aria-disabled={disabled || undefined}
        style={pctStyle(pct, true)}
        onFocus={() => setActiveThumb(index)}
        onKeyDown={(e) => handleThumbKeyDown(index, e)}
      >
        {bubbleFor(formatOne(now))}
      </span>
    )
  }

  const headingChrome = hasChromeHeading ? (
    <div data-df="slider-heading-block">
      {label != null || leading != null ? (
        <div data-df="slider-heading">
          {leading != null ? (
            <span data-df="slider-leading" aria-hidden="true">
              {leading}
            </span>
          ) : null}
          {label != null ? (
            <span data-df="slider-label" id={labelId}>
              {label}
            </span>
          ) : null}
        </div>
      ) : null}
      {description != null ? (
        <span data-df="slider-description">{description}</span>
      ) : null}
    </div>
  ) : null

  const valueChrome = resolvedShowValue ? (
    <span
      data-df="slider-value"
      data-custom={hasCustomValueSlot ? "" : undefined}
      data-layout={
        !hasCustomValueSlot &&
        isRange &&
        isVertical &&
        resolvedValuePosition !== "header"
          ? "stack"
          : undefined
      }
    >
      {displayValue}
    </span>
  ) : null

  const chromeNode = (
    slot: SliderChromeSlot,
    content: SliderChromeContent = "both"
  ) => {
    const showHeading = content !== "value" ? headingChrome : null
    const showValue = content !== "heading" ? valueChrome : null
    if (showHeading == null && showValue == null) return null
    return (
      <div
        data-df={SLIDER_CHROME_SLOT[slot]}
        data-has-description={
          content !== "value" && description != null ? "" : undefined
        }
      >
        {showHeading}
        {showValue}
      </div>
    )
  }

  const railNode = (
    <div data-df="slider-rail">
      {showStepButtons ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!canStepDown}
          aria-label={s.sliderDecrease(stepControlName)}
          onClick={() => nudgeByStep(-1)}
        >
          <Minus aria-hidden="true" />
        </Button>
      ) : null}
      <div data-df="slider-control" onPointerDown={onControlPointerDown}>
        <div data-df="slider-track">
          <div data-df="slider-range" style={rangeStyle} />
        </div>
        {isRange ? (
          <>
            {renderThumb(0, lowPct, low)}
            {renderThumb(1, highPct, high)}
          </>
        ) : (
          renderThumb(0, singlePct, single)
        )}
      </div>
      {showStepButtons ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!canStepUp}
          aria-label={s.sliderIncrease(stepControlName)}
          onClick={() => nudgeByStep(1)}
        >
          <Plus aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )

  let trackRowStart: React.ReactNode = null
  let trackRowEnd: React.ReactNode = null
  if (showStartChrome) trackRowStart = chromeNode("start")
  else if (showEndsChrome) trackRowStart = chromeNode("start", "heading")
  else if (showEndsReverseChrome) trackRowStart = chromeNode("start", "value")
  if (showEndChrome) trackRowEnd = chromeNode("end")
  else if (showEndsChrome) trackRowEnd = chromeNode("end", "value")
  else if (showEndsReverseChrome) trackRowEnd = chromeNode("end", "heading")

  const trackRowNode = showInlineChrome ? (
    <div data-df="slider-track-row">
      {trackRowStart}
      {railNode}
      {trackRowEnd}
    </div>
  ) : (
    railNode
  )

  return (
    <div
      ref={ref}
      data-df="slider"
      data-variant={variant}
      data-orientation={orientation}
      data-thickness={thickness}
      data-value-position={resolvedValuePosition}
      data-thumb-value-order={thumbChrome ? thumbValueOrder : undefined}
      data-marks-side={isVertical ? marksSide : undefined}
      data-range={isRange ? "" : undefined}
      data-snap={useMarks ? "marks" : undefined}
      data-step-buttons={showStepButtons ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn(className)}
      {...props}
    >
      {showHeaderChrome ? chromeNode("header", headerChromeContent) : null}
      {!showHeaderChrome &&
      !showFooterChrome &&
      !showInlineChrome &&
      label != null &&
      resolvedValuePosition === "thumb" ? (
        <span data-df="slider-sr-only" id={labelId}>
          {label}
        </span>
      ) : null}

      <div data-df="slider-body">
        {showThumbMeta ? (
          <div data-df="slider-thumb-meta-slot">
            <div
              data-df="slider-thumb-meta"
              style={{ bottom: `${singlePct}%` }}
            >
              {thumbMetaContent}
            </div>
          </div>
        ) : null}

        {trackRowNode}

        {thumbsValueNode}
        {marksNode}
      </div>

      {showFooterChrome ? chromeNode("footer") : null}
    </div>
  )
}

export { Slider }
export type {
  SliderMark,
  SliderMarkInput,
  SliderMarksSide,
  SliderOrientation,
  SliderProps,
  SliderThickness,
  SliderThumbValueOrder,
  SliderValueFormat,
  SliderValuePosition,
  SliderVariant,
}
