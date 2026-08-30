import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Timeline } from "./df-timeline"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
  // Virtualized rows need a non-zero scrollport in jsdom.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 400,
    right: 800,
    width: 800,
    height: 400,
    toJSON: () => ({}),
  })
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return 400
    },
  })
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return 800
    },
  })
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return 400
    },
  })
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return 800
    },
  })
})

const sampleRows = [
  {
    id: "a",
    label: "Design",
    start: "2026-01-01",
    due: "2026-01-10",
  },
]

describe("Timeline contracts", () => {
  it("renders a named treegrid and forwards className", () => {
    render(
      <Timeline
        className="timeline-host"
        rows={sampleRows}
        visibleRange={{ start: "2026-01-01", end: "2026-01-31" }}
        aria-label="Sprint plan"
      />
    )

    const grid = screen.getByRole("treegrid", { name: "Sprint plan" })
    expect(grid).toHaveClass("timeline-host")
    expect(screen.getByText("Design")).toBeInTheDocument()
  })

  it("exposes bar cells with accessible names", () => {
    render(
      <Timeline
        rows={sampleRows}
        visibleRange={{ start: "2026-01-01", end: "2026-01-31" }}
      />
    )

    expect(
      screen.getByRole("gridcell", { name: /Design/ })
    ).toBeInTheDocument()
  })
})
