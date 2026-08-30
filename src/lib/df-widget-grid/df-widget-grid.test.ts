import assert from "node:assert/strict"
import { test } from "node:test"

import {
  clampWidget,
  compactLayout,
  layoutEquals,
  moveWidget,
  normalizeLayout,
  resizeWidget,
  widgetsOverlap,
  type WidgetLayoutItem,
} from "./layout.ts"
import {
  cellDeltaFromPointer,
  cellMetricsFromGridRect,
  translateFromCellDelta,
} from "./pointer.ts"
import { parseLayout, serializeLayout } from "./serialize.ts"

const base: WidgetLayoutItem[] = [
  { id: "a", x: 0, y: 0, w: 4, h: 2 },
  { id: "b", x: 4, y: 0, w: 4, h: 2 },
  { id: "c", x: 0, y: 2, w: 8, h: 2 },
]

test("normalizeLayout clamps to column bounds", () => {
  const layout = normalizeLayout(
    [{ id: "wide", x: -2, y: -1, w: 20, h: 0, minW: 2, maxW: 6 }],
    12
  )
  assert.equal(layout.length, 1)
  assert.deepEqual(layout[0], {
    id: "wide",
    x: 0,
    y: 0,
    w: 6,
    h: 1,
    minW: 2,
    minH: 1,
    maxW: 6,
  })
})

test("normalizeLayout resolves overlaps by pushing down", () => {
  const layout = normalizeLayout(
    [
      { id: "a", x: 0, y: 0, w: 4, h: 2 },
      { id: "b", x: 2, y: 0, w: 4, h: 2 },
    ],
    12
  )
  assert.ok(!widgetsOverlap(layout[0]!, layout[1]!))
  const byId = Object.fromEntries(layout.map((item) => [item.id, item]))
  assert.equal(byId.a?.y, 0)
  assert.equal(byId.b?.y, 2)
})

test("compactLayout removes vertical gaps with stable order", () => {
  const layout = compactLayout(
    [
      { id: "a", x: 0, y: 4, w: 4, h: 2 },
      { id: "b", x: 4, y: 6, w: 4, h: 2 },
      { id: "c", x: 0, y: 10, w: 8, h: 1 },
    ],
    12
  )
  assert.deepEqual(
    layout.map((item) => [item.id, item.x, item.y]),
    [
      ["a", 0, 0],
      ["b", 4, 0],
      ["c", 0, 2],
    ]
  )
  const again = compactLayout(layout, 12)
  assert.deepEqual(again, layout)
})

test("moveWidget pushes others down and honors no-op moves", () => {
  const moved = moveWidget(base, "c", 0, 0, 12)
  const byId = Object.fromEntries(moved.map((item) => [item.id, item]))
  assert.equal(byId.c?.x, 0)
  assert.equal(byId.c?.y, 0)
  assert.ok(byId.a)
  assert.ok(byId.b)
  assert.ok(!widgetsOverlap(byId.c!, byId.a!))
  assert.ok(!widgetsOverlap(byId.c!, byId.b!))

  const noop = moveWidget(base, "a", 0, 0, 12)
  assert.ok(layoutEquals(normalizeLayout(base, 12), noop))
})

test("resizeWidget honors min and max size", () => {
  const layout: WidgetLayoutItem[] = [
    { id: "a", x: 0, y: 0, w: 4, h: 2, minW: 3, maxW: 5, minH: 2, maxH: 4 },
    { id: "b", x: 0, y: 2, w: 4, h: 2 },
  ]
  const tooSmall = resizeWidget(layout, "a", 1, 1, 12)
  assert.equal(tooSmall.find((item) => item.id === "a")?.w, 3)
  assert.equal(tooSmall.find((item) => item.id === "a")?.h, 2)

  const tooLarge = resizeWidget(layout, "a", 12, 20, 12)
  assert.equal(tooLarge.find((item) => item.id === "a")?.w, 5)
  assert.equal(tooLarge.find((item) => item.id === "a")?.h, 4)

  const grown = resizeWidget(layout, "a", 5, 4, 12)
  const a = grown.find((item) => item.id === "a")!
  const b = grown.find((item) => item.id === "b")!
  assert.equal(a.w, 5)
  assert.equal(a.h, 4)
  assert.ok(!widgetsOverlap(a, b))
  assert.ok(b.y >= a.y + a.h)
})

test("clampWidget clamps x so width fits columns", () => {
  const item = clampWidget({ id: "a", x: 10, y: 0, w: 4, h: 1 }, 12)
  assert.equal(item.x, 8)
  assert.equal(item.w, 4)
})

