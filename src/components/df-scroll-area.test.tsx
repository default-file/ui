import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ScrollArea } from "./df-scroll-area"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function trackWindowListeners() {
  const active = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const originalAdd = window.addEventListener.bind(window)
  const originalRemove = window.removeEventListener.bind(window)

  window.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    let set = active.get(type)
    if (!set) {
      set = new Set()
      active.set(type, set)
    }
    set.add(listener)
    return originalAdd(type, listener, options)
  }) as typeof window.addEventListener

  window.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) => {
    active.get(type)?.delete(listener)
    return originalRemove(type, listener, options)
  }) as typeof window.removeEventListener

  return {
    count(type: string) {
      return active.get(type)?.size ?? 0
    },
    restore() {
      window.addEventListener = originalAdd
      window.removeEventListener = originalRemove
    },
  }
}

describe("ScrollArea drag teardown", () => {
  it("removes window drag listeners on pointerup", () => {
    const tracker = trackWindowListeners()
    const { container } = render(
      <ScrollArea visibility="always" style={{ height: 120, width: 120 }}>
        <div style={{ height: 480 }}>Overflow content</div>
      </ScrollArea>
    )

    try {
      const thumb = container.querySelector(
        '[data-df="scroll-area-thumb"]'
      ) as HTMLDivElement
      fireEvent.pointerDown(thumb, {
        pointerId: 1,
        clientY: 10,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)
      expect(tracker.count("pointerup")).toBeGreaterThan(0)
      expect(tracker.count("pointercancel")).toBeGreaterThan(0)

      fireEvent.pointerUp(window, { pointerId: 1, clientY: 40 })
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)
    } finally {
      tracker.restore()
    }
  })

  it("removes window drag listeners when unmounted mid-drag", () => {
    const tracker = trackWindowListeners()
    const { container, unmount } = render(
      <ScrollArea visibility="always" style={{ height: 120, width: 120 }}>
        <div style={{ height: 480, width: 80 }}>Overflow content</div>
      </ScrollArea>
    )

    try {
      const viewport = container.querySelector(
        '[data-df="scroll-area-viewport"]'
      ) as HTMLDivElement
      const thumb = container.querySelector(
        '[data-df="scroll-area-thumb"]'
      ) as HTMLDivElement
      expect(viewport).toBeTruthy()
      expect(thumb).toBeTruthy()

      let scrollTop = 0
      Object.defineProperty(viewport, "clientHeight", {
        configurable: true,
        value: 120,
      })
      Object.defineProperty(viewport, "scrollHeight", {
        configurable: true,
        value: 480,
      })
      Object.defineProperty(viewport, "scrollTop", {
        configurable: true,
        get: () => scrollTop,
        set: (next: number) => {
          scrollTop = next
        },
      })

      fireEvent.pointerDown(thumb, {
        pointerId: 1,
        clientY: 10,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)
      expect(tracker.count("pointerup")).toBeGreaterThan(0)
      expect(tracker.count("pointercancel")).toBeGreaterThan(0)

      unmount()

      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)

      const topAfterUnmount = scrollTop
      fireEvent.pointerMove(window, { clientY: 80 })
      expect(scrollTop).toBe(topAfterUnmount)
    } finally {
      tracker.restore()
    }
  })

  it("tears down the active drag on pointercancel", () => {
    const tracker = trackWindowListeners()
    const { container } = render(
      <ScrollArea visibility="always" style={{ height: 120, width: 120 }}>
        <div style={{ height: 480 }}>Overflow content</div>
      </ScrollArea>
    )

    try {
      const thumb = container.querySelector(
        '[data-df="scroll-area-thumb"]'
      ) as HTMLDivElement
      fireEvent.pointerDown(thumb, {
        pointerId: 1,
        clientY: 10,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      fireEvent.pointerCancel(window, { pointerId: 1 })
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)
    } finally {
      tracker.restore()
    }
  })
})
