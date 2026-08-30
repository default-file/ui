import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldInsertSidebarContentSeparator } from "./sidebar-content-separators.ts"

test("shouldInsertSidebarContentSeparator inserts between non-separator children", () => {
  const kinds = [false, false, false]
  assert.equal(shouldInsertSidebarContentSeparator(kinds, 0), false)
  assert.equal(shouldInsertSidebarContentSeparator(kinds, 1), true)
  assert.equal(shouldInsertSidebarContentSeparator(kinds, 2), true)
})

test("shouldInsertSidebarContentSeparator skips when a neighbor is already a separator", () => {
  const kinds = [false, true, false]
  assert.equal(shouldInsertSidebarContentSeparator(kinds, 1), false)
  assert.equal(shouldInsertSidebarContentSeparator(kinds, 2), false)
})

test("shouldInsertSidebarContentSeparator is false for empty or single-child lists", () => {
  assert.equal(shouldInsertSidebarContentSeparator([], 0), false)
  assert.equal(shouldInsertSidebarContentSeparator([false], 0), false)
  assert.equal(shouldInsertSidebarContentSeparator([false], 1), false)
})
