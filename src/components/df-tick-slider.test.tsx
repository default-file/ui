import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TickSlider } from "./df-tick-slider"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => true)
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

function dispatchDomPointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  pointerId: number,
  clientX = 0,
  clientY = 0
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: pointerId,
  })
  Object.defineProperty(event, "clientX", {
    configurable: true,
    value: clientX,
  })
  Object.defineProperty(event, "clientY", {
    configurable: true,
    value: clientY,
  })
  Object.defineProperty(event, "button", { configurable: true, value: 0 })
  Object.defineProperty(event, "buttons", {
    configurable: true,
    value: type === "pointerup" || type === "pointercancel" ? 0 : 1,
  })
  target.dispatchEvent(event)
}

function dispatchWindowPointer(
  type: "pointermove" | "pointerup" | "pointercancel",
  pointerId?: number,
  clientX = 0
) {
  const event = new Event(type, { bubbles: true })
  if (pointerId !== undefined) {
    Object.defineProperty(event, "pointerId", { value: pointerId })
  }
  Object.defineProperty(event, "clientX", { value: clientX })
  window.dispatchEvent(event)
}

describe("TickSlider drag gesture", () => {
  it("ends cleanly on pointercancel and clears listeners on unmount", () => {
    const tracker = trackWindowListeners()
    const onValueChange = vi.fn()
    const { unmount } = render(
      <TickSlider
        defaultValue={2}
        min={0}
        max={10}
        aria-label="Steps"
        onValueChange={onValueChange}
      />
    )

    try {
      const track = document.querySelector("[data-df='tick-slider-track']")
      expect(track).toBeInstanceOf(HTMLElement)
      vi.spyOn(track as HTMLElement, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 20,
        right: 100,
        width: 100,
        height: 20,
        toJSON: () => ({}),
      })

      fireEvent.pointerDown(track as HTMLElement, {
        pointerId: 3,
        clientX: 30,
        clientY: 10,
        buttons: 1,
      })
      expect(tracker.count("pointercancel")).toBeGreaterThan(0)

      dispatchWindowPointer("pointercancel")
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)

      fireEvent.pointerDown(track as HTMLElement, {
        pointerId: 4,
        clientX: 50,
        clientY: 10,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)
      expect(() => unmount()).not.toThrow()
      expect(tracker.count("pointermove")).toBe(0)
    } finally {
      tracker.restore()
    }
  })

  it("ignores move and release from a different pointer id", () => {
    const tracker = trackWindowListeners()
    const onValueChange = vi.fn()
    render(
      <TickSlider
        defaultValue={2}
        min={0}
        max={10}
        aria-label="Steps"
        onValueChange={onValueChange}
      />
    )

    try {
      const track = document.querySelector("[data-df='tick-slider-track']")
      expect(track).toBeInstanceOf(HTMLElement)
      vi.spyOn(track as HTMLElement, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 20,
        right: 100,
        width: 100,
        height: 20,
        toJSON: () => ({}),
      })

      dispatchDomPointer(track as HTMLElement, "pointerdown", 21, 30, 10)
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      const callsAfterDown = onValueChange.mock.calls.length
      dispatchWindowPointer("pointermove", 88, 90)
      expect(onValueChange).toHaveBeenCalledTimes(callsAfterDown)

      dispatchWindowPointer("pointerup", 88, 90)
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      dispatchWindowPointer("pointermove", 21, 90)
      expect(onValueChange.mock.calls.length).toBeGreaterThan(callsAfterDown)

      dispatchWindowPointer("pointerup", 21, 90)
      expect(tracker.count("pointermove")).toBe(0)
    } finally {
      tracker.restore()
    }
  })
})
