import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WidgetGrid } from "./df-widget-grid"

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

const layout = [{ id: "w1", x: 0, y: 0, w: 2, h: 1 }]

describe("WidgetGrid contracts", () => {
  it("renders a named grid and forwards className", () => {
    render(
      <WidgetGrid
        className="grid-host"
        layout={layout}
        editable={false}
        aria-label="Dashboard"
        renderWidget={(id) => <span>{id}</span>}
      />
    )

    const grid = screen.getByRole("grid", { name: "Dashboard" })
    expect(grid).toHaveClass("grid-host")
    expect(screen.getByText("w1")).toBeInTheDocument()
  })

  it("announces empty content through a status region", () => {
    render(
      <WidgetGrid
        layout={[]}
        editable={false}
        emptyContent="No widgets"
        renderWidget={() => null}
      />
    )

    expect(screen.getByRole("grid", { name: "Widget grid" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("No widgets")
  })

  it("exposes keyboard edit handles when editable", () => {
    render(
      <WidgetGrid
        layout={layout}
        editable
        renderWidget={(id) => <span>{id}</span>}
      />
    )

    expect(
      screen.getByRole("button", { name: /move or resize/i })
    ).toBeInTheDocument()
  })
})
