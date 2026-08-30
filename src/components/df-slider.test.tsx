import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Slider } from "./df-slider"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => true)
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

function mockTrackRect(track: HTMLElement) {
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
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

describe("Slider drag gesture", () => {
  it("ends cleanly when pointercancel interrupts a drag", () => {
    const tracker = trackWindowListeners()
    const onValueChange = vi.fn()
    render(
      <Slider
        defaultValue={[20]}
        min={0}
        max={100}
        aria-label="Volume"
        onValueChange={onValueChange}
      />
    )

    try {
      const track = document.querySelector("[data-df='slider-control']")
      expect(track).toBeInstanceOf(HTMLElement)
      mockTrackRect(track as HTMLElement)

      fireEvent.pointerDown(track as HTMLElement, {
        pointerId: 1,
        clientX: 20,
        clientY: 10,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)
      expect(tracker.count("pointercancel")).toBeGreaterThan(0)

      dispatchWindowPointer("pointercancel")

      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)

      const callsAfterCancel = onValueChange.mock.calls.length
      dispatchWindowPointer("pointermove", undefined, 80)
      expect(onValueChange).toHaveBeenCalledTimes(callsAfterCancel)
      expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow")
    } finally {
      tracker.restore()
    }
  })

  it("ignores move and release from a different pointer id", () => {
    const tracker = trackWindowListeners()
    const onValueChange = vi.fn()
    render(
      <Slider
        defaultValue={[20]}
        min={0}
        max={100}
        aria-label="Volume"
        onValueChange={onValueChange}
      />
    )

    try {
      const track = document.querySelector("[data-df='slider-control']")
      expect(track).toBeInstanceOf(HTMLElement)
      mockTrackRect(track as HTMLElement)

      dispatchDomPointer(track as HTMLElement, "pointerdown", 11, 20, 10)
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      const callsAfterDown = onValueChange.mock.calls.length
      dispatchWindowPointer("pointermove", 99, 80)
      expect(onValueChange).toHaveBeenCalledTimes(callsAfterDown)

      dispatchWindowPointer("pointerup", 99, 80)
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      dispatchWindowPointer("pointermove", 11, 80)
      expect(onValueChange.mock.calls.length).toBeGreaterThan(callsAfterDown)

      dispatchWindowPointer("pointerup", 11, 80)
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)
    } finally {
      tracker.restore()
    }
  })

  it("removes window listeners and does not throw when unmounted mid-drag", () => {
    const tracker = trackWindowListeners()
    const onValueChange = vi.fn()
    const { unmount } = render(
      <Slider
        defaultValue={[40]}
        min={0}
        max={100}
        aria-label="Opacity"
        onValueChange={onValueChange}
      />
    )

    try {
      const track = document.querySelector("[data-df='slider-control']")
      expect(track).toBeInstanceOf(HTMLElement)
      mockTrackRect(track as HTMLElement)

      fireEvent.pointerDown(track as HTMLElement, {
        pointerId: 2,
        clientX: 40,
        clientY: 10,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      expect(() => unmount()).not.toThrow()
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)

      expect(() => {
        dispatchWindowPointer("pointermove", undefined, 90)
      }).not.toThrow()
    } finally {
      tracker.restore()
    }
  })
})
