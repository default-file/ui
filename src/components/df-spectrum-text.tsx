import * as React from "react"

import { sanitizeCssColor } from "../lib/df-css-value"
import { cn } from "../lib/utils"

type SpectrumGradientStop = {
  offset: number
  color: string
}

const DEFAULT_SPECTRUM_COLORS = [
  "var(--spectrum-text-color-1)",
  "var(--spectrum-text-color-2)",
  "var(--spectrum-text-color-3)",
  "var(--spectrum-text-color-4)",
] as const

const DEFAULT_SPECTRUM_STOPS: readonly SpectrumGradientStop[] = [
  { offset: 0, color: DEFAULT_SPECTRUM_COLORS[0] },
  { offset: 0.33, color: DEFAULT_SPECTRUM_COLORS[1] },
  { offset: 0.66, color: DEFAULT_SPECTRUM_COLORS[2] },
  { offset: 1, color: DEFAULT_SPECTRUM_COLORS[3] },
]

type SpectrumTextProps = {
  children: React.ReactNode
  className?: string
  colors?: string[]
  speed?: number
}

function colorsToStops(colors: string[]): SpectrumGradientStop[] {
  const first = colors[0]
  if (first === undefined) return [...DEFAULT_SPECTRUM_STOPS]
  const lastColor = colors[colors.length - 1]
  const stops = lastColor === first ? colors : [...colors, first]
  const last = Math.max(stops.length - 1, 1)
  return stops.map((color, index) => ({
    offset: index / last,
    color,
  }))
}

function sanitizeSpectrumColors(colors: string[]): string[] {
  return colors
    .map((color) => sanitizeCssColor(color))
    .filter((color): color is string => color != null)
}

function usesCssVariables(colors: string[]): boolean {
  return colors.some((color) => color.includes("var("))
}

function buildSpectrumFillSvg(stops: SpectrumGradientStop[]): string {
  const stopMarkup = stops
    .map((stop) => {
      const offset = `${(stop.offset * 100).toFixed(2)}%`
      const color = sanitizeCssColor(stop.color)
      if (color == null) return ""
      return `<stop offset="${offset}" stop-color="${color}"/>`
    })
    .filter(Boolean)
    .join("")

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" preserveAspectRatio="none">`,
    `<defs>`,
    `<linearGradient id="spectrum" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="400" y2="200">`,
    stopMarkup,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="400" height="200" fill="url(#spectrum)"/>`,
    `</svg>`,
  ].join("")
}

function spectrumFillDataUri(stops: SpectrumGradientStop[]): string {
  return `url("data:image/svg+xml,${encodeURIComponent(buildSpectrumFillSvg(stops))}")`
}

function spectrumCssGradient(colors: string[]): string {
  const safe = sanitizeSpectrumColors(colors)
  const stops =
    safe.length > 0 && safe[0] === safe[safe.length - 1]
      ? safe
      : [...safe, safe[0]]
  return `linear-gradient(135deg, ${stops.join(", ")})`
}

const SpectrumText = React.memo(function SpectrumText({
  children,
  className,
  colors,
  speed = 1,
}: SpectrumTextProps) {
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1
  const fillColors = (() => {
    const raw =
      colors != null && colors.length > 0
        ? colors
        : [...DEFAULT_SPECTRUM_COLORS]
    const safe = sanitizeSpectrumColors(raw)
    return safe.length > 0 ? safe : [...DEFAULT_SPECTRUM_COLORS]
  })()
  const backgroundImage = usesCssVariables(fillColors)
    ? spectrumCssGradient(fillColors)
    : spectrumFillDataUri(colorsToStops(fillColors))

  const gradientStyle = {
    backgroundImage,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animationDuration: `${10 / safeSpeed}s`,
  } as React.CSSProperties

  return (
    <span
      className={cn("df-spectrum-text", className)}
      data-df="spectrum-text"
    >
      <span className="df-spectrum-text-sr">{children}</span>
      <span
        className="df-spectrum-text-fill"
        data-slot="fill"
        style={gradientStyle}
        aria-hidden="true"
      >
        {children}
      </span>
    </span>
  )
})

SpectrumText.displayName = "SpectrumText"

export {
  SpectrumText,
  DEFAULT_SPECTRUM_COLORS,
  DEFAULT_SPECTRUM_STOPS,
  buildSpectrumFillSvg,
}
export type { SpectrumTextProps, SpectrumGradientStop }
