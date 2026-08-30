import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ColorPicker } from "./df-color-picker"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
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

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Pick color" }))
  return screen.findByLabelText("Hex color")
}

function areaSlider() {
  return screen.getByRole("slider", { name: "Saturation and brightness" })
}

function hueSlider() {
  return screen.getByRole("slider", { name: "Hue" })
}

describe("ColorPicker closed-state resync", () => {
  it("restores hsv and hexDraft from value when closing without a committed prop update", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#FF0000" onChange={onChange} />)

    const hexInput = await openPicker(user)
    await user.clear(hexInput)
    await user.type(hexInput, "0000FF")
    expect(hexInput).toHaveValue("0000FF")
    expect(onChange).toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Pick color" }))
    expect(screen.queryByLabelText("Hex color")).not.toBeInTheDocument()

    const restored = await openPicker(user)
    expect(restored).toHaveValue("#FF0000")
  })

  it("follows an external value change while closed", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <ColorPicker value="#FF0000" onChange={onChange} />
    )

    rerender(<ColorPicker value="#00FF00" onChange={onChange} />)

    const hexInput = await openPicker(user)
    expect(hexInput).toHaveValue("#00FF00")
  })

  it("does not overwrite an in-progress draft when value changes while open", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <ColorPicker value="#FF0000" onChange={onChange} />
    )

    const hexInput = await openPicker(user)
    await user.clear(hexInput)
    await user.type(hexInput, "ABC")
    expect(hexInput).toHaveValue("ABC")

    rerender(<ColorPicker value="#0000FF" onChange={onChange} />)
    expect(screen.getByLabelText("Hex color")).toHaveValue("ABC")
  })
})

