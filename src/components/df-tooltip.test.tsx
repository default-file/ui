import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Tooltip, TooltipContent, TooltipTrigger } from "./df-tooltip"

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

describe("TooltipContent presence", () => {
  function PresenceHarness() {
    const [open, setOpen] = React.useState(true)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          open
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          close
        </button>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger>Hint</TooltipTrigger>
          <TooltipContent>Details</TooltipContent>
        </Tooltip>
      </>
    )
  }

  it("stays mounted through exit and unmounts after animation ends", () => {
    render(<PresenceHarness />)

    const content = document.querySelector('[data-df="tooltip-content"]')
    expect(content).toBeInTheDocument()
    expect(content).toHaveAttribute("data-state", "open")

    fireEvent.click(screen.getByRole("button", { name: "close" }))
    const closing = document.querySelector('[data-df="tooltip-content"]')
    expect(closing).toBeInTheDocument()
    expect(closing).toHaveAttribute("data-state", "closed")

    fireEvent.animationEnd(closing!)
    expect(
      document.querySelector('[data-df="tooltip-content"]')
    ).not.toBeInTheDocument()
  })

  it("stays mounted when reopened during exit animation", () => {
    render(<PresenceHarness />)

    fireEvent.click(screen.getByRole("button", { name: "close" }))
    expect(
      document.querySelector('[data-df="tooltip-content"]')
    ).toHaveAttribute("data-state", "closed")

    fireEvent.click(screen.getByRole("button", { name: "open" }))
    const reopened = document.querySelector('[data-df="tooltip-content"]')
    expect(reopened).toBeInTheDocument()
    expect(reopened).toHaveAttribute("data-state", "open")

    fireEvent.animationEnd(reopened!)
    expect(
      document.querySelector('[data-df="tooltip-content"]')
    ).toBeInTheDocument()
  })
})

describe("TooltipContent zero-box host", () => {
  it("becomes visible after a position attempt in a zero-box container", async () => {
    render(
      <div style={{ width: 0, height: 0, overflow: "hidden" }}>
        <Tooltip open>
          <TooltipTrigger>Hint</TooltipTrigger>
          <TooltipContent>Details</TooltipContent>
        </Tooltip>
      </div>
    )

    const content = document.querySelector(
      '[data-df="tooltip-content"]'
    ) as HTMLElement
    expect(content).toBeTruthy()

    await waitFor(() => {
      expect(content.style.visibility).not.toBe("hidden")
    })
    expect(
      screen.getByRole("tooltip", { name: "Details" })
    ).toBeInTheDocument()
  })
})
