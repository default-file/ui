import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { Combobox } from "./df-combobox"

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

describe("Combobox contracts", () => {
  it("names the combobox input and selects an option", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const { container } = render(
      <Combobox
        aria-label="City"
        options={[
          { value: "austin", label: "Austin" },
          { value: "berlin", label: "Berlin" },
        ]}
        onValueChange={onValueChange}
      />
    )

    const combobox = screen.getByRole("combobox", { name: "City" })
    expect(combobox.tagName).toBe("INPUT")
    expect(await axe(container)).toHaveNoViolations()

    await user.click(combobox)
    await user.click(await screen.findByRole("option", { name: "Berlin" }))
    expect(onValueChange).toHaveBeenCalledWith("berlin")
    expect(combobox).toHaveValue("Berlin")
  })

  it("resolves the empty state from a provider override", async () => {
    const user = userEvent.setup()
    render(
      <DfIntlProvider strings={{ comboboxEmpty: "Keine Treffer" }}>
        <Combobox
          aria-label="City"
          options={[{ value: "austin", label: "Austin" }]}
        />
      </DfIntlProvider>
    )

    const combobox = screen.getByRole("combobox", { name: "City" })
    await user.click(combobox)
    await user.type(combobox, "zzz")
    expect(await screen.findByText("Keine Treffer")).toBeInTheDocument()
  })

  it("associates an external label via aria-labelledby", () => {
    render(
      <>
        <span id="city-label">City</span>
        <Combobox
          aria-labelledby="city-label"
          options={[{ value: "a", label: "Austin" }]}
        />
      </>
    )
    expect(screen.getByRole("combobox", { name: "City" })).toHaveAttribute(
      "aria-labelledby",
      "city-label"
    )
  })
})
