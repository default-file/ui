import * as React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("lucide-react", () => {
  const Icon = (props: Record<string, unknown>) => <svg {...props} />
  return {
    Check: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
    ChevronUp: Icon,
    Search: Icon,
    X: Icon,
  }
})

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSubContent,
  DropdownMenuSubmenu,
  DropdownMenuTrigger,
} from "./df-dropdown-menu"

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

describe("DropdownMenuSubmenu trigger registration", () => {
  it("registers the submenu trigger node through the provider", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent portal={false}>
          <DropdownMenuSubmenu open>
            <DropdownMenuItem>More</DropdownMenuItem>
            <DropdownMenuSubContent portal={false}>
              <DropdownMenuItem>Nested</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSubmenu>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(screen.getByRole("menuitem", { name: "More" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Nested" })).toBeInTheDocument()
  })
})

describe("DropdownMenuContent presence", () => {
  function PresenceHarness({
    initialOpen = true,
  }: {
    initialOpen?: boolean
  }) {
    const [open, setOpen] = React.useState(initialOpen)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          open
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          close
        </button>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Alpha</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )
  }

  it("stays mounted through exit and unmounts after animation ends", () => {
    render(<PresenceHarness />)

    const content = document.querySelector(
      '[data-df="dropdown-menu-content"]'
    )
    expect(content).toBeInTheDocument()
    expect(content).toHaveAttribute("data-state", "open")

    fireEvent.click(screen.getByRole("button", { name: "close" }))
    const closing = document.querySelector(
      '[data-df="dropdown-menu-content"]'
    )
    expect(closing).toBeInTheDocument()
    expect(closing).toHaveAttribute("data-state", "closed")

    fireEvent.animationEnd(closing!)
    expect(
      document.querySelector('[data-df="dropdown-menu-content"]')
    ).not.toBeInTheDocument()
  })

  it("stays mounted when reopened during exit animation", () => {
    render(<PresenceHarness />)

    fireEvent.click(screen.getByRole("button", { name: "close" }))
    const closing = document.querySelector(
      '[data-df="dropdown-menu-content"]'
    )
    expect(closing).toHaveAttribute("data-state", "closed")

    fireEvent.click(screen.getByRole("button", { name: "open" }))
    const reopened = document.querySelector(
      '[data-df="dropdown-menu-content"]'
    )
    expect(reopened).toBeInTheDocument()
    expect(reopened).toHaveAttribute("data-state", "open")

    fireEvent.animationEnd(reopened!)
    expect(
      document.querySelector('[data-df="dropdown-menu-content"]')
    ).toBeInTheDocument()
    expect(
      document.querySelector('[data-df="dropdown-menu-content"]')
    ).toHaveAttribute("data-state", "open")
  })
})

describe("DropdownMenuContent portal theme", () => {
  it("resolves the dark theme on first open", () => {
    render(
      <div className="dark">
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )

    const portal = document.querySelector('[data-df="dropdown-menu-portal"]')
    expect(portal).toBeInTheDocument()
    expect(portal).toHaveClass("dark")
  })
})

describe("DropdownMenuContent zero-box host", () => {
  it("becomes interactive after a position attempt in a zero-box container", async () => {
    const user = userEvent.setup()
    let selected = false

    render(
      <div style={{ width: 0, height: 0, overflow: "hidden" }}>
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => { selected = true }}>
              Alpha
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )

    const panel = document.querySelector(
      '[data-df="dropdown-menu-content"]'
    ) as HTMLElement
    expect(panel).toBeTruthy()

    await waitFor(() => {
      expect(panel.style.visibility).not.toBe("hidden")
    })

    await user.click(screen.getByRole("menuitem", { name: "Alpha" }))
    expect(selected).toBe(true)
  })
})
