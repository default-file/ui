import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveSidebarHeightMode } from "./sidebar-height-mode.ts"

test("resolveSidebarHeightMode uses fixed when height is set", () => {
  assert.equal(resolveSidebarHeightMode("600px", true), "fixed")
  assert.equal(resolveSidebarHeightMode("600px", false), "fixed")
})

test("resolveSidebarHeightMode uses fill when fillHeight is true", () => {
  assert.equal(resolveSidebarHeightMode(undefined, true), "fill")
})

test("resolveSidebarHeightMode uses auto when fillHeight is false", () => {
  assert.equal(resolveSidebarHeightMode(undefined, false), "auto")
})
