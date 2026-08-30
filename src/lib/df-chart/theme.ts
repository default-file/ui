/**
 * Ordered categorical series tokens. Values are CSS custom property names
 * without the surrounding var().
 */
export const CHART_SERIES_TOKENS = [
  "--df-chart-series-1",
  "--df-chart-series-2",
  "--df-chart-series-3",
  "--df-chart-series-4",
  "--df-chart-series-5",
  "--df-chart-series-6",
  "--df-chart-series-7",
  "--df-chart-series-8",
  "--df-chart-series-9",
  "--df-chart-series-10",
  "--df-chart-series-11",
  "--df-chart-series-12",
] as const

export type ChartSeriesToken = (typeof CHART_SERIES_TOKENS)[number]

export type ChartFrameSize = "sm" | "md" | "lg"

/** CSS height custom property for a named chart frame size. */
export const CHART_HEIGHT_TOKENS = {
  sm: "--df-chart-height-sm",
  md: "--df-chart-height-md",
  lg: "--df-chart-height-lg",
} as const satisfies Record<ChartFrameSize, string>

/** Cycle the categorical series palette and return a CSS `var(--…)` string. */
export function chartSeriesColor(index: number): string {
  const length = CHART_SERIES_TOKENS.length
  const normalized = ((Math.trunc(index) % length) + length) % length
  return `var(${CHART_SERIES_TOKENS[normalized]!})`
}

/** Theme values shaped for common Cartesian chart prop bags. */
export const chartTheme = {
  grid: {
    stroke: "var(--df-chart-grid)",
    strokeOpacity: 0.7,
  },
  axis: {
    tickLine: false as const,
    axisLine: false as const,
    tick: {
      fill: "var(--df-chart-axis-fg)",
      fontSize: "var(--df-chart-axis-font-size)",
    },
  },
  tooltip: {
    background: "var(--df-chart-tooltip-bg)",
    border: "var(--border-width-hairline) solid var(--df-chart-tooltip-border)",
    borderRadius: "var(--df-chart-tooltip-radius)",
    boxShadow: "var(--df-chart-tooltip-shadow)",
    color: "var(--df-chart-tooltip-fg)",
    fontSize: "var(--df-chart-tooltip-font-size)",
    padding: "var(--df-chart-tooltip-padding)",
  },
  reference: {
    stroke: "var(--df-chart-reference)",
  },
  trend: {
    positive: "var(--df-chart-trend-positive)",
    negative: "var(--df-chart-trend-negative)",
    neutral: "var(--df-chart-trend-neutral)",
  },
} as const

export type ChartTheme = typeof chartTheme
