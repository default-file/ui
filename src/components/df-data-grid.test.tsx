import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { DataGrid, type DataGridColumnState } from "./df-data-grid"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
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
  pointerId: number,
  clientX = 0
) {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, "pointerId", { value: pointerId })
  Object.defineProperty(event, "clientX", { value: clientX })
  window.dispatchEvent(event)
}

const columns = [
  {
    id: "name",
    header: "Name",
    width: 160,
    minWidth: 64,
    maxWidth: 240,
    resizable: true,
    cell: (row: { id: string; data: { name: string } }) => row.data.name,
  },
]

const rows = [{ id: "r1", data: { name: "Alpha" } }]

function headerWidth(): number {
  const header = document.querySelector(
    '[data-df="data-grid-columnheader"]:not(.df-data-grid-select-cell)'
  ) as HTMLElement
  return Number.parseFloat(header.style.width)
}

function ControlledGrid({
  initialWidth = 160,
}: {
  initialWidth?: number
}) {
  const [columnState, setColumnState] = React.useState<DataGridColumnState[]>([
    { id: "name", width: initialWidth },
  ])
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      columnState={columnState}
      onColumnStateChange={setColumnState}
    />
  )
}

describe("DataGrid column resize drag", () => {
  it("removes window listeners on pointerup", () => {
    const tracker = trackWindowListeners()
    render(<DataGrid rows={rows} columns={columns} />)

    try {
      const handle = screen.getByRole("separator", { name: "Resize Name" })
      fireEvent.pointerDown(handle, {
        pointerId: 1,
        clientX: 40,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)
      expect(tracker.count("pointerup")).toBeGreaterThan(0)
      expect(tracker.count("pointercancel")).toBeGreaterThan(0)

      fireEvent.pointerUp(window, { pointerId: 1, clientX: 80 })
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)
    } finally {
      tracker.restore()
    }
  })

  it("removes window listeners on pointercancel", () => {
    const tracker = trackWindowListeners()
    render(<DataGrid rows={rows} columns={columns} />)

    try {
      const handle = screen.getByRole("separator", { name: "Resize Name" })
      fireEvent.pointerDown(handle, {
        pointerId: 2,
        clientX: 40,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      fireEvent.pointerCancel(window, { pointerId: 2 })
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)
    } finally {
      tracker.restore()
    }
  })

  it("removes window listeners when unmounted mid-drag", () => {
    const tracker = trackWindowListeners()
    const { unmount } = render(<DataGrid rows={rows} columns={columns} />)

    try {
      const handle = screen.getByRole("separator", { name: "Resize Name" })
      fireEvent.pointerDown(handle, {
        pointerId: 3,
        clientX: 40,
        buttons: 1,
      })
      expect(tracker.count("pointermove")).toBeGreaterThan(0)

      expect(() => unmount()).not.toThrow()
      expect(tracker.count("pointermove")).toBe(0)
      expect(tracker.count("pointerup")).toBe(0)
      expect(tracker.count("pointercancel")).toBe(0)

      expect(() => {
        fireEvent.pointerMove(window, { pointerId: 3, clientX: 120 })
      }).not.toThrow()
    } finally {
      tracker.restore()
    }
  })
})

describe("DataGrid column keyboard resize", () => {
  it("keyboard ArrowRight reaches the same width as an equivalent pointer drag", () => {
    const { unmount } = render(<ControlledGrid initialWidth={160} />)
    const handle = screen.getByRole("separator", { name: "Resize Name" })
    expect(handle).toHaveAttribute("tabindex", "0")
    expect(handle).toHaveAttribute("aria-valuemin", "64")
    expect(handle).toHaveAttribute("aria-valuemax", "240")
    handle.focus()

    const widthBefore = headerWidth()
    fireEvent.keyDown(handle, { key: "ArrowRight" })
    const widthAfterKey = headerWidth()
    const keyDelta = widthAfterKey - widthBefore
    expect(keyDelta).toBeGreaterThan(0)
    unmount()

    render(<ControlledGrid initialWidth={widthBefore} />)
    const handleAgain = screen.getByRole("separator", { name: "Resize Name" })
    const down = createEvent.pointerDown(handleAgain, { buttons: 1 })
    Object.defineProperty(down, "pointerId", { value: 1 })
    Object.defineProperty(down, "clientX", { value: 100 })
    fireEvent(handleAgain, down)

    act(() => {
      dispatchWindowPointer("pointermove", 1, 100 + keyDelta)
    })
    act(() => {
      dispatchWindowPointer("pointerup", 1, 100 + keyDelta)
    })

    expect(headerWidth()).toBe(widthAfterKey)
  })

  it("Home and End move to the real min and max bounds", () => {
    render(<ControlledGrid initialWidth={120} />)
    const handle = screen.getByRole("separator", { name: "Resize Name" })
    handle.focus()

    fireEvent.keyDown(handle, { key: "End" })
    expect(headerWidth()).toBe(240)
    expect(handle).toHaveAttribute("aria-valuenow", "240")

    fireEvent.keyDown(handle, { key: "Home" })
    expect(headerWidth()).toBe(64)
    expect(handle).toHaveAttribute("aria-valuenow", "64")
  })

  it("pointer drag and keyboard both clamp at maxWidth", () => {
    render(<ControlledGrid initialWidth={230} />)
    const handle = screen.getByRole("separator", { name: "Resize Name" })
    handle.focus()

    fireEvent.keyDown(handle, { key: "End" })
    expect(headerWidth()).toBe(240)

    fireEvent.keyDown(handle, { key: "Home" })
    expect(headerWidth()).toBe(64)

    const down = createEvent.pointerDown(handle, { buttons: 1 })
    Object.defineProperty(down, "pointerId", { value: 7 })
    Object.defineProperty(down, "clientX", { value: 0 })
    fireEvent(handle, down)
    act(() => {
      dispatchWindowPointer("pointermove", 7, 500)
    })
    act(() => {
      dispatchWindowPointer("pointerup", 7, 500)
    })
    expect(headerWidth()).toBe(240)
  })

  it("resolves resize labels from the intl provider", () => {
    render(
      <DfIntlProvider
        strings={{
          dataGridResizeColumn: (column) => `Ancho ${column}`,
        }}
      >
        <DataGrid rows={rows} columns={columns} />
      </DfIntlProvider>
    )

    expect(
      screen.getByRole("separator", { name: "Ancho Name" })
    ).toBeInTheDocument()
  })
})

describe("DataGrid a11y smoke", () => {
  it("passes axe for a populated grid", async () => {
    const { container } = render(<DataGrid rows={rows} columns={columns} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
