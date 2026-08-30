import assert from "node:assert/strict"
import { test } from "node:test"

import {
  FOCUSABLE_SELECTOR,
  lockBodyScroll,
  resolveFocusRestoreTarget,
  resolveFocusTrapKey,
  resolveInitialFocus,
  unlockBodyScroll,
} from "./trap.ts"

test("FOCUSABLE_SELECTOR covers standard interactive controls", () => {
  assert.match(FOCUSABLE_SELECTOR, /a\[href\]/)
  assert.match(FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/)
  assert.match(FOCUSABLE_SELECTOR, /input:not\(\[disabled\]\)/)
  assert.match(FOCUSABLE_SELECTOR, /\[tabindex\]:not\(\[tabindex="-1"\]\)/)
})

test("resolveFocusTrapKey closes on Escape", () => {
  assert.deepEqual(
    resolveFocusTrapKey({
      key: "Escape",
      shiftKey: false,
      focusableCount: 2,
      activeIsFirst: false,
      activeIsLast: false,
    }),
    { action: "close", preventDefault: true }
  )
})

test("resolveFocusTrapKey cycles Tab at the edges", () => {
  assert.deepEqual(
    resolveFocusTrapKey({
      key: "Tab",
      shiftKey: false,
      focusableCount: 2,
      activeIsFirst: false,
      activeIsLast: true,
    }),
    { action: "focus-first", preventDefault: true }
  )
  assert.deepEqual(
    resolveFocusTrapKey({
      key: "Tab",
      shiftKey: true,
      focusableCount: 2,
      activeIsFirst: true,
      activeIsLast: false,
    }),
    { action: "focus-last", preventDefault: true }
  )
})

test("resolveFocusTrapKey focuses the panel when there are no tabbables", () => {
  assert.deepEqual(
    resolveFocusTrapKey({
      key: "Tab",
      shiftKey: false,
      focusableCount: 0,
      activeIsFirst: false,
      activeIsLast: false,
    }),
    { action: "focus-panel", preventDefault: true }
  )
})

test("resolveFocusTrapKey leaves mid-list Tab alone", () => {
  assert.deepEqual(
    resolveFocusTrapKey({
      key: "Tab",
      shiftKey: false,
      focusableCount: 3,
      activeIsFirst: false,
      activeIsLast: false,
    }),
    { action: "none", preventDefault: false }
  )
  assert.deepEqual(
    resolveFocusTrapKey({
      key: "ArrowDown",
      shiftKey: false,
      focusableCount: 3,
      activeIsFirst: true,
      activeIsLast: false,
    }),
    { action: "none", preventDefault: false }
  )
})

test("resolveFocusRestoreTarget prefers the trigger over prior focus", () => {
  assert.equal(resolveFocusRestoreTarget("trigger", "previous"), "trigger")
  assert.equal(resolveFocusRestoreTarget(null, "previous"), "previous")
  assert.equal(resolveFocusRestoreTarget(null, null), null)
})

test("resolveInitialFocus picks the first tabbable or the panel", () => {
  assert.equal(resolveInitialFocus(["a", "b"], "panel"), "a")
  assert.equal(resolveInitialFocus([], "panel"), "panel")
  assert.equal(resolveInitialFocus([], null), null)
})

test("lockBodyScroll and unlockBodyScroll round-trip overflow", () => {
  const body = { style: { overflow: "" } }
  const previous = lockBodyScroll(body)
  assert.equal(previous, "")
  assert.equal(body.style.overflow, "hidden")
  unlockBodyScroll(body, previous)
  assert.equal(body.style.overflow, "")

  body.style.overflow = "auto"
  const nested = lockBodyScroll(body)
  assert.equal(nested, "auto")
  unlockBodyScroll(body, nested)
  assert.equal(body.style.overflow, "auto")
})