test("cellDeltaFromPointer applies half-cell hysteresis", () => {
  const metrics = cellMetricsFromGridRect({
    width: 120,
    columns: 12,
    rowHeight: 40,
    gapX: 0,
    gapY: 0,
  })
  assert.equal(metrics.colStride, 10)
  assert.equal(metrics.rowStride, 40)

  assert.deepEqual(cellDeltaFromPointer(4, 19, metrics), { dx: 0, dy: 0 })
  assert.deepEqual(cellDeltaFromPointer(5, 20, metrics), { dx: 1, dy: 1 })
  assert.deepEqual(cellDeltaFromPointer(-5, -20, metrics), { dx: -1, dy: -1 })
  assert.deepEqual(translateFromCellDelta({ dx: 2, dy: 1 }, metrics), {
    x: 20,
    y: 40,
  })
})

test("serializeLayout and parseLayout round-trip valid layouts", () => {
  const json = serializeLayout(base)
  assert.deepEqual(parseLayout(json), base)
})

test("parseLayout rejects malformed entries", () => {
  assert.equal(parseLayout(null), null)
  assert.equal(parseLayout([{ id: "a", x: 0, y: 0, w: 1 }]), null)
  assert.equal(
    parseLayout([
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "a", x: 1, y: 0, w: 1, h: 1 },
    ]),
    null
  )
  assert.equal(
    parseLayout([{ id: "", x: 0, y: 0, w: 1, h: 1 }]),
    null
  )
})

test("parseLayout rejects negative coordinates", () => {
  assert.equal(
    parseLayout([{ id: "a", x: -1, y: 0, w: 1, h: 1 }]),
    null
  )
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: -1, w: 1, h: 1 }]),
    null
  )
})

test("parseLayout rejects non-integer coordinates and sizes", () => {
  assert.equal(
    parseLayout([{ id: "a", x: 0.5, y: 0, w: 1, h: 1 }]),
    null
  )
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: 1.25, w: 1, h: 1 }]),
    null
  )
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: 0, w: 1.5, h: 1 }]),
    null
  )
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: 0, w: 1, h: 2.1 }]),
    null
  )
})

test("parseLayout rejects width or height less than one", () => {
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: 0, w: 0, h: 1 }]),
    null
  )
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: 0, w: -2, h: 1 }]),
    null
  )
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: 0, w: 1, h: 0 }]),
    null
  )
  assert.equal(
    parseLayout([{ id: "a", x: 0, y: 0, w: 1, h: -3 }]),
    null
  )
})

test("parseLayout accepts zero origin and unit size boundary", () => {
  assert.deepEqual(parseLayout([{ id: "a", x: 0, y: 0, w: 1, h: 1 }]), [
    { id: "a", x: 0, y: 0, w: 1, h: 1 },
  ])
})

test("moveWidget clamps out-of-bounds x into column bounds", () => {
  const layout: WidgetLayoutItem[] = [
    { id: "a", x: 0, y: 0, w: 4, h: 2 },
  ]
  const moved = moveWidget(layout, "a", 20, 0, 12)
  const item = moved.find((entry) => entry.id === "a")
  assert.equal(item?.x, 8)
  assert.equal(item?.w, 4)
  assert.equal(item?.y, 0)
})

test("moveWidget cascades push-down across three stacked widgets", () => {
  const layout: WidgetLayoutItem[] = [
    { id: "a", x: 0, y: 0, w: 4, h: 2 },
    { id: "b", x: 0, y: 2, w: 4, h: 2 },
    { id: "c", x: 0, y: 4, w: 4, h: 2 },
  ]
  const moved = moveWidget(layout, "a", 0, 2, 12)
  const byId = Object.fromEntries(moved.map((item) => [item.id, item]))
  assert.equal(byId.a?.x, 0)
  assert.equal(byId.a?.y, 2)
  assert.equal(byId.b?.y, 4)
  assert.equal(byId.c?.y, 6)
  assert.ok(!widgetsOverlap(byId.a!, byId.b!))
  assert.ok(!widgetsOverlap(byId.b!, byId.c!))
  assert.ok(!widgetsOverlap(byId.a!, byId.c!))
})

test("normalizeLayout is order-independent for the same geometry", () => {
  const geometry: WidgetLayoutItem[] = [
    { id: "a", x: 0, y: 0, w: 4, h: 2 },
    { id: "b", x: 4, y: 0, w: 4, h: 2 },
    { id: "c", x: 0, y: 2, w: 8, h: 2 },
  ]
  const shuffled: WidgetLayoutItem[] = [
    geometry[2]!,
    geometry[0]!,
    geometry[1]!,
  ]
  const reversed = [...geometry].reverse()
  const normalized = normalizeLayout(geometry, 12)
  assert.deepEqual(normalizeLayout(shuffled, 12), normalized)
  assert.deepEqual(normalizeLayout(reversed, 12), normalized)
})