describe("ColorPicker drag teardown", () => {
  it("removes window drag listeners when unmounted mid-drag", async () => {
    const user = userEvent.setup()
    const tracker = trackWindowListeners()
    const onChange = vi.fn()
    const { unmount } = render(
      <ColorPicker value="#FF0000" onChange={onChange} />
    )

    try {
      await openPicker(user)
      const sv = areaSlider()
      expect(sv).toBeInstanceOf(HTMLElement)

      vi.spyOn(sv, "getBoundingClientRect").mockReturnValue({
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

      fireEvent.pointerDown(sv, {
        pointerId: 1,
        clientX: 20,
        clientY: 20,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)
      expect(tracker.count("pointerup")).toBeGreaterThan(0)
      expect(tracker.count("pointercancel")).toBeGreaterThan(0)

      const callsAfterDown = onChange.mock.calls.length
      unmount()

      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)

      fireEvent.pointerMove(window, { clientX: 80, clientY: 80 })
      expect(onChange).toHaveBeenCalledTimes(callsAfterDown)
    } finally {
      tracker.restore()
    }
  })

  it("ends the saturation drag on pointercancel", async () => {
    const user = userEvent.setup()
    const tracker = trackWindowListeners()
    const onChange = vi.fn()
    render(<ColorPicker value="#FF0000" onChange={onChange} />)

    try {
      await openPicker(user)
      const sv = areaSlider()
      expect(sv).toBeInstanceOf(HTMLElement)
      vi.spyOn(sv, "getBoundingClientRect").mockReturnValue({
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

      fireEvent.pointerDown(sv, {
        pointerId: 7,
        clientX: 20,
        clientY: 20,
        buttons: 1,
      })
      const callsAfterDown = onChange.mock.calls.length

      dispatchWindowPointer("pointercancel")
      expect(tracker.count("pointermove")).toBe(0)

      dispatchWindowPointer("pointermove", undefined, 80, 80)
      expect(onChange).toHaveBeenCalledTimes(callsAfterDown)
    } finally {
      tracker.restore()
    }
  })
})

describe("ColorPicker swatch sanitization", () => {
  it("does not write a hostile value into the trigger background", () => {
    const onChange = vi.fn()
    const { container } = render(
      <ColorPicker
        value={"red; background:url(javascript:alert(1))" as string}
        onChange={onChange}
      />
    )

    const swatch = container.querySelector(
      "[data-df='color-picker'] span, button span"
    )
    const styled = container.querySelectorAll("[style]")
    for (const node of styled) {
      const background = (node as HTMLElement).style.backgroundColor
      expect(background).not.toContain("javascript")
      expect(background).not.toContain("url(")
      expect(background).not.toContain(";")
    }
    expect(swatch == null || swatch instanceof HTMLElement).toBe(true)
  })
})

describe("ColorPicker keyboard and accessibility", () => {
  it("exposes both surfaces to the keyboard and announces the current colour", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#FF0000" onChange={onChange} />)
    await openPicker(user)

    const area = areaSlider()
    const hue = hueSlider()

    expect(area).toHaveAttribute("tabindex", "0")
    expect(hue).toHaveAttribute("tabindex", "0")
    expect(area).toHaveAttribute(
      "aria-valuetext",
      "Saturation 100%, brightness 100%"
    )
    expect(hue).toHaveAttribute("aria-valuemax", "360")
    expect(hue).toHaveAttribute("aria-valuetext", "0 degrees")
  })

  it("moves saturation right and brightness up matching the drawn axes", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#808080" onChange={onChange} />)
    await openPicker(user)

    const area = areaSlider()
    area.focus()

    const start = area.getAttribute("aria-valuetext") ?? ""
    const startSat = Number(/Saturation (\d+)%/.exec(start)?.[1] ?? "NaN")
    const startBri = Number(/brightness (\d+)%/.exec(start)?.[1] ?? "NaN")

    fireEvent.keyDown(area, { key: "ArrowRight" })
    let text = area.getAttribute("aria-valuetext") ?? ""
    expect(Number(/Saturation (\d+)%/.exec(text)?.[1])).toBeGreaterThan(startSat)

    fireEvent.keyDown(area, { key: "ArrowLeft" })
    text = area.getAttribute("aria-valuetext") ?? ""
    expect(Number(/Saturation (\d+)%/.exec(text)?.[1])).toBe(startSat)

    fireEvent.keyDown(area, { key: "ArrowUp" })
    text = area.getAttribute("aria-valuetext") ?? ""
    expect(Number(/brightness (\d+)%/.exec(text)?.[1])).toBeGreaterThan(startBri)

    fireEvent.keyDown(area, { key: "ArrowDown" })
    text = area.getAttribute("aria-valuetext") ?? ""
    expect(Number(/brightness (\d+)%/.exec(text)?.[1])).toBe(startBri)

    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/^#[0-9A-F]{6}$/)
  })

  it("applies a larger brightness step on PageUp than on ArrowUp", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { unmount } = render(
      <ColorPicker value="#808080" onChange={onChange} />
    )
    await openPicker(user)

    const area = areaSlider()
    area.focus()
    const startText = area.getAttribute("aria-valuetext") ?? ""
    const startBrightness = Number(
      /brightness (\d+)%/.exec(startText)?.[1] ?? "NaN"
    )

    fireEvent.keyDown(area, { key: "ArrowUp" })
    const arrowText = area.getAttribute("aria-valuetext") ?? ""
    const arrowBrightness = Number(
      /brightness (\d+)%/.exec(arrowText)?.[1] ?? "NaN"
    )
    const arrowDelta = arrowBrightness - startBrightness

    unmount()
    onChange.mockClear()
    render(<ColorPicker value="#808080" onChange={onChange} />)
    await openPicker(user)
    const areaAgain = areaSlider()
    areaAgain.focus()
    fireEvent.keyDown(areaAgain, { key: "PageUp" })
    const pageText = areaAgain.getAttribute("aria-valuetext") ?? ""
    const pageBrightness = Number(
      /brightness (\d+)%/.exec(pageText)?.[1] ?? "NaN"
    )
    const pageDelta = pageBrightness - startBrightness

    expect(arrowDelta).toBeGreaterThan(0)
    expect(pageDelta).toBeGreaterThan(arrowDelta)
    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/^#[0-9A-F]{6}$/)
  })

  it("reaches saturation ends with Home and End", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#808080" onChange={onChange} />)
    await openPicker(user)

    const area = areaSlider()
    area.focus()

    fireEvent.keyDown(area, { key: "Home" })
    expect(area).toHaveAttribute("aria-valuenow", "0")
    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/^#[0-9A-F]{6}$/)

    fireEvent.keyDown(area, { key: "End" })
    expect(area).toHaveAttribute("aria-valuenow", "100")
  })

  it("moves hue down the strip with ArrowDown and up the strip with ArrowUp", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#00FF00" onChange={onChange} />)
    await openPicker(user)

    const hue = hueSlider()
    hue.focus()
    const start = Number(hue.getAttribute("aria-valuenow"))

    fireEvent.keyDown(hue, { key: "ArrowDown" })
    const afterDown = Number(hue.getAttribute("aria-valuenow"))
    expect(afterDown).toBeGreaterThan(start)

    fireEvent.keyDown(hue, { key: "ArrowUp" })
    expect(Number(hue.getAttribute("aria-valuenow"))).toBe(start)

    fireEvent.keyDown(hue, { key: "PageDown" })
    const afterPageDown = Number(hue.getAttribute("aria-valuenow"))
    expect(afterPageDown - start).toBeGreaterThan(afterDown - start)

    fireEvent.keyDown(hue, { key: "PageUp" })
    expect(Number(hue.getAttribute("aria-valuenow"))).toBe(start)

    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/^#[0-9A-F]{6}$/)
  })

  it("treats Home as the top of the strip and End as the bottom, announcing whole degrees", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#00FF00" onChange={onChange} />)
    await openPicker(user)

    const hue = hueSlider()
    hue.focus()

    fireEvent.keyDown(hue, { key: "Home" })
    expect(hue).toHaveAttribute("aria-valuenow", "0")
    expect(hue).toHaveAttribute("aria-valuetext", "0 degrees")

    fireEvent.keyDown(hue, { key: "End" })
    expect(hue).toHaveAttribute("aria-valuemax", "360")
    expect(hue).toHaveAttribute("aria-valuenow", "360")
    expect(hue).toHaveAttribute("aria-valuetext", "360 degrees")
    expect(hue.getAttribute("aria-valuetext")).not.toMatch(/\./)
  })

  it("wraps hue past both ends of the strip", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#FF0000" onChange={onChange} />)
    await openPicker(user)

    const hue = hueSlider()
    hue.focus()

    fireEvent.keyDown(hue, { key: "ArrowUp" })
    expect(Number(hue.getAttribute("aria-valuenow"))).toBe(359)

    fireEvent.keyDown(hue, { key: "ArrowDown" })
    expect(hue).toHaveAttribute("aria-valuenow", "0")

    fireEvent.keyDown(hue, { key: "End" })
    expect(hue).toHaveAttribute("aria-valuenow", "360")
    fireEvent.keyDown(hue, { key: "ArrowDown" })
    expect(hue).toHaveAttribute("aria-valuenow", "1")
  })

  it("never announces a fractional hue", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#00FF00" onChange={onChange} />)
    await openPicker(user)

    const hue = hueSlider()
    hue.focus()
    fireEvent.keyDown(hue, { key: "End" })
    fireEvent.keyDown(hue, { key: "ArrowUp" })
    fireEvent.keyDown(hue, { key: "PageDown" })

    expect(hue.getAttribute("aria-valuenow")).toMatch(/^\d+$/)
    expect(hue.getAttribute("aria-valuetext")).toMatch(/^\d+ degrees$/)
  })

  it("keeps the pointer path committing hex strings", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPicker value="#FF0000" onChange={onChange} />)
    await openPicker(user)

    const sv = areaSlider()
    vi.spyOn(sv, "getBoundingClientRect").mockReturnValue({
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

    const down = new Event("pointerdown", { bubbles: true })
    Object.defineProperty(down, "pointerId", { value: 3 })
    Object.defineProperty(down, "clientX", { value: 50 })
    Object.defineProperty(down, "clientY", { value: 50 })
    Object.defineProperty(down, "buttons", { value: 1 })
    sv.dispatchEvent(down)

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/^#[0-9A-F]{6}$/)
  })

  it("puts pill chrome on the trigger part instead of padding utilities", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ColorPicker value="#3B82F6" trailing="hex" onChange={onChange} />
    )
    const hex = screen.getByRole("button", { name: "Pick color" })
    expect(hex).toHaveAttribute("data-df", "color-picker-trigger")
    expect(hex).toHaveAttribute("data-trailing", "hex")
    expect(hex.className.split(/\s+/)).not.toContain("pl-1.5")

    rerender(
      <ColorPicker
        value="#3B82F6"
        trailing="clear"
        onChange={onChange}
        onClear={() => {}}
      />
    )
    const shell = document.querySelector('[data-df="color-picker-trigger"]')
    expect(shell).toHaveAttribute("data-trailing", "clear")
    expect(shell?.className.split(/\s+/)).not.toContain("pl-1.5")
    expect(
      document.querySelector('[data-df="color-picker-open"]')
    ).toBeInTheDocument()
  })

  it("passes axe when open", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(
      <ColorPicker value="#FF0000" onChange={onChange} />
    )
    await openPicker(user)
    expect(await axe(container)).toHaveNoViolations()
  })
})
