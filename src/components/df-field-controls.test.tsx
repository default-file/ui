import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { Input } from "./df-input"
import { SearchInput } from "./df-search-input"
import { NumberSlider } from "./df-number-slider"

afterEach(() => {
  cleanup()
})

describe("Input contracts", () => {
  it("associates an outside label with the textbox", async () => {
    const { container } = render(
      <Input id="name" label="Name" defaultValue="" />
    )
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("resolves the clear control from the catalogue", async () => {
    const user = userEvent.setup()
    render(
      <DfIntlProvider strings={{ inputClear: "Leeren" }}>
        <Input id="title" label="Title" defaultValue="Draft" clearable />
      </DfIntlProvider>
    )
    expect(screen.getByRole("button", { name: "Leeren" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Leeren" }))
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("")
  })
})

describe("SearchInput contracts", () => {
  it("clears the value and names the clear control from the catalogue", async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <DfIntlProvider strings={{ searchInputClear: "Suche leeren" }}>
        <SearchInput
          aria-label="Search"
          defaultValue="query"
          onClear={onClear}
        />
      </DfIntlProvider>
    )

    await user.click(screen.getByRole("button", { name: "Suche leeren" }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("")
  })
})

describe("NumberSlider contracts", () => {
  it("names the slider from the visible label", async () => {
    const { container } = render(
      <NumberSlider
        label="Opacity"
        value={0.5}
        min={0}
        max={1}
        onChange={() => {}}
      />
    )
    const slider = screen.getByRole("slider")
    const label = container.querySelector("[data-df='label']")
    expect(label).toHaveAttribute("id")
    expect(slider).toHaveAttribute(
      "aria-labelledby",
      label?.getAttribute("id")
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
