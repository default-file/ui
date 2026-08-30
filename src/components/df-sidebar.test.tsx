import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./df-sidebar"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    }),
  })
})

describe("Sidebar contracts", () => {
  it("renders provider chrome, forwards className, and names the trigger", async () => {
    const { container } = render(
      <SidebarProvider className="shell-host" keyboardShortcut={false}>
        <Sidebar className="sidebar-host" collapsible="none">
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Home</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    expect(container.querySelector('[data-df="sidebar"]')).toHaveClass(
      "sidebar-host"
    )
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Sidebar/i })
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("toggles open state from the trigger", async () => {
    const user = userEvent.setup()
    render(
      <SidebarProvider defaultOpen keyboardShortcut={false}>
        <Sidebar collapsible="icon">
          <SidebarContent>Nav</SidebarContent>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    const trigger = screen.getByRole("button", { name: /Sidebar/i })
    expect(document.querySelector('[data-df="sidebar"]')).toHaveAttribute(
      "data-state",
      "expanded"
    )
    await user.click(trigger)
    expect(document.querySelector('[data-df="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed"
    )
  })
})
