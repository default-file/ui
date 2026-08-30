import assert from "node:assert/strict"
import { test } from "node:test"

import { layoutTimelineBars } from "./bars.ts"
import {
  anchorsFromBars,
  routeDependencyPaths,
} from "./dependencies.ts"
import {
  formatTimelineDateRange,
  nudgeTimelineBar,
  reduceTimelineDrag,
} from "./drag.ts"
import { buildTimelineScale } from "./scale.ts"

test("buildTimelineScale day zoom yields month coarse headers over day cells", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-01-30", end: "2026-02-02" },
    zoom: "day",
    unitPx: 40,
    today: "2026-01-31",
  })

  assert.equal(scale.fineColumns.length, 4)
  assert.equal(scale.totalWidth, 160)
  assert.deepEqual(
    scale.fineColumns.map((column) => column.label),
    ["30", "31", "1", "2"]
  )
  assert.equal(scale.coarseHeaders.length, 2)
  assert.equal(scale.coarseHeaders[0]?.label, "Jan 2026")
  assert.equal(scale.coarseHeaders[1]?.label, "Feb 2026")
  assert.equal(scale.coarseHeaders[0]?.width, 80)
  assert.equal(scale.todayX, 40)
  assert.equal(scale.fineColumns[0]?.isWeekend, false)
  assert.equal(scale.fineColumns[1]?.isWeekend, true)
})

test("buildTimelineScale maps dateToX and xToDate across unit boundaries", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-03-01", end: "2026-03-03" },
    zoom: "day",
    unitPx: 50,
    today: "2026-01-01",
  })

  assert.equal(scale.dateToX("2026-03-01"), 0)
  assert.equal(scale.dateToX("2026-03-02"), 50)
  assert.equal(scale.dateToX("2026-03-03"), 100)
  assert.equal(scale.xToDate(0), "2026-03-01")
  assert.equal(scale.xToDate(49), "2026-03-01")
  assert.equal(scale.xToDate(50), "2026-03-02")
  assert.equal(scale.todayX, null)
})

test("buildTimelineScale week month and quarter presets build fine columns", () => {
  const week = buildTimelineScale({
    visibleRange: { start: "2026-01-05", end: "2026-01-18" },
    zoom: "week",
    unitPx: 80,
  })
  assert.ok(week.fineColumns.length >= 2)
  assert.equal(week.unitLabel, "week")

  const month = buildTimelineScale({
    visibleRange: { start: "2026-01-15", end: "2026-03-10" },
    zoom: "month",
    unitPx: 100,
  })
  assert.equal(month.fineColumns.length, 3)
  assert.equal(month.coarseHeaders[0]?.label, "2026")

  const quarter = buildTimelineScale({
    visibleRange: { start: "2026-02-01", end: "2026-08-01" },
    zoom: "quarter",
    unitPx: 120,
  })
  assert.equal(quarter.fineColumns.length, 3)
  assert.match(quarter.fineColumns[0]!.label, /^Q1/)
})

test("buildTimelineScale rejects inverted ranges and non-positive unitPx", () => {
  assert.throws(() =>
    buildTimelineScale({
      visibleRange: { start: "2026-02-01", end: "2026-01-01" },
      zoom: "day",
      unitPx: 40,
    })
  )
  assert.throws(() =>
    buildTimelineScale({
      visibleRange: { start: "2026-01-01", end: "2026-01-02" },
      zoom: "day",
      unitPx: 0,
    })
  )
})

test("layoutTimelineBars skips rows missing both dates", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-01-01", end: "2026-01-10" },
    zoom: "day",
    unitPx: 20,
  })
  const rects = layoutTimelineBars(
    [
      { id: "a", start: "2026-01-02", due: "2026-01-04" },
      { id: "b" },
      { id: "c", start: "2026-01-03" },
      { id: "d", due: "2026-01-05" },
    ],
    scale
  )

  assert.equal(rects.length, 3)
  assert.equal(rects.find((rect) => rect.id === "b"), undefined)

  const both = rects.find((rect) => rect.id === "a")!
  assert.equal(both.missingStart, false)
  assert.equal(both.missingDue, false)
  assert.equal(both.x, 20)
  assert.equal(both.width, 60)

  const openDue = rects.find((rect) => rect.id === "c")!
  assert.equal(openDue.missingDue, true)
  assert.equal(openDue.missingStart, false)
  assert.equal(openDue.width, 20)

  const openStart = rects.find((rect) => rect.id === "d")!
  assert.equal(openStart.missingStart, true)
  assert.equal(openStart.missingDue, false)
})

test("layoutTimelineBars clamps progress into 0..1", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-01-01", end: "2026-01-05" },
    zoom: "day",
    unitPx: 10,
  })
  const [rect] = layoutTimelineBars(
    [{ id: "p", start: "2026-01-01", due: "2026-01-02", progress: 1.5 }],
    scale
  )
  assert.equal(rect?.progress, 1)
})

