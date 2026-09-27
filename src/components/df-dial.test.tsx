import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Dial } from "./df-dial"
import {
  commitDialValue,
  turnPixelsFromFace,
  valueDeltaFromTravel,
} from "../lib/df-dial"

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
      set.add(listener)
      active.set(type, set)
    } else {
      set.add(listener)
    }
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

function mockFaceRect(face: HTMLElement) {
  vi.spyOn(face, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    width: 100,
    height: 100,
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
  clientX = 0,
  clientY = 0
) {
  const event = new Event(type, { bubbles: true })
  if (pointerId !== undefined) {
    Object.defineProperty(event, "pointerId", { value: pointerId })
  }
  Object.defineProperty(event, "clientX", { value: clientX })
  Object.defineProperty(event, "clientY", { value: clientY })
  window.dispatchEvent(event)
}

const FACE_TURN = turnPixelsFromFace(100)

function committedFromTravel(
  travel: number,
  start = 0,
  wrap = false
) {
  return commitDialValue(
    start + valueDeltaFromTravel(travel, 0, 100, FACE_TURN),
    0,
    100,
    1,
    wrap
  )
}

describe("Dial", () => {
  it("maps horizontal pointer travel onto the value range", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        min={0}
        max={100}
        defaultValue={0}
        dragAxis="horizontal"
        aria-label="Level"
        onValueChange={onValueChange}
      />
    )

    const host = document.querySelector("[data-df='dial']")
    expect(host).toHaveAttribute("data-drag-axis", "horizontal")
    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    mockFaceRect(face as HTMLElement)

    dispatchDomPointer(face as HTMLElement, "pointerdown", 1, 50, 50)
    expect(onValueChange).not.toHaveBeenCalled()

    dispatchWindowPointer("pointermove", 1, 150, 50)
    expect(onValueChange).toHaveBeenCalled()
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(committedFromTravel(100))
  })

  it("maps upward pointer travel onto the value range", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        min={0}
        max={100}
        defaultValue={0}
        dragAxis="vertical"
        aria-label="Level"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    mockFaceRect(face as HTMLElement)

    dispatchDomPointer(face as HTMLElement, "pointerdown", 1, 50, 80)
    dispatchWindowPointer("pointermove", 1, 50, -20)
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(committedFromTravel(100))
  })

  it("ignores the unused axis when dragAxis is restricted", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        min={0}
        max={100}
        defaultValue={0}
        dragAxis="horizontal"
        aria-label="Level"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    mockFaceRect(face as HTMLElement)

    dispatchDomPointer(face as HTMLElement, "pointerdown", 1, 50, 50)
    dispatchWindowPointer("pointermove", 1, 150, 90)
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(committedFromTravel(100))
  })

  it("clamps a drag that passes max when wrap is off", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        min={0}
        max={100}
        defaultValue={90}
        dragAxis="horizontal"
        aria-label="Level"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    mockFaceRect(face as HTMLElement)

    dispatchDomPointer(face as HTMLElement, "pointerdown", 1, 50, 50)
    dispatchWindowPointer("pointermove", 1, 450, 50)

    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(100)
  })

  it("keeps wrapping past max when wrap is set", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        min={0}
        max={100}
        defaultValue={90}
        wrap
        dragAxis="horizontal"
        aria-label="Loop"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    mockFaceRect(face as HTMLElement)

    dispatchDomPointer(face as HTMLElement, "pointerdown", 1, 50, 50)
    dispatchWindowPointer("pointermove", 1, 250, 50)

    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(
      committedFromTravel(200, 90, true)
    )
    expect(onValueChange.mock.calls.at(-1)?.[0]).not.toBe(100)
  })

  it("wraps a 0 to 360 range without clamping at 360", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        min={0}
        max={360}
        defaultValue={350}
        wrap
        dragAxis="horizontal"
        aria-label="Turn"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    mockFaceRect(face as HTMLElement)

    dispatchDomPointer(face as HTMLElement, "pointerdown", 1, 50, 50)
    dispatchWindowPointer("pointermove", 1, 150, 50)

    const next = onValueChange.mock.calls.at(-1)?.[0]
    expect(next).toBe(
      commitDialValue(
        350 + valueDeltaFromTravel(100, 0, 360, FACE_TURN),
        0,
        360,
        1,
        true
      )
    )
    expect(next).toBeGreaterThanOrEqual(0)
    expect(next).toBeLessThan(360)
    expect(next).not.toBe(360)
  })

  it("does not fill ticks when wrap is set", () => {
    render(
      <Dial
        wrap
        min={0}
        max={360}
        defaultValue={90}
        tickCount={36}
        aria-label="Turn"
      />
    )

    const filled = document.querySelectorAll("[data-df='dial-tick'][data-filled]")
    expect(filled).toHaveLength(0)
  })

  it("fills ticks on a wrapping ring when tickFill is set", () => {
    render(
      <Dial
        wrap
        tickFill
        min={0}
        max={100}
        defaultValue={25}
        tickCount={36}
        aria-label="Loop"
      />
    )

    const filled = document.querySelectorAll("[data-df='dial-tick'][data-filled]")
    expect(filled).toHaveLength(10)
  })

  it("does not fill ticks when min is below 0", () => {
    render(
      <Dial
        min={-360}
        max={360}
        defaultValue={90}
        tickCount={36}
        aria-label="Invert"
      />
    )

    const filled = document.querySelectorAll("[data-df='dial-tick'][data-filled]")
    expect(filled).toHaveLength(0)
  })

  it("decreases on right drag when invert is set", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        invert
        min={-360}
        max={360}
        defaultValue={0}
        dragAxis="horizontal"
        aria-label="Invert"
        onValueChange={onValueChange}
      />
    )

    const host = document.querySelector("[data-df='dial']")
    expect(host).toHaveAttribute("data-invert")
    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    mockFaceRect(face as HTMLElement)

    dispatchDomPointer(face as HTMLElement, "pointerdown", 1, 50, 50)
    dispatchWindowPointer("pointermove", 1, 150, 50)

    const next = onValueChange.mock.calls.at(-1)?.[0]
    expect(next).toBe(
      commitDialValue(
        valueDeltaFromTravel(-100, -360, 360, FACE_TURN),
        -360,
        360,
        1,
        false
      )
    )
    expect(next).toBeLessThan(0)
  })

  it("decreases on ArrowRight when invert is set", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        invert
        min={-360}
        max={360}
        defaultValue={0}
        aria-label="Invert"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    fireEvent.keyDown(face as HTMLElement, { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenCalledWith(-1)
  })

  it("wraps invert past min when wrap is set and min is 0", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        invert
        wrap
        min={0}
        max={10}
        step={1}
        defaultValue={0}
        aria-label="Loop"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    fireEvent.keyDown(face as HTMLElement, { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenCalledWith(9)
  })

  it("steps from the keyboard and wraps when wrap is set", () => {
    const onValueChange = vi.fn()
    render(
      <Dial
        min={0}
        max={10}
        step={1}
        wrap
        defaultValue={9}
        aria-label="Loop"
        onValueChange={onValueChange}
      />
    )

    const face = document.querySelector("[data-df='dial-face']")
    expect(face).toBeInstanceOf(HTMLElement)
    fireEvent.keyDown(face as HTMLElement, { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenCalledWith(0)

    fireEvent.keyDown(face as HTMLElement, { key: "End" })
    expect(onValueChange).toHaveBeenCalledWith(9)
  })

  it("fills ticks from min to the current value", () => {
    render(
      <Dial
        min={0}
        max={100}
        defaultValue={25}
        tickCount={36}
        aria-label="Level"
      />
    )

    const ticks = [
      ...document.querySelectorAll("[data-df='dial-tick']"),
    ] as HTMLElement[]
    expect(ticks).toHaveLength(36)

    const filled = ticks.filter((tick) => tick.hasAttribute("data-filled"))
    expect(filled).toHaveLength(10)
    expect(ticks[0]).toHaveAttribute("data-filled")
    expect(ticks[9]).toHaveAttribute("data-filled")
    expect(ticks[10]).not.toHaveAttribute("data-filled")
    expect(ticks[18]).not.toHaveAttribute("data-filled")
  })

  it("paints default ticks as one svg ring", () => {
    render(<Dial defaultValue={40} tickCount={36} aria-label="Level" />)

    const mark = document.querySelector("[data-df='dial-tick']")
    expect(mark?.tagName).toBe("line")
    expect(mark?.getAttribute("y1")).not.toBe(mark?.getAttribute("y2"))
    expect(Number(mark?.getAttribute("y2"))).not.toBe(50)
    expect(mark?.closest("svg")).not.toBeNull()
    expect(mark?.closest("[data-df='dial-ticks']")).not.toBeNull()
  })

  it("places the dot thumb on the same ring as the ticks", () => {
    render(<Dial defaultValue={40} tickCount={36} aria-label="Level" />)

    const thumb = document.querySelector("[data-df='dial-thumb']")
    const orbit = document.querySelector("[data-df='dial-thumb-orbit']")
    expect(orbit?.closest("[data-df='dial-ticks']")).not.toBeNull()
    expect(thumb?.parentElement).toBe(orbit)
    expect(
      document.querySelector("[data-df='dial-ticks'] svg")
    ).not.toBeNull()
  })

  it("marks the nearest tick as active when thumb is tick", () => {
    render(
      <Dial
        min={0}
        max={100}
        defaultValue={25}
        tickCount={36}
        thumb="tick"
        aria-label="Level"
      />
    )

    const ticks = [
      ...document.querySelectorAll("[data-df='dial-tick']"),
    ] as HTMLElement[]
    const active = ticks.filter((tick) => tick.hasAttribute("data-active"))
    expect(active).toHaveLength(1)
    expect(ticks[9]).toHaveAttribute("data-active")
    expect(ticks[9]).toHaveAttribute("data-filled")
  })

  it("marks an inside label as a caption when a value is shown", () => {
    render(
      <Dial
        label="Vol"
        showValue
        valueFormat="percent"
        defaultValue={63}
        aria-label="Volume"
      />
    )

    const center = document.querySelector("[data-df='dial-center']")
    expect(center).toHaveAttribute("data-with-value")
    expect(center?.querySelector("[data-df='dial-label']")?.textContent).toBe(
      "Vol"
    )
    expect(center?.querySelector("[data-df='dial-value']")?.textContent).toBe(
      "63%"
    )
  })

  it("places an outside label around the face", () => {
    const { rerender } = render(
      <Dial label="Gain" labelPosition="bottom" aria-label="Gain" />
    )
    const host = document.querySelector("[data-df='dial']")
    expect(host).toHaveAttribute("data-label-position", "bottom")
    expect(document.querySelector("[data-df='dial-label']")?.textContent).toBe(
      "Gain"
    )

    rerender(
      <Dial
        label="Gain"
        labelPosition="left"
        labelGap="calc(4 * var(--spacing-unit))"
        aria-label="Gain"
      />
    )
    const spaced = document.querySelector("[data-df='dial']")
    expect(spaced).toHaveAttribute("data-label-position", "left")
    expect(
      (spaced as HTMLElement).style.getPropertyValue("--df-dial-label-gap")
    ).toBe("calc(4 * var(--spacing-unit))")
  })

  it("ends the drag on pointercancel and clears listeners on unmount", () => {
    const tracker = trackWindowListeners()
    const { unmount } = render(<Dial defaultValue={20} aria-label="Level" />)

    try {
      const face = document.querySelector("[data-df='dial-face']")
      expect(face).toBeInstanceOf(HTMLElement)
      mockFaceRect(face as HTMLElement)

      dispatchDomPointer(face as HTMLElement, "pointerdown", 3, 50, 0)
      expect(tracker.count("pointercancel")).toBeGreaterThan(0)

      dispatchWindowPointer("pointercancel", 3)
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)

      dispatchDomPointer(face as HTMLElement, "pointerdown", 4, 50, 0)
      expect(() => unmount()).not.toThrow()
      expect(tracker.count("pointermove")).toBe(0)
    } finally {
      tracker.restore()
    }
  })

  it("marks a filled face so ticks can inset from the rim", () => {
    const { rerender } = render(
      <Dial defaultValue={40} aria-label="Level" />
    )
    expect(document.querySelector("[data-df='dial']")).not.toHaveAttribute(
      "data-face"
    )

    rerender(
      <Dial
        defaultValue={40}
        faceBackground="var(--df-dial-face-fill)"
        aria-label="Level"
      />
    )
    expect(document.querySelector("[data-df='dial']")).toHaveAttribute(
      "data-face",
      "fill"
    )
  })

  it("draws a progress ring from startAngle to the current value", () => {
    render(
      <Dial
        progress
        min={0}
        max={100}
        defaultValue={25}
        aria-label="Level"
      />
    )

    const host = document.querySelector("[data-df='dial']") as HTMLElement
    expect(host).toHaveAttribute("data-progress")
    expect(host.style.getPropertyValue("--df-dial-progress-from")).toBe("0deg")
    expect(host.style.getPropertyValue("--df-dial-progress-angle")).toBe(
      "90deg"
    )
    expect(
      document.querySelector("[data-df='dial-progress']")
    ).toBeInstanceOf(HTMLElement)
  })
})
