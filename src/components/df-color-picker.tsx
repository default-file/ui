"use client"

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { X } from "lucide-react"

import { useDragGesture } from "../hooks"
import { sanitizeCssColor } from "../lib/df-css-value"
import {
  dfColorPickerModeLabel,
  useDfStrings,
  type DfColorPickerMode,
} from "../lib/df-intl"
import {
  dfHoverBorderAttr,
  dfHoverBorderColorStyle,
} from "../lib/hover-border"
import { cn } from "../lib/utils"
import { Input } from "./df-input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./df-popover"
import { Tabs, TabsList, TabsTrigger } from "./df-tabs"

type ColorMode = DfColorPickerMode
type RGB = { r: number; g: number; b: number }
type HSV = { h: number; s: number; v: number }
type HSL = { h: number; s: number; l: number }

const COLOR_MODES: readonly ColorMode[] = ["hex", "rgb", "hsl", "hsb"]

function isColorMode(value: string): value is ColorMode {
  return (COLOR_MODES as readonly string[]).includes(value)
}

/**
 * Hue strip axis: hue rises with positive Y (top = 0). Pointer and keyboard
 * both read this sign so Up decreases hue and moves the thumb up.
 */
const HUE_STRIP = {
  min: 0,
  /** Full circle in degrees; also the announced maximum. */
  span: 360,
  /**
   * Internal ceiling just below the wrap so the thumb stays at the bottom edge
   * instead of jumping to the top when the colour is red.
   */
  internalMax: 359.99,
  step: 1,
} as const

const HUE_LARGE_STEP = HUE_STRIP.span / 10

/**
 * SV surface axes from pointer math: saturation rises with X; brightness rises
 * as Y falls (top of the area is full brightness).
 */
const SV_AREA = {
  min: 0,
  max: 1,
  step: 0.01,
  largeStep: 0.1,
  saturationPerRight: 1,
  brightnessPerDown: -1,
} as const

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function round(n: number, digits = 0) {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** Map a 0-to-1 position down the hue strip to an internal hue. */
function hueFromStripY(normalizedY: number): number {
  return clamp(
    normalizedY * HUE_STRIP.span,
    HUE_STRIP.min,
    HUE_STRIP.internalMax
  )
}

/** Wrap a hue onto the strip domain for circular keyboard stepping. */
function wrapHue(h: number): number {
  const span = HUE_STRIP.span
  const next = ((h % span) + span) % span
  if (next === 0) return HUE_STRIP.min
  if (next > HUE_STRIP.internalMax) return HUE_STRIP.internalMax
  return next
}

/**
 * Step hue by visual travel on the strip. Positive units move down (hue up);
 * negative units move up (hue down). Wraps around the circle. End is treated as
 * span so one step past the bottom lands at 0 + remainder.
 */
function stepHueVisual(current: number, visualDownUnits: number, stepSize: number) {
  const span = HUE_STRIP.span
  const pos = current >= HUE_STRIP.internalMax ? span : current
  return wrapHue(pos + visualDownUnits * stepSize)
}

/** Whole degrees for assistive technology; internalMax announces as span. */
function announcedHue(h: number): number {
  if (h >= HUE_STRIP.internalMax) return HUE_STRIP.span
  return Math.round(h)
}

/** Map pointer position on the SV area to saturation and brightness. */
function svFromPointer(normalizedX: number, normalizedY: number) {
  return {
    s: clamp(normalizedX, SV_AREA.min, SV_AREA.max),
    v: clamp(1 - normalizedY, SV_AREA.min, SV_AREA.max),
  }
}

/**
 * Step an SV channel by visual travel. Right is positive X; down is positive Y.
 * Brightness uses brightnessPerDown so Up raises brightness as drawn.
 */
function stepSvVisual(
  current: HSV,
  visualRightUnits: number,
  visualDownUnits: number,
  stepSize: number
): HSV {
  return {
    ...current,
    s: clamp(
      current.s + visualRightUnits * stepSize * SV_AREA.saturationPerRight,
      SV_AREA.min,
      SV_AREA.max
    ),
    v: clamp(
      current.v + visualDownUnits * stepSize * SV_AREA.brightnessPerDown,
      SV_AREA.min,
      SV_AREA.max
    ),
  }
}

function hexToRgb(hex: string): RGB | null {
  const raw = hex.replace("#", "").trim()
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase()
  return `#${to(r)}${to(g)}${to(b)}`
}

function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  }
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  }
}

