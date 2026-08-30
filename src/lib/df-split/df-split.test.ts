import assert from "node:assert/strict"
import { test } from "node:test"

import {
  clampRatio,
  normalizeRatioInput,
  ratioFromPointer,
  ratioToPercent,
  resolveRatioBounds,
  resolveSizeRatio,
  stepRatio,
} from "./ratio.ts"

test("clampRatio bounds finite ratios and replaces non-finite input", () => {
  assert.equal(clampRatio(0.5, { min: 0.2, max: 0.8 }), 0.5)
  assert.equal(clampRatio(0.05, { min: 0.2, max: 0.8 }), 0.2)
  assert.equal(clampRatio(0.95, { min: 0.2, max: 0.8 }), 0.8)
  assert.equal(clampRatio(Number.NaN, { min: 0.2, max: 0.8 }), 0.2)
})

test("normalizeRatioInput accepts unit ratios and percentages", () => {
  assert.equal(normalizeRatioInput(0.4), 0.4)
  assert.equal(normalizeRatioInput(40), 0.4)
  assert.equal(normalizeRatioInput(Number.NaN), 0.5)
})

test("resolveSizeRatio maps percent strings and pixel lengths", () => {
  assert.equal(resolveSizeRatio("25%", 400, 0.15), 0.25)
  assert.equal(resolveSizeRatio({ px: 100 }, 400, 0.15), 0.25)
  assert.equal(resolveSizeRatio(30, 400, 0.15), 0.3)
})

test("resolveRatioBounds swaps inverted min and max", () => {
  assert.deepEqual(
    resolveRatioBounds({
      minSize: "70%",
      maxSize: "30%",
      trackSize: 500,
    }),
    { min: 0.3, max: 0.7 }
  )
})

test("ratioFromPointer projects along the track", () => {
  assert.equal(
    ratioFromPointer({
      pointer: 150,
      trackStart: 100,
      trackSize: 200,
      bounds: { min: 0.1, max: 0.9 },
    }),
    0.25
  )
})

test("stepRatio moves by the keyboard step and clamps", () => {
  assert.equal(stepRatio(0.5, 1, 0.05, { min: 0.2, max: 0.8 }), 0.55)
  assert.equal(stepRatio(0.22, -1, 0.05, { min: 0.2, max: 0.8 }), 0.2)
})

test("ratioToPercent rounds for ARIA", () => {
  assert.equal(ratioToPercent(0.333), 33)
  assert.equal(ratioToPercent(0.5), 50)
})
