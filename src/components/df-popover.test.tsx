import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { DfIntlProvider } from "../lib/df-intl"
import { Popover, PopoverContent, PopoverTrigger } from "./df-popover"

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

describe("PopoverContent portal theme", () => {
  it("resolves the dark theme on first open", async () => {
    render(
      <div className="dark">
        <Popover open>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Panel</PopoverContent>
        </Popover>
      </div>
    )

    const trigger = screen.getByRole("button", { name: "Open" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).not.toHaveAttribute("aria-haspopup")

    const controls = trigger.getAttribute("aria-controls")
    expect(controls).toBeTruthy()

    await waitFor(() => {
      const panel = document.getElementById(controls!)
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveAttribute("data-df", "popover-content")
      expect(panel).not.toHaveAttribute("role", "dialog")
    })

    const portal = document.querySelector('[data-df="popover-portal"]')
    expect(portal).toHaveClass("dark")
  })
})

describe("Popover disclosure semantics", () => {
  it("exposes expanded state and controls without claiming a popup kind", () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent portal={false}>Panel</PopoverContent>
      </Popover>
    )

    const trigger = screen.getByRole("button", { name: "Open" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).not.toHaveAttribute("aria-haspopup")
    const controls = trigger.getAttribute("aria-controls")
    expect(controls).toBeTruthy()
    expect(document.getElementById(controls!)).toHaveAttribute(
      "data-df",
      "popover-content"
    )
  })
})

describe("Popover awaiting position", () => {
  it("suppresses hit testing on the first paint before the position attempt", () => {
    const pointerEventsOnAttach: string[] = []

    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <span
            ref={(node) => {
              const panel = node?.closest(
                '[data-df="popover-content"]'
              ) as HTMLElement | null
              if (panel) {
                pointerEventsOnAttach.push(panel.style.pointerEvents)
              }
            }}
          />
          Panel
        </PopoverContent>
      </Popover>
    )

    expect(pointerEventsOnAttach[0]).toBe("none")
  })

  it("becomes interactive after a position attempt in a zero-box container", async () => {
    const user = userEvent.setup()
    let clicked = false

    render(
      <div style={{ width: 0, height: 0, overflow: "hidden" }}>
        <Popover open>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>
            <button type="button" onClick={() => { clicked = true }}>
              Inside
            </button>
          </PopoverContent>
        </Popover>
      </div>
    )

    const panel = document.querySelector(
      '[data-df="popover-content"]'
    ) as HTMLElement
    expect(panel).toBeTruthy()

    await waitFor(() => {
      expect(panel.style.pointerEvents).not.toBe("none")
      expect(panel.style.opacity).not.toBe("0")
    })

    await user.click(screen.getByRole("button", { name: "Inside" }))
    expect(clicked).toBe(true)
  })

  it("unmounts when closed", () => {
    const { rerender } = render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Panel</PopoverContent>
      </Popover>
    )

    expect(
      document.querySelector('[data-df="popover-content"]')
    ).toBeInTheDocument()

    rerender(
      <Popover open={false}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Panel</PopoverContent>
      </Popover>
    )

    expect(
      document.querySelector('[data-df="popover-content"]')
    ).not.toBeInTheDocument()
  })
})

describe("Popover non-modal focus restore", () => {
  it("restores focus to the trigger when the panel closes", async () => {
    function Harness() {
      const [open, setOpen] = React.useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            close
          </button>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger>Open</PopoverTrigger>
            <PopoverContent portal={false}>
              <button type="button">Inside</button>
            </PopoverContent>
          </Popover>
        </>
      )
    }

    render(<Harness />)

    const trigger = screen.getByRole("button", { name: "Open" })
    screen.getByRole("button", { name: "Inside" }).focus()
    fireEvent.click(screen.getByRole("button", { name: "close" }))

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
    })
  })
})

describe("Popover intl", () => {
  it("keeps non-modal semantics under a provider", () => {
    render(
      <DfIntlProvider strings={{ dialogClose: "Schliessen" }}>
        <Popover open>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent portal={false}>Panel</PopoverContent>
        </Popover>
      </DfIntlProvider>
    )

    expect(screen.getByRole("button", { name: "Open" })).not.toHaveAttribute(
      "aria-haspopup"
    )
    expect(
      document.querySelector('[data-df="popover-content"]')
    ).not.toHaveAttribute("role", "dialog")
  })
})
