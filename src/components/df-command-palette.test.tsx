import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { CommandPalette } from "./df-command-palette"

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

describe("CommandPalette contracts", () => {
  it("opens a dialog, lists commands, and runs the selected command", async () => {
    const user = userEvent.setup()
    const run = vi.fn()
    const { container } = render(
      <CommandPalette
        defaultOpen
        commands={[
          { id: "save", label: "Save file", run },
          { id: "open", label: "Open file", run: () => {} },
        ]}
      />
    )

    expect(
      await screen.findByRole("dialog", { name: "Command palette" })
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole("option", { name: "Save file" }))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("resolves the dialog name from a provider override", async () => {
    render(
      <DfIntlProvider strings={{ commandPaletteAriaLabel: "Befehlspalette" }}>
        <CommandPalette
          defaultOpen
          commands={[{ id: "a", label: "Alpha", run: () => {} }]}
        />
      </DfIntlProvider>
    )

    expect(
      await screen.findByRole("dialog", { name: "Befehlspalette" })
    ).toBeInTheDocument()
  })

  it("resolves footer verbs from a provider override", async () => {
    render(
      <DfIntlProvider
        strings={{
          commandPaletteNavigate: "navigieren",
          commandPaletteRun: "ausfuehren",
          commandPaletteClose: "schliessen",
        }}
      >
        <CommandPalette
          defaultOpen
          commands={[{ id: "a", label: "Alpha", run: () => {} }]}
        />
      </DfIntlProvider>
    )

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("navigieren")).toBeInTheDocument()
    expect(screen.getByText("ausfuehren")).toBeInTheDocument()
    expect(screen.getByText("schliessen")).toBeInTheDocument()
    expect(screen.queryByText(/navigate/i)).not.toBeInTheDocument()
  })

  it("filters commands from the search field", async () => {
    const user = userEvent.setup()
    render(
      <CommandPalette
        defaultOpen
        commands={[
          { id: "save", label: "Save file", run: () => {} },
          { id: "open", label: "Open file", run: () => {} },
        ]}
      />
    )

    const search = await screen.findByRole("combobox")
    await user.clear(search)
    await user.type(search, "Save")
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Save file" })).toBeInTheDocument()
      expect(
        screen.queryByRole("option", { name: "Open file" })
      ).not.toBeInTheDocument()
    })
  })
})
