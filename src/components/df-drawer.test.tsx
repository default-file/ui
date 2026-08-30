import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./df-drawer"

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

describe("Drawer contracts", () => {
  it("opens a labelled modal dialog from the trigger", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { container } = render(
      <Drawer onOpenChange={onOpenChange}>
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Settings</DrawerTitle>
            <DrawerDescription>Adjust preferences</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    )

    const trigger = screen.getByRole("button", { name: "Open drawer" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog")

    await user.click(trigger)
    expect(onOpenChange).toHaveBeenCalledWith(true)

    const dialog = await screen.findByRole("dialog", { name: "Settings" })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-describedby")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("closes on Escape and restores the trigger expanded state", async () => {
    const user = userEvent.setup()
    render(
      <Drawer defaultOpen>
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Panel</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    )

    expect(await screen.findByRole("dialog", { name: "Panel" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Open drawer" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("resolves the close control label from the string catalogue", async () => {
    render(
      <DfIntlProvider strings={{ drawerClose: "Schliessen" }}>
        <Drawer defaultOpen>
          <DrawerTrigger>Open</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Panel</DrawerTitle>
            </DrawerHeader>
          </DrawerContent>
        </Drawer>
      </DfIntlProvider>
    )

    expect(
      await screen.findByRole("button", { name: "Schliessen" })
    ).toBeInTheDocument()
  })

  it("composes a consumer onClick on the trigger and still opens", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Drawer>
        <DrawerTrigger onClick={onClick}>Open</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Panel</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    )

    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("dialog", { name: "Panel" })).toBeInTheDocument()
  })
})
