import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatByStep,
  quantizeToStep,
  snapToStep,
  stepPrecision,
} from "./index.ts"

test("stepPrecision reads decimal places, including exponent notation", () => {
  assert.equal(stepPrecision(1), 0)
  assert.equal(stepPrecision(0.1), 1)
  assert.equal(stepPrecision(0.25), 2)
  assert.equal(stepPrecision(0.001), 3)
  assert.equal(stepPrecision(1e-7), 7)
  assert.equal(stepPrecision(1.5e-7), 8)
  assert.equal(stepPrecision(0), 0)
  assert.equal(stepPrecision(Number.NaN), 0)
})

test("quantizeToStep removes binary drift at the step precision", () => {
  assert.equal(quantizeToStep(0.1 + 0.2, 0, 0.1), 0.3)
  assert.equal(quantizeToStep(1e-7 * 3, 0, 1e-7), 3e-7)
  assert.equal(quantizeToStep(40.4, 0, 1), 40)
})

test("formatByStep prints the precision the step can express", () => {
  assert.equal(formatByStep(42, 1), "42")
  assert.equal(formatByStep(0.3, 0.1), "0.3")
  assert.equal(formatByStep(0.001, 0.001), "0.001")
  assert.equal(formatByStep(1e-7, 1e-7), "0.0000001")
})

test("snapToStep clamps to min and max", () => {
  assert.equal(snapToStep(40.6, 0, 100, 1), 41)
  assert.equal(snapToStep(-4, 0, 100, 1), 0)
  assert.equal(snapToStep(108, 0, 100, 1), 100)
  assert.equal(snapToStep(0.1 + 0.2, 0, 1, 0.1), 0.3)
})
