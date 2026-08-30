import assert from "node:assert/strict"
import { test } from "node:test"

import {
  createCssPxLayoutGainGate,
  readCssPx,
  shouldRemeasureCssPxOnResize,
} from "./index.ts"

function mockComputedStyle(
  getPropertyValue: (token: string, element: Element) => string,
  heightForProbe?: (element: Element) => string
): typeof getComputedStyle {
  return ((el: Element) => {
    return {
      getPropertyValue(token: string) {
        return getPropertyValue(token, el)
      },
      get height() {
        return heightForProbe?.(el) ?? "auto"
      },
    } as unknown as CSSStyleDeclaration
  }) as typeof getComputedStyle
}

test("readCssPx fast path returns plain pixel lengths", () => {
  const element = {} as Element
  const original = globalThis.getComputedStyle
  globalThis.getComputedStyle = mockComputedStyle(() => " 42px ")

  try {
    assert.equal(readCssPx(element, "--row-height", 36), 42)
  } finally {
    globalThis.getComputedStyle = original
  }
})

test("readCssPx treats 0px as a legitimate value", () => {
  const element = {} as Element
  const original = globalThis.getComputedStyle
  globalThis.getComputedStyle = mockComputedStyle(() => "0px")

  try {
    assert.equal(readCssPx(element, "--gap", 16), 0)
  } finally {
    globalThis.getComputedStyle = original
  }
})

test("readCssPx returns fallback for absent tokens", () => {
  const element = {} as Element
  const original = globalThis.getComputedStyle
  globalThis.getComputedStyle = mockComputedStyle(() => "   ")

  try {
    assert.equal(readCssPx(element, "--missing-token", 36), 36)
  } finally {
    globalThis.getComputedStyle = original
  }
})

test("readCssPx returns fallback for negative plain lengths", () => {
  const element = {} as Element
  const original = globalThis.getComputedStyle
  globalThis.getComputedStyle = mockComputedStyle(() => "-4px")

  try {
    assert.equal(readCssPx(element, "--bad", 16), 16)
  } finally {
    globalThis.getComputedStyle = original
  }
})

test("readCssPx falls back for calc text when no document can measure", () => {
  const element = {} as Element
  const originalStyle = globalThis.getComputedStyle
  const originalDocument = globalThis.document
  globalThis.getComputedStyle = mockComputedStyle(
    () => "calc(9 * 0.25rem)"
  )
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: undefined,
  })

  try {
    assert.equal(readCssPx(element, "--df-data-grid-row-height", 36), 36)
  } finally {
    globalThis.getComputedStyle = originalStyle
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: originalDocument,
    })
  }
})

test("readCssPx inserts the probe into the host and always removes it", () => {
  const children: { remove: () => void }[] = []
  const host = {
    appendChild(node: { remove: () => void }) {
      children.push(node)
      return node
    },
  } as unknown as Element

  const probe = {
    setAttribute() {},
    style: { cssText: "" },
    remove() {
      const index = children.indexOf(probe)
      if (index >= 0) children.splice(index, 1)
    },
  }

  const originalDocument = globalThis.document
  const originalStyle = globalThis.getComputedStyle

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement() {
        return probe
      },
    },
  })
  globalThis.getComputedStyle = mockComputedStyle(
    () => "calc(10 * 0.25rem)",
    () => {
      throw new Error("measurement failed")
    }
  )

  try {
    assert.equal(readCssPx(host, "--df-timeline-unit-px", 40), 40)
    assert.equal(children.length, 0)
  } finally {
    globalThis.getComputedStyle = originalStyle
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: originalDocument,
    })
  }
})

test("readCssPx uses the host element for the initial token read", () => {
  const root = { id: "root" } as unknown as Element
  const scoped = { id: "scoped" } as unknown as Element
  const original = globalThis.getComputedStyle
  globalThis.getComputedStyle = mockComputedStyle((_token, el) => {
    if (el === scoped) return "28px"
    if (el === root) return "36px"
    return ""
  })

  try {
    assert.equal(readCssPx(scoped, "--df-data-grid-row-height", 36), 28)
    assert.equal(readCssPx(root, "--df-data-grid-row-height", 36), 36)
  } finally {
    globalThis.getComputedStyle = original
  }
})

test("shouldRemeasureCssPxOnResize only fires on layout gain", () => {
  assert.equal(shouldRemeasureCssPxOnResize(false, true), true)
  assert.equal(shouldRemeasureCssPxOnResize(true, true), false)
  assert.equal(shouldRemeasureCssPxOnResize(false, false), false)
  assert.equal(shouldRemeasureCssPxOnResize(true, false), false)
})

test("layout gain gate re-resolves when ResizeObserver reports a new box", () => {
  const gate = createCssPxLayoutGainGate()

  // Mount inside display: none: resolve records no layout and latches fallback.
  gate.syncFromElement(false)
  assert.equal(gate.hadLayout, false)

  // Observer fires as the host gains a box (tab/panel/drawer open).
  assert.equal(gate.consumeResize(true), true)

  // After resolve syncs laid-out state, continuous size changes must not remeasure.
  gate.syncFromElement(true)
  assert.equal(gate.consumeResize(true), false)
  assert.equal(gate.consumeResize(true), false)

  // Losing the box clears the flag so the next gain can re-resolve.
  assert.equal(gate.consumeResize(false), false)
  assert.equal(gate.hadLayout, false)
  assert.equal(gate.consumeResize(true), true)
})

test("readCssPx probe styles keep the host content box unchanged", () => {
  let probeCssText = ""
  const children: { remove: () => void }[] = []
  const host = {
    appendChild(node: { remove: () => void }) {
      children.push(node)
      return node
    },
  } as unknown as Element

  const probe = {
    setAttribute() {},
    style: {
      set cssText(value: string) {
        probeCssText = value
      },
      get cssText() {
        return probeCssText
      },
    },
    remove() {
      const index = children.indexOf(probe)
      if (index >= 0) children.splice(index, 1)
    },
  }

  const originalDocument = globalThis.document
  const originalStyle = globalThis.getComputedStyle

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement() {
        return probe
      },
    },
  })
  globalThis.getComputedStyle = mockComputedStyle(
    () => "calc(10 * 0.25rem)",
    () => "40px"
  )

  try {
    assert.equal(readCssPx(host, "--df-timeline-unit-px", 24), 40)
    assert.match(probeCssText, /position:absolute/)
    assert.match(probeCssText, /width:0/)
    assert.match(probeCssText, /pointer-events:none/)
    assert.equal(children.length, 0)
  } finally {
    globalThis.getComputedStyle = originalStyle
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: originalDocument,
    })
  }
})