test("routeDependencyPaths routes forward adjacent-row edges with elbows", () => {
  const paths = routeDependencyPaths(
    [{ fromId: "a", toId: "b" }],
    [
      { id: "a", x: 0, width: 40, rowIndex: 0 },
      { id: "b", x: 80, width: 40, rowIndex: 1 },
    ],
    { rowHeight: 32, stubPx: 8, radiusPx: 4 }
  )

  assert.equal(paths.length, 1)
  assert.match(paths[0]!.d, /^M 40 /)
  assert.match(paths[0]!.d, /H 80$/)
  assert.match(paths[0]!.d, /Q /)
  assert.match(paths[0]!.d, /V /)
})

test("routeDependencyPaths loops backward targets around the source", () => {
  const paths = routeDependencyPaths(
    [{ fromId: "a", toId: "b" }],
    [
      { id: "a", x: 100, width: 40, rowIndex: 0 },
      { id: "b", x: 20, width: 30, rowIndex: 2 },
    ],
    { rowHeight: 40, stubPx: 8, radiusPx: 4, loopClearancePx: 12 }
  )

  assert.equal(paths.length, 1)
  const d = paths[0]!.d
  assert.match(d, /^M 140 /)
  assert.match(d, /H 20$/)
  const horizontalStops = [...d.matchAll(/H (-?\d+(?:\.\d+)?)/g)].map((match) =>
    Number(match[1])
  )
  assert.ok(horizontalStops.some((x) => x > 140))
})

test("routeDependencyPaths same-row backward edges detour vertically", () => {
  const paths = routeDependencyPaths(
    [{ fromId: "a", toId: "b" }],
    [
      { id: "a", x: 120, width: 40, rowIndex: 1 },
      { id: "b", x: 10, width: 30, rowIndex: 1 },
    ],
    { rowHeight: 36, stubPx: 8, radiusPx: 0 }
  )

  assert.equal(paths.length, 1)
  assert.match(paths[0]!.d, /V /)
  assert.match(paths[0]!.d, /H 10$/)
})

test("anchorsFromBars joins bar geometry with row indices", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-01-01", end: "2026-01-05" },
    zoom: "day",
    unitPx: 10,
  })
  const bars = layoutTimelineBars(
    [{ id: "a", start: "2026-01-01", due: "2026-01-02" }],
    scale
  )
  const anchors = anchorsFromBars(bars, new Map([["a", 3]]))
  assert.deepEqual(anchors, [
    { id: "a", x: 0, width: 20, rowIndex: 3 },
  ])
})

test("reduceTimelineDrag move preserves duration and snaps by unit", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-01-01", end: "2026-01-20" },
    zoom: "day",
    unitPx: 20,
  })
  const next = reduceTimelineDrag({
    kind: "move",
    origin: { start: "2026-01-02", due: "2026-01-04" },
    deltaPx: 45,
    scale,
  })
  assert.deepEqual(next, { start: "2026-01-04", due: "2026-01-06" })
})

test("reduceTimelineDrag resize-end and resize-start snap and clamp", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-01-01", end: "2026-01-20" },
    zoom: "day",
    unitPx: 10,
  })

  assert.deepEqual(
    reduceTimelineDrag({
      kind: "resize-end",
      origin: { start: "2026-01-05", due: "2026-01-07" },
      deltaPx: 25,
      scale,
    }),
    { start: "2026-01-05", due: "2026-01-10" }
  )

  assert.deepEqual(
    reduceTimelineDrag({
      kind: "resize-start",
      origin: { start: "2026-01-05", due: "2026-01-08" },
      deltaPx: 40,
      scale,
    }),
    { start: "2026-01-08", due: "2026-01-08" }
  )

  assert.deepEqual(
    reduceTimelineDrag({
      kind: "resize-end",
      origin: { start: "2026-01-05", due: "2026-01-08" },
      deltaPx: -100,
      scale,
    }),
    { start: "2026-01-05", due: "2026-01-05" }
  )
})

test("nudgeTimelineBar supports keyboard unit steps", () => {
  const scale = buildTimelineScale({
    visibleRange: { start: "2026-01-01", end: "2026-02-01" },
    zoom: "week",
    unitPx: 60,
  })
  const moved = nudgeTimelineBar({
    kind: "move",
    origin: { start: "2026-01-05", due: "2026-01-11" },
    units: 1,
    scale,
  })
  assert.equal(moved.start, scale.shiftDate(scale.snapDate("2026-01-05"), 1))
  assert.equal(moved.due, scale.shiftDate(scale.snapDate("2026-01-11"), 1))
  assert.equal(
    formatTimelineDateRange("2026-01-01", "2026-01-03"),
    "2026-01-01 to 2026-01-03"
  )
})
