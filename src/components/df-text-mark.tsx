"use client"

import * as React from "react"
import { annotate, annotationGroup } from "rough-notation"
import type {
  RoughAnnotation,
  RoughAnnotationGroup,
} from "rough-notation/lib/model"

import { useIsomorphicLayoutEffect, useLatestRef } from "../hooks"
import { cn } from "../lib/utils"

/** Supported annotation shapes drawn around or behind the text. */
type TextMarkKind =
  | "highlight"
  | "underline"
  | "box"
  | "circle"
  | "bracket"
  | "strike-through"
  | "crossed-off"

type TextMarkBracketSide = "left" | "right" | "top" | "bottom"

type TextMarkLayer = {
  /** Annotation shape for this layer. */
  kind: TextMarkKind
  /** CSS color; tokens and color-mix resolve at draw time. */
  color?: string | undefined
  /** Stroke thickness in CSS pixels. */
  strokeWidth?: number | undefined
  /** Draw duration in milliseconds. */
  duration?: number | undefined
  /**
   * Extra sketch passes. Higher values look less uniform.
   * Underlines and circles benefit from 2 to 4.
   */
  iterations?: number | undefined
  /**
   * Inset or grow space around the glyphs in CSS pixels.
   * Raise this to scale circles and boxes outward.
   */
  padding?: number | undefined
  /** Bracket sides when kind is bracket. */
  brackets?: TextMarkBracketSide | TextMarkBracketSide[] | undefined
}

type TextMarkProps = {
  children: React.ReactNode
  className?: string
  /** When true, show the annotation; when false, hide it. */
  active?: boolean
  /**
   * Single annotation shape. highlight is a marker wash, underline a
   * hand drawn baseline, circle a hand drawn oval. Ignored when layers is set.
   */
  kind?: TextMarkKind
  /** Stacked annotations on the same span, drawn in order. */
  layers?: TextMarkLayer[]
  /** CSS color for the single kind path. Defaults to --df-text-mark. */
  color?: string
  /** Optional text color while active. Omit to keep inherited ink. */
  activeColor?: string
  /** Stroke thickness in CSS pixels for the single kind path. */
  strokeWidth?: number
  /** Draw duration in milliseconds for the single kind path. */
  duration?: number
  /**
   * Extra sketch passes for the single kind path.
   * Default 3 for underline and circle.
   */
  iterations?: number
  /**
   * Extra space around the glyphs in CSS pixels.
   * Default is larger for circle.
   */
  padding?: number
  /** Bracket sides when kind is bracket. */
  brackets?: TextMarkBracketSide | TextMarkBracketSide[]
  /**
   * When true, annotate each visual line of wrapped text.
   * Set false to treat the content as one box.
   */
  multiline?: boolean
}

const DEFAULT_COLOR = "var(--df-text-mark)"

function defaultIterations(kind: TextMarkKind): number {
  if (kind === "underline" || kind === "circle") return 3
  return 2
}

function defaultPadding(kind: TextMarkKind): number {
  if (kind === "circle") return 12
  if (kind === "box") return 6
  return 2
}

function defaultColor(kind: TextMarkKind): string {
  if (kind === "circle" || kind === "underline") {
    return "var(--df-text-mark-blue)"
  }
  if (kind === "highlight") return "var(--df-text-mark-yellow)"
  return DEFAULT_COLOR
}

function resolveCssColor(cssColor: string, host: HTMLElement): string {
  const probe = document.createElement("span")
  probe.style.color = cssColor
  host.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  host.removeChild(probe)
  return resolved || cssColor
}

function hasLaidOutGlyphs(element: HTMLElement): boolean {
  const rects = element.getClientRects()
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i]
    if (rect && rect.width > 0 && rect.height > 0) return true
  }
  return false
}

function pinSvgs(host: HTMLElement) {
  // rough-notation inserts SVG siblings inside the host.
  host.querySelectorAll("svg.rough-annotation").forEach((svg) => {
    if (!(svg instanceof SVGElement)) return
    svg.style.pointerEvents = "none"
    // Highlights sit behind glyphs; strokes sit above.
    const isHighlight = svg.previousElementSibling == null
    svg.style.zIndex = isHighlight ? "0" : "var(--z-raised)"
  })
}

/**
 * Animated hand drawn mark for inline text.
 * Supports marker washes, hand drawn underlines, and hand drawn circles.
 * Glyphs sit above the annotation so copy stays readable.
 */
