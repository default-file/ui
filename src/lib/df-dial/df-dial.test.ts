import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyPointerTravel,
  commitDialValue,
  followAngle,
  isTickFilled,
  lastDialValue,
  nearestTickIndex,
  pointerTravel,
  progressSweepDegrees,
  ratioAlongRange,
  shortestAngleDelta,
  snapToStep,
  turnPixelsFromFace,
  tickRay,
  DIAL_TICK_INNER_RADIUS,
  valueDeltaFromTravel,
  valueToAngle,
  wrapDegrees,
  wrapValue,
} from "./index.ts"

test("wrapDegrees maps negatives and values above 360", () => {
  assert.equal(wrapDegrees(0), 0)
  assert.equal(wrapDegrees(360), 0)
  assert.equal(wrapDegrees(-15), 345)
  assert.equal(wrapDegrees(375), 15)
})

test("shortestAngleDelta takes the short turn across 0", () => {
  assert.equal(shortestAngleDelta(350, 10), 20)
  assert.equal(shortestAngleDelta(10, 350), -20)
  assert.equal(shortestAngleDelta(0, 90), 90)
  assert.equal(shortestAngleDelta(90, 0), -90)
})

test("wrapValue keeps values in the half-open range", () => {
  assert.equal(wrapValue(100, 0, 100), 0)
  assert.equal(wrapValue(-1, 0, 100), 99)
  assert.equal(wrapValue(12, 0, 10), 2)
})

test("commitDialValue snaps and optionally wraps", () => {
  assert.equal(commitDialValue(40.4, 0, 100, 1, false), 40)
  assert.equal(commitDialValue(100, 0, 100, 1, true), 0)
  assert.equal(commitDialValue(99.6, 0, 100, 1, true), 0)
  assert.equal(commitDialValue(-0.6, 0, 100, 1, true), 99)
  assert.equal(commitDialValue(200, 0, 100, 1, false), 100)
  assert.equal(commitDialValue(Number.NaN, 0, 100, 1, false), 0)
})

test("lastDialValue is max when wrap is off and the last rest when wrap is on", () => {
  assert.equal(lastDialValue(0, 100, 1, false), 100)
  assert.equal(lastDialValue(0, 100, 1, true), 99)
  assert.equal(lastDialValue(0, 1, 0.3, true), 0.9)
})

test("ratioAlongRange maps position across the range", () => {
  assert.equal(ratioAlongRange(50, 0, 100), 0.5)
  assert.equal(ratioAlongRange(150, 0, 100, false), 1)
  assert.equal(ratioAlongRange(150, 0, 100, true), 0.5)
  assert.equal(ratioAlongRange(Number.NaN, 0, 100), 0)
})

test("pointerTravel maps axis and diagonal movement", () => {
  assert.equal(pointerTravel(10, 4, "horizontal"), 10)
  assert.equal(pointerTravel(10, -8, "vertical"), 8)
  assert.equal(pointerTravel(10, 10, "all"), 0)
  assert.equal(pointerTravel(10, -10, "all"), 20 / Math.SQRT2)
})

test("applyPointerTravel clamps or keeps an open loop", () => {
  assert.equal(applyPointerTravel(90, 20, 0, 100, false), 100)
  assert.equal(applyPointerTravel(90, 20, 0, 100, true), 110)
  assert.equal(applyPointerTravel(0, Number.NaN, 0, 100, false), 0)
})

test("valueDeltaFromTravel maps one full turn onto the range", () => {
  assert.equal(valueDeltaFromTravel(Math.PI * 100, 0, 100, Math.PI * 100), 100)
  assert.equal(valueDeltaFromTravel(50, 0, 100, 100), 50)
})

test("turnPixelsFromFace uses the face circumference", () => {
  assert.equal(turnPixelsFromFace(100), Math.PI * 100)
  assert.equal(turnPixelsFromFace(0), 1)
})

test("followAngle keeps wrap from spinning backward", () => {
  assert.equal(followAngle(900, 180), 900)
  assert.equal(followAngle(10, 20), 20)
  assert.equal(followAngle(10, 350), -10)
})

