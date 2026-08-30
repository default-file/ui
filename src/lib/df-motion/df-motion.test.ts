import assert from "node:assert/strict"
import { test } from "node:test"

import { prefersReducedMotion } from "./index.ts"

test("prefersReducedMotion returns a boolean in this environment", () => {
  assert.equal(typeof prefersReducedMotion(), "boolean")
})
