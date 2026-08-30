import assert from "node:assert/strict"
import { test } from "node:test"

import { classifyDay } from "./day-state.ts"
import { moveCalendarFocus } from "./focus.ts"
import {
  clampIsoDay,
  compareIsoDays,
  isDayDisabled,
  monthKey,
  shiftUtcMonth,
  todayIsoDay,
} from "./month.ts"
import {
  applyBoundedRangeClick,
  applyRangeClick,
  orderRange,
  resolveRangePreview,
} from "./range.ts"
import { formatUtcDate } from "../df-date/index.ts"

test("shiftUtcMonth clamps day into shorter target months", () => {
  const next = shiftUtcMonth("2026-01-31", 1)
  assert.equal(formatUtcDate(next), "2026-02-28")
  assert.equal(monthKey(next), "2026-02")
})

test("clampIsoDay and isDayDisabled honor min and max", () => {
  assert.equal(clampIsoDay("2026-07-01", "2026-07-10", "2026-07-20"), "2026-07-10")
  assert.equal(clampIsoDay("2026-07-30", "2026-07-10", "2026-07-20"), "2026-07-20")
  assert.equal(isDayDisabled("2026-07-05", { min: "2026-07-10" }), true)
  assert.equal(isDayDisabled("2026-07-25", { max: "2026-07-20" }), true)
  assert.equal(
    isDayDisabled("2026-07-15", {
      disabledDates: (day) => day === "2026-07-15",
    }),
    true
  )
  assert.equal(isDayDisabled("2026-07-15", { min: "2026-07-01", max: "2026-07-31" }), false)
})

test("applyRangeClick starts, completes, and restarts when earlier than start", () => {
  const start = applyRangeClick({ start: null, end: null }, "2026-07-10")
  assert.deepEqual(start, { start: "2026-07-10", end: null })

  const complete = applyRangeClick(start, "2026-07-15")
  assert.deepEqual(complete, { start: "2026-07-10", end: "2026-07-15" })

  const restart = applyRangeClick(
    { start: "2026-07-10", end: null },
    "2026-07-05"
  )
  assert.deepEqual(restart, { start: "2026-07-05", end: null })

  const replace = applyRangeClick(complete, "2026-08-01")
  assert.deepEqual(replace, { start: "2026-08-01", end: null })
})

test("resolveRangePreview orders hover spans and collapses to start", () => {
  assert.deepEqual(
    resolveRangePreview({ start: "2026-07-10", end: null }, "2026-07-05"),
    { start: "2026-07-05", end: "2026-07-10" }
  )
  assert.deepEqual(
    resolveRangePreview({ start: "2026-07-10", end: null }, null),
    { start: "2026-07-10", end: "2026-07-10" }
  )
  assert.deepEqual(
    resolveRangePreview(
      { start: "2026-07-10", end: "2026-07-15" },
      "2026-07-20"
    ),
    { start: "2026-07-10", end: "2026-07-15" }
  )
  assert.deepEqual(orderRange("2026-07-15", "2026-07-10"), {
    start: "2026-07-10",
    end: "2026-07-15",
  })
})

test("classifyDay marks today, selected, outside, and range preview", () => {
  const today = todayIsoDay("2026-07-24T12:00:00.000Z")
  assert.equal(today, "2026-07-24")

  const selected = classifyDay({
    iso: "2026-07-24",
    inMonth: true,
    mode: "single",
    value: "2026-07-24",
    today,
  })
  assert.equal(selected.isToday, true)
  assert.equal(selected.isSelected, true)

  const outside = classifyDay({
    iso: "2026-06-30",
    inMonth: false,
    mode: "single",
    value: null,
    today,
  })
  assert.equal(outside.inMonth, false)

  const range = classifyDay({
    iso: "2026-07-12",
    inMonth: true,
    mode: "range",
    draft: { start: "2026-07-10", end: null },
    hover: "2026-07-15",
    today,
  })
  assert.equal(range.isInRange, true)
  assert.equal(range.isPreview, true)
  assert.equal(range.isRangeStart, false)
  assert.equal(range.isRangeEnd, false)

  const edge = classifyDay({
    iso: "2026-07-10",
    inMonth: true,
    mode: "range",
    draft: { start: "2026-07-10", end: "2026-07-15" },
    today,
  })
  assert.equal(edge.isRangeStart, true)
  assert.equal(edge.isSelected, true)
})

