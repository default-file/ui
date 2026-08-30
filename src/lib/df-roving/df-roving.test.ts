import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveRovingActiveIndex } from "./index.ts"

test("resolveRovingActiveIndex clamps when count shrinks below the stored index", () => {
  assert.equal(resolveRovingActiveIndex(5, 3), 2)
  assert.equal(resolveRovingActiveIndex(9, 1), 0)
})

test("resolveRovingActiveIndex moves off a disabled active item", () => {
  const disabled = (index: number) => index === 2
  assert.equal(resolveRovingActiveIndex(2, 4, disabled), 3)
  assert.equal(resolveRovingActiveIndex(2, 3, disabled), 1)
})

test("resolveRovingActiveIndex keeps one tab stop when all items are disabled", () => {
  const allDisabled = () => true
  assert.equal(resolveRovingActiveIndex(2, 4, allDisabled), 2)
  assert.equal(resolveRovingActiveIndex(8, 3, allDisabled), 2)
})

test("resolveRovingActiveIndex does not crash on an empty set", () => {
  assert.equal(resolveRovingActiveIndex(3, 0), 0)
  assert.equal(resolveRovingActiveIndex(0, 0, () => true), 0)
})

test("resolveRovingActiveIndex preserves a valid enabled index", () => {
  assert.equal(resolveRovingActiveIndex(1, 4, (index) => index === 0), 1)
})
