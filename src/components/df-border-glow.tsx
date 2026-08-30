"use client"

import * as React from "react"

import { useIsomorphicLayoutEffect } from "../hooks"
import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import {
  parseCssHslChannelTriplet,
  sanitizeCssColor,
} from "../lib/df-css-value"
import { cn } from "../lib/utils"

type BorderGlowVariant = "default" | "light"

type BorderGlowProps = {
  children?: React.ReactNode
  className?: string
  variant?: BorderGlowVariant
  edgeSensitivity?: number
  glowColor?: string
  backgroundColor?: string
  strokeColor?: string
  borderRadius?: number
  cornerShape?: DfCornerShape
  glowRadius?: number
  glowIntensity?: number
  coneSpread?: number
  animated?: boolean
  colors?: string[]
  fillOpacity?: number
  bloom?: boolean
  trace?: boolean
  outlineOffset?: number
  outlineWidth?: number
  followDuration?: number
  revealDuration?: number
  arcFade?: number
}

const MESH_BY_VARIANT = {
  default: [
    "var(--df-border-glow-color-1)",
    "var(--df-border-glow-color-2)",
    "var(--df-border-glow-color-3)",
  ],
  light: [
    "var(--df-border-glow-light-color-1)",
    "var(--df-border-glow-light-color-2)",
    "var(--df-border-glow-light-color-3)",
  ],
} as const

const MESH_BLOBS = [
  { at: "80% 55%", stop: 0, varName: "--df-border-glow-g1" },
  { at: "69% 34%", stop: 1, varName: "--df-border-glow-g2" },
  { at: "8% 6%", stop: 2, varName: "--df-border-glow-g3" },
  { at: "41% 38%", stop: 0, varName: "--df-border-glow-g4" },
  { at: "86% 85%", stop: 1, varName: "--df-border-glow-g5" },
  { at: "82% 18%", stop: 2, varName: "--df-border-glow-g6" },
  { at: "51% 4%", stop: 1, varName: "--df-border-glow-g7" },
] as const

const BLOOM_LAYERS = [
  { suffix: "-100", opacity: 100 },
  { suffix: "-60", opacity: 60 },
  { suffix: "-50", opacity: 50 },
  { suffix: "-40", opacity: 40 },
  { suffix: "-30", opacity: 30 },
  { suffix: "-20", opacity: 20 },
  { suffix: "-10", opacity: 10 },
] as const

const SWEEP = {
  angleFrom: 110,
  angleTo: 465,
  riseMs: 500,
  spinInMs: 1500,
  spinOutMs: 2250,
  fadeMs: 1500,
  spinOutDelayMs: 1500,
  fadeDelayMs: 2500,
  midProgress: 50,
} as const

const POINTER_SMOOTHING = 0.18

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1)
}

function inkLayersFromColor(
  glowColor: string,
  intensity: number
): Record<string, string> {
  const layers: Record<string, string> = {}
  const triplet = parseCssHslChannelTriplet(glowColor)
  if (triplet != null) {
    const channels = `${triplet.h}deg ${triplet.s}% ${triplet.l}%`
    for (const layer of BLOOM_LAYERS) {
      const pct = Math.min(layer.opacity * intensity, 100)
      layers[`--df-border-glow-ink${layer.suffix}`] = `hsl(${channels} / ${pct}%)`
    }
    return layers
  }
  const safeColor = sanitizeCssColor(glowColor)
  if (safeColor == null) return layers
  for (const layer of BLOOM_LAYERS) {
    const pct = Math.min(layer.opacity * intensity, 100)
    layers[`--df-border-glow-ink${layer.suffix}`] =
      `color-mix(in oklch, ${safeColor} ${pct}%, transparent)`
  }
  return layers
}

function meshLayersFromColors(colors: string[]): Record<string, string> {
  const safeColors = colors
    .map((color) => sanitizeCssColor(color))
    .filter((color): color is string => color != null)
  if (safeColors.length === 0) return {}
  const last = Math.max(safeColors.length - 1, 0)
  const layers: Record<string, string> = {}
  for (const blob of MESH_BLOBS) {
    const color = safeColors[Math.min(blob.stop, last)]!
    layers[blob.varName] =
      `radial-gradient(at ${blob.at}, ${color} 0%, transparent 50%)`
  }
  layers["--df-border-glow-g-base"] = `linear-gradient(${safeColors[0]} 0 100%)`
  return layers
}

