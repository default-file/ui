import assert from "node:assert/strict"
import { test } from "node:test"

import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from "@tanstack/virtual-core"

import { resolveEstimateSize, type UseVirtualRowsOptions } from "./index.ts"

function createMockScrollElement(height: number, scrollTop = 0) {
  const listeners = new Map<string, Set<EventListener>>()
  return {
    clientHeight: height,
    clientWidth: 640,
    scrollTop,
    scrollLeft: 0,
    scrollHeight: height * 40,
    scrollWidth: 640,
    offsetHeight: height,
    offsetWidth: 640,
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        bottom: height,
        right: 640,
        width: 640,
        height,
        x: 0,
        y: 0,
        toJSON() {
          return {}
        },
      }
    },
    addEventListener(type: string, listener: EventListener) {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
  }
}

function snapshotVirtualRows(options: UseVirtualRowsOptions) {
  const scrollElement = createMockScrollElement(120)
  const virtualizer = new Virtualizer<Element, Element>({
    count: options.count,
    estimateSize: resolveEstimateSize(options.estimateSize),
    getScrollElement: () => scrollElement as unknown as Element,
    overscan: options.overscan ?? 0,
    initialRect: { width: 640, height: 120 },
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    onChange: () => {},
  })
  virtualizer._didMount()
  virtualizer._willUpdate()
  return {
    items: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  }
}

test("resolveEstimateSize accepts a fixed size or per-index function", () => {
  assert.equal(resolveEstimateSize(32)(0), 32)
  assert.equal(resolveEstimateSize(32)(9), 32)
  assert.equal(resolveEstimateSize((index) => 10 + index)(3), 13)
})

test("fixed-size rows expose totalSize as count times estimateSize", () => {
  const { totalSize, items } = snapshotVirtualRows({
    count: 100,
    estimateSize: 40,
    getScrollElement: () => null,
    overscan: 0,
  })
  assert.equal(totalSize, 4000)
  assert.ok(items.length > 0)
  assert.equal(items[0]?.index, 0)
  assert.equal(items[0]?.size, 40)
  assert.equal(items[0]?.start, 0)
  const last = items[items.length - 1]
  assert.ok(last)
  assert.ok(last.index < 100)
})

test("overscan widens the visible item window", () => {
  const tight = snapshotVirtualRows({
    count: 50,
    estimateSize: 40,
    getScrollElement: () => null,
    overscan: 0,
  })
  const wide = snapshotVirtualRows({
    count: 50,
    estimateSize: 40,
    getScrollElement: () => null,
    overscan: 4,
  })
  assert.ok(wide.items.length >= tight.items.length)
})