test("valueToAngle places min at startAngle and max at startAngle plus sweep", () => {
  assert.equal(valueToAngle(0, 0, 100, 0, 360), 0)
  assert.equal(valueToAngle(50, 0, 100, 0, 360), 180)
  assert.equal(valueToAngle(100, 0, 100, 0, 360), 360)
  assert.equal(valueToAngle(0, 0, 100, 225, 270), 225)
  assert.equal(valueToAngle(100, 0, 100, 225, 270), 495)
})

test("valueToAngle places 0 at startAngle when min is below 0 and max is above 0", () => {
  assert.equal(valueToAngle(0, -360, 360, 0, 360), 0)
  assert.equal(valueToAngle(90, -360, 360, 0, 360), 90)
  assert.equal(valueToAngle(-90, -360, 360, 0, 360), -90)
  assert.equal(valueToAngle(360, -360, 360, 0, 360), 360)
  assert.equal(valueToAngle(-360, -360, 360, 0, 360), -360)
})

test("commitDialValue keeps signed values when wrap is off", () => {
  assert.equal(commitDialValue(-90, -360, 360, 1, false), -90)
  assert.equal(commitDialValue(-400, -360, 360, 1, false), -360)
  assert.equal(commitDialValue(400, -360, 360, 1, false), 360)
})

test("progressSweepDegrees is the clockwise arc from startAngle", () => {
  assert.equal(progressSweepDegrees(25, 0, 100, 0, 360), 90)
  assert.equal(progressSweepDegrees(90, 0, 360, 0, 360), 90)
  assert.equal(progressSweepDegrees(0, 0, 360, 0, 360), 0)
  assert.equal(progressSweepDegrees(100, 0, 100, 0, 360), 360)
  assert.equal(progressSweepDegrees(400, 0, 360, 0, 360), 40)
  assert.equal(progressSweepDegrees(100, 0, 100, 225, 270), 270)
})

test("tickRay starts at the top and runs clockwise", () => {
  const top = tickRay(0)
  assert.equal(top.x1, 50)
  assert.equal(top.y1, 0)
  assert.equal(top.x2, 50)
  assert.equal(top.y2, 50)

  const right = tickRay(90)
  assert.equal(right.x1, 100)
  assert.ok(Math.abs(right.y1 - 50) < 1e-9)

  const bottom = tickRay(180)
  assert.ok(Math.abs(bottom.x1 - 50) < 1e-9)
  assert.equal(bottom.y1, 100)

  const left = tickRay(270)
  assert.ok(Math.abs(left.x1) < 1e-9)
  assert.ok(Math.abs(left.y1 - 50) < 1e-9)
})

test("tickRay can stop before the center", () => {
  const top = tickRay(0, 50, 50, 50, DIAL_TICK_INNER_RADIUS)
  assert.equal(top.x1, 50)
  assert.equal(top.y1, 0)
  assert.equal(top.x2, 50)
  assert.equal(top.y2, 50 - DIAL_TICK_INNER_RADIUS)
})

test("nearestTickIndex finds the closest tick around the ring", () => {
  assert.equal(nearestTickIndex(0, 36), 0)
  assert.equal(nearestTickIndex(10, 36), 1)
  assert.equal(nearestTickIndex(350, 36), 35)
})

test("isTickFilled covers the arc from start to the current ratio", () => {
  assert.equal(isTickFilled(0, 0, 360, 0), true)
  assert.equal(isTickFilled(90, 0, 360, 0), false)
  assert.equal(isTickFilled(90, 0, 360, 0.25), true)
  assert.equal(isTickFilled(180, 0, 360, 0.25), false)
  assert.equal(isTickFilled(0, 0, 360, 1), true)
  assert.equal(isTickFilled(350, 0, 360, 1), true)
  assert.equal(isTickFilled(180, 0, 270, 1), true)
  assert.equal(isTickFilled(300, 0, 270, 1), false)
  assert.equal(isTickFilled(90, 90, 360, 0), true)
  assert.equal(isTickFilled(180, 90, 360, 0.25), true)
  assert.equal(isTickFilled(0, 90, 360, 0.25), false)
})

test("snapToStep clamps to min and max", () => {
  assert.equal(snapToStep(40.6, 0, 100, 1), 41)
  assert.equal(snapToStep(-4, 0, 100, 1), 0)
  assert.equal(snapToStep(108, 0, 100, 1), 100)
})