function TextMark({
  children,
  className,
  active = true,
  kind = "highlight",
  layers,
  color,
  activeColor,
  strokeWidth = 1.5,
  duration = 600,
  iterations,
  padding,
  brackets,
  multiline = true,
}: TextMarkProps) {
  const hostRef = React.useRef<HTMLSpanElement>(null)
  const targetRef = React.useRef<HTMLSpanElement>(null)
  const groupRef = React.useRef<RoughAnnotationGroup | null>(null)
  const annotationsRef = React.useRef<RoughAnnotation[]>([])
  const activeRef = useLatestRef(active)

  const resolvedLayers = React.useMemo<TextMarkLayer[]>(() => {
    if (layers && layers.length > 0) return layers
    return [
      {
        kind,
        color: color ?? defaultColor(kind),
        strokeWidth,
        duration,
        iterations: iterations ?? defaultIterations(kind),
        padding: padding ?? defaultPadding(kind),
        brackets,
      },
    ]
  }, [
    layers,
    kind,
    color,
    strokeWidth,
    duration,
    iterations,
    padding,
    brackets,
  ])

  const layersKey = JSON.stringify(resolvedLayers)

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    const target = targetRef.current
    if (!host || !target) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let rafOuter = 0
    let rafInner = 0

    const teardown = () => {
      resizeObserver?.disconnect()
      resizeObserver = null
      annotationsRef.current.forEach((annotation) => annotation.remove())
      annotationsRef.current = []
      groupRef.current = null
    }

    const showIfReady = () => {
      const group = groupRef.current
      if (!group || cancelled) return
      if (!activeRef.current) {
        group.hide()
        return
      }
      // Skip show until the target has a layout box with size.
      if (!hasLaidOutGlyphs(target)) return
      group.hide()
      group.show()
      pinSvgs(host)
    }

    const mount = () => {
      if (cancelled) return

      const annotations = resolvedLayers.map((layer) => {
        const layerKind = layer.kind
        return annotate(target, {
          type: layerKind,
          color: resolveCssColor(
            layer.color ?? defaultColor(layerKind),
            target
          ),
          strokeWidth: layer.strokeWidth ?? 1.5,
          animationDuration: reduceMotion ? 0 : (layer.duration ?? 600),
          iterations: reduceMotion
            ? 1
            : (layer.iterations ?? defaultIterations(layerKind)),
          padding: layer.padding ?? defaultPadding(layerKind),
          multiline,
          animate: !reduceMotion,
          ...(layer.brackets ? { brackets: layer.brackets } : {}),
        })
      })
      annotationsRef.current = annotations
      groupRef.current = annotationGroup(annotations)
      pinSvgs(host)
      showIfReady()

      resizeObserver = new ResizeObserver(() => {
        showIfReady()
      })
      resizeObserver.observe(target)
    }

    const start = () => {
      // Wait two frames so fonts and layout settle before annotate().
      rafOuter = window.requestAnimationFrame(() => {
        rafInner = window.requestAnimationFrame(() => {
          const fontsReady =
            "fonts" in document ? document.fonts.ready : Promise.resolve()
          void Promise.resolve(fontsReady).then(() => {
            if (!cancelled) mount()
          })
        })
      })
    }

    start()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafOuter)
      window.cancelAnimationFrame(rafInner)
      teardown()
    }
    // Depend on layersKey (stable serialization), not the layers array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layersKey is the stable fingerprint
  }, [layersKey, multiline])

  useIsomorphicLayoutEffect(() => {
    const group = groupRef.current
    const host = hostRef.current
    const target = targetRef.current
    if (!group || !host || !target) return
    if (active) {
      if (!hasLaidOutGlyphs(target)) return
      group.hide()
      group.show()
      pinSvgs(host)
      return
    }
    group.hide()
  }, [active])

  return (
    <span
      ref={hostRef}
      data-df="text-mark"
      data-kind={layers?.length ? "layers" : kind}
      data-active={active ? "true" : "false"}
      // Host is the containing block for absolute annotation SVGs.
      className={cn("relative inline-block align-baseline overflow-visible", className)}
    >
      <span
        ref={targetRef}
        className="relative inline-block bg-transparent"
        style={
          {
            zIndex: "var(--z-raised)",
            ...(active && activeColor ? { color: activeColor } : null),
          } as React.CSSProperties
        }
      >
        {children}
      </span>
    </span>
  )
}

export { TextMark }
export type {
  TextMarkProps,
  TextMarkKind,
  TextMarkLayer,
  TextMarkBracketSide,
}
