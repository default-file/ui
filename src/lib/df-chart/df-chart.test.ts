import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CHART_SERIES_TOKENS,
  chartSeriesColor,
  chartTheme,
  formatChartDate,
  formatChartNumber,
  polylinePath,
  projectSeriesToSvg,
  remainingFromBurns,
  seriesBounds,
} from "./index.ts"

test("seriesBounds expands degenerate axes", () => {
  const bounds = seriesBounds([{ id: "a", points: [{ x: 2, y: 5 }] }])
  assert.equal(bounds.minX, 2)
  assert.equal(bounds.maxX, 3)
  assert.equal(bounds.minY, 5)
  assert.equal(bounds.maxY, 6)
})

test("projectSeriesToSvg and polylinePath", () => {
  const series = {
    id: "a",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  }
  const bounds = seriesBounds([series])
  const svg = projectSeriesToSvg(series, bounds, 100, 50, 0)
  assert.equal(svg[0]?.x, 0)
  assert.equal(svg[0]?.y, 50)
  assert.equal(svg[1]?.x, 100)
  assert.equal(svg[1]?.y, 0)
  assert.ok(polylinePath(svg).startsWith("M"))
})

test("remainingFromBurns builds burndown points", () => {
  const points = remainingFromBurns(10, [3, 2, 5])
  assert.deepEqual(
    points.map((point) => point.y),
    [10, 7, 5, 0]
  )
})

test("chartSeriesColor cycles the ordered palette", () => {
  assert.equal(chartSeriesColor(0), "var(--df-chart-series-1)")
  assert.equal(chartSeriesColor(1), "var(--df-chart-series-2)")
  assert.equal(
    chartSeriesColor(CHART_SERIES_TOKENS.length),
    "var(--df-chart-series-1)"
  )
  assert.equal(
    chartSeriesColor(CHART_SERIES_TOKENS.length + 3),
    "var(--df-chart-series-4)"
  )
  assert.equal(
    chartSeriesColor(-1),
    `var(${CHART_SERIES_TOKENS[CHART_SERIES_TOKENS.length - 1]})`
  )
})

test("chartTheme exposes axis grid and tooltip CSS vars", () => {
  assert.equal(chartTheme.grid.stroke, "var(--df-chart-grid)")
  assert.equal(chartTheme.axis.tick.fill, "var(--df-chart-axis-fg)")
  assert.equal(chartTheme.tooltip.background, "var(--df-chart-tooltip-bg)")
  assert.equal(chartTheme.trend.positive, "var(--df-chart-trend-positive)")
  assert.equal(chartTheme.reference.stroke, "var(--df-chart-reference)")
})

test("formatChartNumber uses compact suffixes", () => {
  assert.equal(formatChartNumber(0), "0")
  assert.equal(formatChartNumber(12), "12")
  assert.equal(formatChartNumber(1200), "1.2k")
  assert.equal(formatChartNumber(1000), "1k")
  assert.equal(formatChartNumber(3_400_000), "3.4M")
  assert.equal(formatChartNumber(1_100_000_000), "1.1B")
  assert.equal(formatChartNumber(-1500), "-1.5k")
  assert.equal(formatChartNumber(Number.NaN), "")
})

test("formatChartDate returns short labels by granularity", () => {
  const iso = "2026-07-24T12:00:00.000Z"
  assert.equal(formatChartDate(iso, "day"), "Jul 24")
  assert.equal(formatChartDate(iso, "week"), "Jul 24")
  assert.equal(formatChartDate(iso, "month"), "Jul")
  assert.equal(formatChartDate(iso, "quarter"), "Q3")
  assert.equal(formatChartDate(iso, "year"), "2026")
})
