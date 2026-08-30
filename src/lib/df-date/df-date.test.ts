import assert from "node:assert/strict"
import { test } from "node:test"

import { addUtcDays, formatUtcDate, startOfUtcDay, utcDayRange } from "./index.ts"

test("df-date formats and shifts UTC days", () => {
  const start = startOfUtcDay("2026-07-24T15:30:00.000Z")
  assert.equal(formatUtcDate(start), "2026-07-24")
  assert.equal(formatUtcDate(addUtcDays(start, 2)), "2026-07-26")
  const range = utcDayRange(start, addUtcDays(start, 1))
  assert.equal(formatUtcDate(range.end), "2026-07-25")
})