function traceInkVars(colors: string[]): Record<string, string> {
  const safeColors = colors
    .map((color) => sanitizeCssColor(color))
    .filter((color): color is string => color != null)
  if (safeColors.length === 0) return {}
  const last = Math.max(safeColors.length - 1, 0)
  const ink1 = safeColors[0]!
  const ink2 = safeColors[Math.min(1, last)]!
  const ink3 = safeColors[Math.min(2, last)]!
  const ink4 = safeColors[Math.min(3, last)]!
  return {
    "--df-border-glow-trace-ink": ink1,
    "--df-border-glow-trace-ink-1": ink1,
    "--df-border-glow-trace-ink-2": ink2,
    "--df-border-glow-trace-ink-3": ink3,
    "--df-border-glow-trace-ink-4": ink4,
  }
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function easeInCubic(t: number) {
  return t ** 3
}

type TweenOpts = {
  from?: number
  to?: number
  ms?: number
  waitMs?: number
  easing?: (t: number) => number
  onFrame: (value: number) => void
  onDone?: () => void
}

function tweenNumber({
  from = 0,
  to = 100,
  ms = 1000,
  waitMs = 0,
  easing = easeOutCubic,
  onFrame,
  onDone,
}: TweenOpts) {
  const clockOrigin = performance.now() + waitMs
  const step = () => {
    const t = Math.min((performance.now() - clockOrigin) / ms, 1)
    onFrame(from + (to - from) * easing(t))
    if (t < 1) requestAnimationFrame(step)
    else onDone?.()
  }
  window.setTimeout(() => requestAnimationFrame(step), waitMs)
}

function pointerGeometry(
  el: HTMLElement,
  localX: number,
  localY: number
): { edge: number; angleDeg: number } {
  const { width, height } = el.getBoundingClientRect()
  const cx = width / 2
  const cy = height / 2
  const dx = localX - cx
  const dy = localY - cy

  const nx = cx === 0 ? 0 : Math.abs(dx) / cx
  const ny = cy === 0 ? 0 : Math.abs(dy) / cy
  const edge = clamp01(Math.max(nx, ny))

  if (dx === 0 && dy === 0) return { edge, angleDeg: 0 }
  const angleDeg =
    (((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360 + 360) % 360
  return { edge, angleDeg }
}

function writePointerCss(card: HTMLElement, edge: number, angleDeg: number) {
  card.style.setProperty("--df-border-glow-edge", (edge * 100).toFixed(3))
  card.style.setProperty("--df-border-glow-angle", `${angleDeg.toFixed(3)}deg`)
}

function easeOutQuint(t: number) {
  return 1 - (1 - t) ** 5
}

function writeTraceCss(
  card: HTMLElement,
  reveal: number,
  angleDeg: number,
  arcDeg: number
) {
  card.style.setProperty("--df-border-glow-trace", reveal.toFixed(4))
  card.style.setProperty("--df-border-glow-trace-arc", `${arcDeg.toFixed(3)}deg`)
  card.style.setProperty("--df-border-glow-angle", `${angleDeg.toFixed(3)}deg`)
}

function runIntroSweep(card: HTMLElement) {
  const { angleFrom, angleTo } = SWEEP
  const span = angleTo - angleFrom
  const writeAngle = (progress: number) => {
    card.style.setProperty(
      "--df-border-glow-angle",
      `${span * (progress / 100) + angleFrom}deg`
    )
  }

  card.classList.add("is-sweeping")
  card.style.setProperty("--df-border-glow-angle", `${angleFrom}deg`)

  tweenNumber({
    ms: SWEEP.riseMs,
    onFrame: (v) => card.style.setProperty("--df-border-glow-edge", `${v}`),
  })
  tweenNumber({
    easing: easeInCubic,
    ms: SWEEP.spinInMs,
    to: SWEEP.midProgress,
    onFrame: writeAngle,
  })
  tweenNumber({
    easing: easeOutCubic,
    waitMs: SWEEP.spinOutDelayMs,
    ms: SWEEP.spinOutMs,
    from: SWEEP.midProgress,
    to: 100,
    onFrame: writeAngle,
  })
  tweenNumber({
    easing: easeInCubic,
    waitMs: SWEEP.fadeDelayMs,
    ms: SWEEP.fadeMs,
    from: 100,
    to: 0,
    onFrame: (v) => card.style.setProperty("--df-border-glow-edge", `${v}`),
    onDone: () => card.classList.remove("is-sweeping"),
  })
}

function BorderGlow({
  children,
  className,
  variant = "default",
  edgeSensitivity = 0,
  glowColor,
  backgroundColor,
  strokeColor,
  borderRadius,
  cornerShape,
  glowRadius,
  glowIntensity = 0.8,
  coneSpread,
  animated = false,
  colors,
  fillOpacity,
  bloom = true,
  trace = false,
  outlineOffset,
  outlineWidth,
  followDuration,
  revealDuration,
  arcFade,
}: BorderGlowProps) {
  const cardRef = React.useRef<HTMLDivElement>(null)
  const frameRef = React.useRef(0)
  const lastFrameRef = React.useRef(0)
  const advancePoseRef = React.useRef<() => void>(() => {})
  const poseRef = React.useRef({
    angle: 45,
    edge: 0,
    reveal: 0,
    targetAngle: 45,
    targetEdge: 0,
    targetReveal: 0,
    unwrapped: 45,
    revealFrom: 0,
    revealTo: 0,
    revealStartedAt: 0,
    revealActive: false,
  })
  const isLight = variant === "light"
  const bloomOn = bloom && !trace
  const resolvedCone = coneSpread ?? (trace ? 20 : 5)
  const resolvedFollow = followDuration ?? (trace ? 0.5 : 0)
  const resolvedReveal = revealDuration ?? (trace ? 0.7 : 0)
  const resolvedArcFade = clamp01(arcFade ?? (trace ? 0.75 : 0))
  const fullArcDeg = resolvedCone * 3.6
  const defaultFace = isLight
    ? "var(--df-border-glow-light-bg)"
    : "var(--df-border-glow-bg)"
  const defaultStroke = isLight
    ? "var(--df-border-glow-light-stroke)"
    : "var(--df-border-glow-stroke)"
  const defaultInk = trace
    ? "var(--df-neutral-1000)"
    : isLight
      ? "var(--df-border-glow-light-ink-base)"
      : "var(--df-border-glow-ink-base)"
  const face =
    backgroundColor != null
      ? (sanitizeCssColor(backgroundColor) ?? defaultFace)
      : defaultFace
  const stroke =
    strokeColor != null
      ? (sanitizeCssColor(strokeColor) ?? defaultStroke)
      : defaultStroke
  const glowTriplet =
    glowColor != null ? parseCssHslChannelTriplet(glowColor) : null
  const ink =
    glowColor != null
      ? glowTriplet != null
        ? glowColor
        : (sanitizeCssColor(glowColor) ?? defaultInk)
      : defaultInk
  const defaultMesh = [
    ...(MESH_BY_VARIANT[isLight ? "light" : "default"] as readonly string[]),
  ]
  const traceColors =
    colors != null && colors.length > 0
      ? colors
          .map((color) => sanitizeCssColor(color))
          .filter((color): color is string => color != null)
      : glowTriplet != null
        ? [defaultInk]
        : [ink]
  const resolvedTraceColors =
    traceColors.length > 0 ? traceColors : [defaultInk]
  const mesh =
    colors != null && colors.length > 0
      ? (() => {
          const safe = colors
            .map((color) => sanitizeCssColor(color))
            .filter((color): color is string => color != null)
          return safe.length > 0 ? safe : defaultMesh
        })()
      : trace
        ? glowTriplet != null
          ? [defaultInk]
          : [ink]
        : defaultMesh
  const wash = fillOpacity ?? (bloomOn ? 0.5 : 0)

  useIsomorphicLayoutEffect(() => {
    advancePoseRef.current = () => {
      const card = cardRef.current
      if (!card) {
        frameRef.current = 0
        lastFrameRef.current = 0
        return
      }

      const now = performance.now()
      const dt = lastFrameRef.current
        ? Math.min((now - lastFrameRef.current) / 1000, 0.05)
        : 1 / 60
      lastFrameRef.current = now

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      const pose = poseRef.current
      const followTau = Math.max(resolvedFollow, 0.001) / 3
      const followK = reduceMotion
        ? 1
        : resolvedFollow <= 0
          ? POINTER_SMOOTHING
          : 1 - Math.exp(-dt / followTau)

      const angleDelta = ((pose.targetAngle - pose.angle + 540) % 360) - 180
      pose.angle = (pose.angle + angleDelta * followK + 360) % 360
      pose.edge += (pose.targetEdge - pose.edge) * followK

      if (trace && pose.revealActive) {
        const duration = Math.max(resolvedReveal, 0.001)
        const t = reduceMotion
          ? 1
          : clamp01((now - pose.revealStartedAt) / (duration * 1000))
        const eased = easeOutQuint(t)
        pose.reveal =
          pose.revealFrom + (pose.revealTo - pose.revealFrom) * eased
        if (t >= 1) {
          pose.reveal = pose.revealTo
          pose.revealActive = false
        }
      }

      if (trace) {
        writeTraceCss(
          card,
          pose.reveal,
          pose.angle,
          fullArcDeg * pose.reveal
        )
      } else {
        writePointerCss(card, pose.edge, pose.angle)
      }

      const settled =
        Math.abs(angleDelta) < 0.05 &&
        Math.abs(pose.targetEdge - pose.edge) < 0.0005 &&
        (!trace || !pose.revealActive)
      if (settled) {
        pose.angle = pose.targetAngle
        pose.edge = pose.targetEdge
        if (trace) {
          writeTraceCss(
            card,
            pose.reveal,
            pose.angle,
            fullArcDeg * pose.reveal
          )
        } else {
          writePointerCss(card, pose.edge, pose.angle)
        }
        frameRef.current = 0
        lastFrameRef.current = 0
        return
      }
      frameRef.current = requestAnimationFrame(() => {
        advancePoseRef.current()
      })
    }
  }, [fullArcDeg, resolvedFollow, resolvedReveal, trace])

  const requestPose = React.useCallback(() => {
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        advancePoseRef.current()
      })
    }
  }, [])

  const beginReveal = React.useCallback(
    (to: number) => {
      const pose = poseRef.current
      pose.revealFrom = pose.reveal
      pose.revealTo = to
      pose.targetReveal = to
      pose.revealStartedAt = performance.now()
      pose.revealActive = true
    },
    []
  )

  const onPointerEnter = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!trace) return
      const card = cardRef.current
      if (!card) return
      const rect = card.getBoundingClientRect()
      const { angleDeg } = pointerGeometry(
        card,
        event.clientX - rect.left,
        event.clientY - rect.top
      )
      const pose = poseRef.current
      pose.angle = angleDeg
      pose.targetAngle = angleDeg
      pose.unwrapped = angleDeg
      pose.reveal = 0
      writeTraceCss(card, 0, angleDeg, 0)
      beginReveal(1)
      requestPose()
    },
    [beginReveal, requestPose, trace]
  )

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const card = cardRef.current
      if (!card) return
      const rect = card.getBoundingClientRect()
      const { edge, angleDeg } = pointerGeometry(
        card,
        event.clientX - rect.left,
        event.clientY - rect.top
      )
      const pose = poseRef.current
      if (trace) {
        const delta = ((angleDeg - pose.unwrapped + 540) % 360) - 180
        pose.unwrapped += delta
        pose.targetAngle = ((pose.unwrapped % 360) + 360) % 360
        pose.targetReveal = 1
      } else {
        pose.targetEdge = edge
        pose.targetAngle = angleDeg
      }
      requestPose()
    },
    [requestPose, trace]
  )

  const onPointerLeave = React.useCallback(() => {
    if (trace) beginReveal(0)
    else poseRef.current.targetEdge = 0
    requestPose()
  }, [beginReveal, requestPose, trace])

  React.useEffect(() => {
    if (!animated || !cardRef.current || trace) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    runIntroSweep(cardRef.current)
  }, [animated, trace])

  React.useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
      lastFrameRef.current = 0
    }
  }, [])

  return (
    <div
      ref={cardRef}
      data-df="border-glow"
      data-variant={variant}
      data-bloom={bloomOn ? undefined : "false"}
      data-trace={trace ? "true" : undefined}
      data-corner-shape={cornerShape}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn("df-border-glow", className)}
      style={
        {
          "--df-border-glow-bg-local": face,
          "--df-border-glow-stroke-used": stroke,
          "--df-border-glow-edge-sensitivity": edgeSensitivity,
          "--df-border-glow-cone-spread-local": resolvedCone,
          "--df-border-glow-fill-opacity-local": wash,
          "--df-border-glow-trace": 0,
          "--df-border-glow-trace-arc": "0deg",
          ...(glowRadius != null
            ? { "--df-border-glow-glow-radius-local": `${glowRadius}px` }
            : null),
          ...(borderRadius != null
            ? { "--df-border-glow-radius-local": `${borderRadius}px` }
            : null),
          ...(outlineOffset != null
            ? { "--df-border-glow-outline-offset": `${outlineOffset}px` }
            : null),
          ...(outlineWidth != null
            ? { "--df-border-glow-outline-width": `${outlineWidth}px` }
            : null),
          ...(trace
            ? { "--df-border-glow-trace-fade": resolvedArcFade }
            : null),
          ...dfCornerShapeStyle(cornerShape),
          ...(bloomOn ? inkLayersFromColor(ink, glowIntensity) : null),
          ...(trace ? traceInkVars(resolvedTraceColors) : null),
          ...meshLayersFromColors(mesh),
        } as React.CSSProperties
      }
    >
      <span className="df-border-glow-edge-light" aria-hidden />
      <div className="df-border-glow-inner">{children}</div>
    </div>
  )
}

export { BorderGlow }
export type { BorderGlowProps, BorderGlowVariant, DfCornerShape }