function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex)
  if (!rgb) return { h: 0, s: 0, v: 0 }
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

function hsvToHex(hsv: HSV) {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`
  const rgb = hexToRgb(withHash)
  if (!rgb) return null
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

function ChannelField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-2xs font-medium tracking-label text-muted-foreground uppercase">
        {label}
      </span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        className="h-8 px-2 font-mono text-xs tabular-nums"
        onChange={(event) => {
          const next = Number(event.target.value)
          if (!Number.isFinite(next)) return
          onChange(clamp(next, min, max))
        }}
      />
    </label>
  )
}

type ColorPickerTrailing = "hex" | "clear"

type ColorPickerProps = {
  value: string
  onChange: (hex: string) => void
  label?: string
  className?: string
  trailing?: ColorPickerTrailing
  onClear?: () => void
  clearLabel?: string
  hoverBorder?: boolean
  hoverBorderColor?: string
}

function SwatchDot({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const safeColor = sanitizeCssColor(value)
  return (
    <span
      className={cn(
        "relative block size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10",
        className
      )}
      aria-hidden
    >
      <span
        className="absolute inset-0 rounded-full"
        style={safeColor != null ? { backgroundColor: safeColor } : undefined}
      />
    </span>
  )
}

export function ColorPicker({
  value,
  onChange,
  label,
  className,
  trailing,
  onClear,
  clearLabel,
  hoverBorder,
  hoverBorderColor,
}: ColorPickerProps) {
  const strings = useDfStrings()
  const triggerLabel = label ?? strings.colorPickerLabel
  const resolvedClearLabel = clearLabel ?? strings.colorPickerClear

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ColorMode>("hex")
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const [hexDraft, setHexDraft] = useState(() => value.toUpperCase())
  // Tracks the last seen `value` and `open`. While closed, a change to either
  // restores draft state from the controlled value.
  const [closedSync, setClosedSync] = useState({ value, open })
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const { begin: beginDrag } = useDragGesture()

  if (value !== closedSync.value || open !== closedSync.open) {
    setClosedSync({ value, open })
    if (!open) {
      setHsv(hexToHsv(value))
      setHexDraft(value.toUpperCase())
    }
  }

  const hoverBorderAttr = dfHoverBorderAttr(hoverBorder)
  const pillChromeStyle = {
    ...dfHoverBorderColorStyle(
      "--df-color-picker-hover-border",
      hoverBorder,
      hoverBorderColor
    ),
  } as CSSProperties

  const rgb = useMemo(
    () => hsvToRgb(hsv.h, hsv.s, hsv.v),
    [hsv.h, hsv.s, hsv.v]
  )
  const hsl = useMemo(
    () => rgbToHsl(rgb.r, rgb.g, rgb.b),
    [rgb.r, rgb.g, rgb.b]
  )
  const hex = useMemo(() => hsvToHex(hsv), [hsv])

  const satPercent = round(hsv.s * 100)
  const brightnessPercent = round(hsv.v * 100)
  const hueAnnounced = announcedHue(hsv.h)

  const commitHsv = useCallback(
    (next: HSV) => {
      const safe = {
        h: clamp(next.h, HUE_STRIP.min, HUE_STRIP.internalMax),
        s: clamp(next.s, SV_AREA.min, SV_AREA.max),
        v: clamp(next.v, SV_AREA.min, SV_AREA.max),
      }
      setHsv(safe)
      const nextHex = hsvToHex(safe)
      setHexDraft(nextHex)
      onChange(nextHex)
    },
    [onChange]
  )

  const commitRgb = (next: RGB) => {
    commitHsv(rgbToHsv(next.r, next.g, next.b))
  }

  const commitHsl = (next: HSL) => {
    commitRgb(hslToRgb(next.h, next.s, next.l))
  }

  const handleSvPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const data = { hue: hsv.h }
      const apply = (clientX: number, clientY: number, hue: number) => {
        const el = svRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const { s, v } = svFromPointer(
          (clientX - rect.left) / rect.width,
          (clientY - rect.top) / rect.height
        )
        commitHsv({ h: hue, s, v })
      }
      apply(event.clientX, event.clientY, data.hue)
      beginDrag(event, data, {
        onMove: (moveEvent, gesture) => {
          apply(moveEvent.clientX, moveEvent.clientY, gesture.hue)
        },
      })
    },
    [beginDrag, commitHsv, hsv.h]
  )

  const handleHuePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const data = { sat: hsv.s, val: hsv.v }
      const apply = (_clientX: number, clientY: number, sat: number, val: number) => {
        const el = hueRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const h = hueFromStripY((clientY - rect.top) / rect.height)
        commitHsv({ h, s: sat, v: val })
      }
      apply(event.clientX, event.clientY, data.sat, data.val)
      beginDrag(event, data, {
        onMove: (moveEvent, gesture) => {
          apply(moveEvent.clientX, moveEvent.clientY, gesture.sat, gesture.val)
        },
      })
    },
    [beginDrag, commitHsv, hsv.s, hsv.v]
  )

  const handleSvKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: HSV | null = null
      switch (event.key) {
        case "ArrowRight":
          next = stepSvVisual(hsv, 1, 0, SV_AREA.step)
          break
        case "ArrowLeft":
          next = stepSvVisual(hsv, -1, 0, SV_AREA.step)
          break
        case "ArrowUp":
          next = stepSvVisual(hsv, 0, -1, SV_AREA.step)
          break
        case "ArrowDown":
          next = stepSvVisual(hsv, 0, 1, SV_AREA.step)
          break
        case "PageUp":
          next = stepSvVisual(hsv, 0, -1, SV_AREA.largeStep)
          break
        case "PageDown":
          next = stepSvVisual(hsv, 0, 1, SV_AREA.largeStep)
          break
        case "Home":
          next = { ...hsv, s: SV_AREA.min }
          break
        case "End":
          next = { ...hsv, s: SV_AREA.max }
          break
        default:
          return
      }
      event.preventDefault()
      commitHsv(next)
    },
    [commitHsv, hsv]
  )

  const handleHueKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: HSV | null = null
      switch (event.key) {
        case "ArrowUp":
        case "ArrowLeft":
          // Up decreases hue: top of the strip is 0 degrees.
          next = {
            ...hsv,
            h: stepHueVisual(hsv.h, -1, HUE_STRIP.step),
          }
          break
        case "ArrowDown":
        case "ArrowRight":
          next = {
            ...hsv,
            h: stepHueVisual(hsv.h, 1, HUE_STRIP.step),
          }
          break
        case "PageUp":
          next = {
            ...hsv,
            h: stepHueVisual(hsv.h, -1, HUE_LARGE_STEP),
          }
          break
        case "PageDown":
          next = {
            ...hsv,
            h: stepHueVisual(hsv.h, 1, HUE_LARGE_STEP),
          }
          break
        case "Home":
          next = { ...hsv, h: HUE_STRIP.min }
          break
        case "End":
          next = { ...hsv, h: HUE_STRIP.internalMax }
          break
        default:
          return
      }
      event.preventDefault()
      commitHsv(next)
    },
    [commitHsv, hsv]
  )

  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 })
  const safePureHue = sanitizeCssColor(pureHue)
  const safeHex = sanitizeCssColor(hex)
  const safeValue = sanitizeCssColor(value)

  const popover = (
    <PopoverContent
      align="start"
      side="bottom"
      sideOffset={8}
      className="gap-3 overflow-visible rounded-xl p-3 shadow-xl"
      style={{ width: "var(--df-color-picker-width)" }}
    >
      <div
        className="flex shrink-0 gap-2.5"
        style={{ height: "var(--df-color-picker-height)" }}
      >
        {/*
          Slider role exposes saturation as the numeric value; brightness is
          announced only through aria-valuetext.
        */}
        <div
          ref={svRef}
          role="slider"
          tabIndex={0}
          aria-label={strings.colorPickerArea}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={satPercent}
          aria-valuetext={strings.colorPickerAreaValue({
            saturation: satPercent,
            brightness: brightnessPercent,
          })}
          className="relative min-w-0 flex-1 cursor-crosshair touch-none overflow-hidden rounded-lg ring-1 ring-border focus-within:shadow-[var(--focus-ring)]"
          style={{
            height: "var(--df-color-picker-height)",
            backgroundColor: safePureHue ?? undefined,
            backgroundImage: `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, transparent)
              `,
          }}
          onPointerDown={handleSvPointerDown}
          onKeyDown={handleSvKeyDown}
        >
          <span
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              backgroundColor: safeHex ?? undefined,
              boxShadow: "var(--df-shadow-picker-thumb)",
            }}
          />
        </div>

        <div
          ref={hueRef}
          role="slider"
          tabIndex={0}
          aria-label={strings.colorPickerHue}
          aria-orientation="vertical"
          aria-valuemin={HUE_STRIP.min}
          aria-valuemax={HUE_STRIP.span}
          aria-valuenow={hueAnnounced}
          aria-valuetext={strings.colorPickerHueValue(hueAnnounced)}
          className="relative shrink-0 cursor-ns-resize touch-none overflow-hidden rounded-lg ring-1 ring-border focus-within:shadow-[var(--focus-ring)]"
          style={{
            width: "calc(5 * var(--spacing-unit, 0.25rem))",
            height: "var(--df-color-picker-height)",
            backgroundImage:
              "linear-gradient(to bottom, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
          }}
          onPointerDown={handleHuePointerDown}
          onKeyDown={handleHueKeyDown}
        >
          <span
            className="pointer-events-none absolute left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{
              top: `${(hsv.h / HUE_STRIP.span) * 100}%`,
              backgroundColor: safePureHue ?? undefined,
              boxShadow: "var(--df-shadow-picker-thumb)",
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="size-9 shrink-0 rounded-lg ring-1 ring-black/10"
          style={{ backgroundColor: safeHex ?? undefined }}
          aria-hidden
        />
        <Tabs
          value={mode}
          onValueChange={(next) => {
            if (isColorMode(next)) setMode(next)
          }}
          variant="segment"
          size="sm"
          className="min-w-0 flex-1"
        >
          <TabsList aria-label={strings.colorPickerInputMode}>
            {COLOR_MODES.map((id) => (
              <TabsTrigger key={id} value={id}>
                {dfColorPickerModeLabel(strings, id)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {mode === "hex" ? (
        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium tracking-label text-muted-foreground uppercase">
            {strings.colorPickerModeHex}
          </span>
          <Input
            value={hexDraft}
            spellCheck={false}
            aria-label={strings.colorPickerHex}
            className="h-8 font-mono text-xs uppercase"
            onChange={(event) => {
              const next = event.target.value.toUpperCase()
              setHexDraft(next)
              const normalized = normalizeHex(next)
              if (!normalized) return
              setHsv(hexToHsv(normalized))
              onChange(normalized)
            }}
            onBlur={() => {
              const normalized = normalizeHex(hexDraft)
              if (normalized) {
                setHexDraft(normalized)
                return
              }
              setHexDraft(hex)
            }}
          />
        </label>
      ) : null}

      {mode === "rgb" ? (
        <div className="flex gap-1.5">
          <ChannelField
            label={strings.colorPickerChannelR}
            value={round(rgb.r)}
            min={0}
            max={255}
            onChange={(r) => commitRgb({ ...rgb, r })}
          />
          <ChannelField
            label={strings.colorPickerChannelG}
            value={round(rgb.g)}
            min={0}
            max={255}
            onChange={(g) => commitRgb({ ...rgb, g })}
          />
          <ChannelField
            label={strings.colorPickerChannelB}
            value={round(rgb.b)}
            min={0}
            max={255}
            onChange={(b) => commitRgb({ ...rgb, b })}
          />
        </div>
      ) : null}

      {mode === "hsl" ? (
        <div className="flex gap-1.5">
          <ChannelField
            label={strings.colorPickerChannelH}
            value={round(hsl.h)}
            min={0}
            max={360}
            onChange={(h) => commitHsl({ ...hsl, h })}
          />
          <ChannelField
            label={strings.colorPickerChannelS}
            value={round(hsl.s * 100)}
            min={0}
            max={100}
            onChange={(s) => commitHsl({ ...hsl, s: s / 100 })}
          />
          <ChannelField
            label={strings.colorPickerChannelL}
            value={round(hsl.l * 100)}
            min={0}
            max={100}
            onChange={(l) => commitHsl({ ...hsl, l: l / 100 })}
          />
        </div>
      ) : null}

      {mode === "hsb" ? (
        <div className="flex gap-1.5">
          <ChannelField
            label={strings.colorPickerChannelH}
            value={round(hsv.h)}
            min={0}
            max={360}
            onChange={(h) => commitHsv({ ...hsv, h })}
          />
          <ChannelField
            label={strings.colorPickerChannelS}
            value={round(hsv.s * 100)}
            min={0}
            max={100}
            onChange={(s) => commitHsv({ ...hsv, s: s / 100 })}
          />
          <ChannelField
            label={strings.colorPickerChannelV}
            value={round(hsv.v * 100)}
            min={0}
            max={100}
            onChange={(v) => commitHsv({ ...hsv, v: v / 100 })}
          />
        </div>
      ) : null}
    </PopoverContent>
  )

  if (trailing === "hex") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={triggerLabel}
              data-df="color-picker-trigger"
              data-trailing="hex"
              data-hover-border={hoverBorderAttr}
              className={cn(className)}
              style={pillChromeStyle}
            />
          }
        >
          <SwatchDot value={value} />
          <span
            className="inline-block shrink-0 font-mono text-11 font-semibold uppercase leading-none text-neutral-700"
            style={{ width: "var(--df-color-picker-hex-width)" }}
          >
            {value}
          </span>
        </PopoverTrigger>
        {popover}
      </Popover>
    )
  }

  if (trailing === "clear") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div
          data-df="color-picker-trigger"
          data-trailing="clear"
          data-hover-border={hoverBorderAttr}
          className={cn(className)}
          style={pillChromeStyle}
        >
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={triggerLabel}
                data-df="color-picker-open"
              />
            }
          >
            <SwatchDot value={value} />
          </PopoverTrigger>
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
            aria-label={resolvedClearLabel}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onClear?.()
            }}
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
        {popover}
      </Popover>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={triggerLabel}
            className={cn(
              "relative size-4 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10 transition-transform hover:scale-105",
              className
            )}
          />
        }
      >
        <span
          className="absolute inset-0 rounded-full"
          style={
            safeValue != null ? { backgroundColor: safeValue } : undefined
          }
          aria-hidden
        />
      </PopoverTrigger>
      {popover}
    </Popover>
  )
}

export type { ColorPickerProps, ColorPickerTrailing }