test("moveCalendarFocus handles arrows, week bounds, and month pages", () => {
  const left = moveCalendarFocus("2026-07-15", "ArrowLeft", "2026-07-01", 0)
  assert.equal(left?.focusIso, "2026-07-14")
  assert.equal(left?.monthChanged, false)

  const weekStart = moveCalendarFocus("2026-07-15", "Home", "2026-07-01", 0)
  assert.equal(weekStart?.focusIso, "2026-07-12")

  const weekEnd = moveCalendarFocus("2026-07-15", "End", "2026-07-01", 0)
  assert.equal(weekEnd?.focusIso, "2026-07-18")

  const page = moveCalendarFocus("2026-07-15", "PageUp", "2026-07-01", 0)
  assert.equal(page?.focusIso, "2026-06-15")
  assert.equal(page?.monthChanged, true)
  assert.equal(page?.monthIso, "2026-06-01")

  assert.equal(compareIsoDays("2026-07-01", "2026-07-02"), -1)
  assert.equal(moveCalendarFocus("2026-07-15", "Enter", "2026-07-01", 0), null)
})

test("moveCalendarFocus stays put when arrows hit min or max", () => {
  const atMin = moveCalendarFocus("2026-07-10", "ArrowLeft", "2026-07-01", 0, {
    min: "2026-07-10",
    max: "2026-07-20",
  })
  assert.equal(atMin?.focusIso, "2026-07-10")
  assert.equal(atMin?.monthChanged, false)

  const atMax = moveCalendarFocus("2026-07-20", "ArrowRight", "2026-07-01", 0, {
    min: "2026-07-10",
    max: "2026-07-20",
  })
  assert.equal(atMax?.focusIso, "2026-07-20")
  assert.equal(atMax?.monthChanged, false)
})

test("moveCalendarFocus skips a disabled day to the next enabled one", () => {
  const left = moveCalendarFocus("2026-07-15", "ArrowLeft", "2026-07-01", 0, {
    disabledDates: (day) => day === "2026-07-14",
  })
  assert.equal(left?.focusIso, "2026-07-13")

  const right = moveCalendarFocus("2026-07-15", "ArrowRight", "2026-07-01", 0, {
    disabledDates: (day) => day === "2026-07-16",
  })
  assert.equal(right?.focusIso, "2026-07-17")
})

test("moveCalendarFocus PageUp/PageDown resolve disabled landing days", () => {
  const pageUp = moveCalendarFocus("2026-07-15", "PageUp", "2026-07-01", 0, {
    disabledDates: (day) => day === "2026-06-15",
  })
  assert.equal(pageUp?.focusIso, "2026-06-14")
  assert.equal(pageUp?.monthChanged, true)
  assert.equal(pageUp?.monthIso, "2026-06-01")

  const pageDown = moveCalendarFocus("2026-07-15", "PageDown", "2026-07-01", 0, {
    disabledDates: (day) => day === "2026-08-15",
  })
  assert.equal(pageDown?.focusIso, "2026-08-16")
  assert.equal(pageDown?.monthChanged, true)
  assert.equal(pageDown?.monthIso, "2026-08-01")
})

test("moveCalendarFocus Home/End clamp within the week for bounds", () => {
  // Week of 2026-07-15 is Sun 12 through Sat 18.
  const home = moveCalendarFocus("2026-07-15", "Home", "2026-07-01", 0, {
    min: "2026-07-14",
  })
  assert.equal(home?.focusIso, "2026-07-14")

  const end = moveCalendarFocus("2026-07-15", "End", "2026-07-01", 0, {
    max: "2026-07-16",
  })
  assert.equal(end?.focusIso, "2026-07-16")
})

test("moveCalendarFocus Home/End respect weekStartsOn", () => {
  // 2026-07-15 is Wednesday. Monday-start week is Mon 13 through Sun 19.
  const home = moveCalendarFocus("2026-07-15", "Home", "2026-07-01", 1)
  assert.equal(home?.focusIso, "2026-07-13")

  const end = moveCalendarFocus("2026-07-15", "End", "2026-07-01", 1)
  assert.equal(end?.focusIso, "2026-07-19")
})

test("applyBoundedRangeClick rejects disabled and out-of-range days", () => {
  const draft = { start: "2026-07-10", end: null as string | null }
  const bounds = {
    min: "2026-07-05",
    max: "2026-07-20",
    disabledDates: (day: string) => day === "2026-07-12",
  }

  assert.deepEqual(
    applyBoundedRangeClick(draft, "2026-07-01", bounds),
    draft
  )
  assert.deepEqual(
    applyBoundedRangeClick(draft, "2026-07-12", bounds),
    draft
  )
  assert.deepEqual(applyBoundedRangeClick(draft, "2026-07-18", bounds), {
    start: "2026-07-10",
    end: "2026-07-18",
  })
})
