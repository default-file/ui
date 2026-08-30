import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./df-dialog"

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

describe("Dialog contracts", () => {
  it("opens a labelled modal dialog and closes on Escape", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { container } = render(
      <Dialog onOpenChange={onOpenChange}>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>This cannot be undone</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByRole("button", { name: "Open dialog" }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    const dialog = await screen.findByRole("dialog", { name: "Confirm" })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(await axe(container)).toHaveNoViolations()

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("resolves the close label from the string catalogue", async () => {
    render(
      <DfIntlProvider strings={{ dialogClose: "Fermer" }}>
        <Dialog defaultOpen>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </DfIntlProvider>
    )

    expect(await screen.findByRole("button", { name: "Fermer" })).toBeInTheDocument()
  })
})
