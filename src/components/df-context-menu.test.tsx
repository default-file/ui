import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

vi.mock("lucide-react", () => {
  const Icon = (props: Record<string, unknown>) => <svg {...props} />
  return {
    ChevronRight: Icon,
  }
})

import { ContextMenu } from "./df-context-menu"

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

async function openMenu(label = "Target") {
  fireEvent.contextMenu(screen.getByRole("button", { name: label }))
  return screen.findByRole("menu")
}

describe("ContextMenu contracts", () => {
  it("opens a menu of menuitems from the trigger and runs onSelect", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()
    const { container } = render(
      <ContextMenu
        items={[
          { id: "copy", label: "Copy" },
          { id: "paste", label: "Paste" },
        ]}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      >
        <button type="button">Target</button>
      </ContextMenu>
    )

    await openMenu()
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Paste" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole("menuitem", { name: "Copy" }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "copy", label: "Copy" })
    )
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    })
  })

  it("closes on Escape and reports onOpenChange", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <ContextMenu
        items={[{ id: "cut", label: "Cut" }]}
        onOpenChange={onOpenChange}
      >
        <button type="button">Target</button>
      </ContextMenu>
    )

    const menu = await openMenu()
    menu.focus()
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("activates the highlighted item with Enter", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ContextMenu
        items={[
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
        ]}
        onSelect={onSelect}
      >
        <button type="button">Target</button>
      </ContextMenu>
    )

    const menu = await openMenu()
    menu.focus()
    await user.keyboard("{ArrowDown}{Enter}")
    expect(onSelect).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    })
  })

  it("composes a consumer onContextMenu on the trigger", async () => {
    const onContextMenu = vi.fn()
    render(
      <ContextMenu items={[{ id: "copy", label: "Copy" }]}>
        <button type="button" onContextMenu={onContextMenu}>
          Target
        </button>
      </ContextMenu>
    )

    fireEvent.contextMenu(screen.getByRole("button", { name: "Target" }))
    expect(onContextMenu).toHaveBeenCalled()
    expect(await screen.findByRole("menu")).toBeInTheDocument()
  })
})

describe("ContextMenu zero-box host", () => {
  it("becomes interactive after a position attempt in a zero-box container", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <div style={{ width: 0, height: 0, overflow: "hidden" }}>
        <ContextMenu
          items={[{ id: "copy", label: "Copy" }]}
          onSelect={onSelect}
        >
          <button type="button">Target</button>
        </ContextMenu>
      </div>
    )

    fireEvent.contextMenu(screen.getByRole("button", { name: "Target" }))

    const panel = await waitFor(() => {
      const node = document.querySelector(
        '[data-df="context-menu-content"]'
      ) as HTMLElement | null
      expect(node).toBeTruthy()
      return node!
    })

    await waitFor(() => {
      expect(panel.style.visibility).not.toBe("hidden")
    })

    await user.click(screen.getByRole("menuitem", { name: "Copy" }))
    expect(onSelect).toHaveBeenCalled()
  })
})
