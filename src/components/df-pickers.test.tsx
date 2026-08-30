import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { weekStartsOnForLocale } from "../lib/df-calendar-grid"
import { DatePicker } from "./df-date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueBadge,
} from "./df-select"

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

describe("DatePicker contracts", () => {
  it("names the trigger and opens a calendar grid", async () => {
    const user = userEvent.setup()
    const { container } = render(<DatePicker aria-label="Start date" />)

    const trigger = screen.getByRole("combobox", { name: "Start date" })
    await user.click(trigger)
    expect(await screen.findByRole("grid")).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("resolves navigation labels from a provider override", async () => {
    render(
      <DfIntlProvider
        strings={{
          datePickerPreviousMonth: "Vorheriger Monat",
          datePickerNextMonth: "Naechster Monat",
          datePickerToday: "Heute",
        }}
      >
        <DatePicker defaultOpen locale="de-DE" />
      </DfIntlProvider>
    )

    expect(
      await screen.findByRole("button", { name: "Vorheriger Monat" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Naechster Monat" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Heute" })).toBeInTheDocument()
    expect(weekStartsOnForLocale("de-DE")).toBe(1)
  })
})

describe("Select contracts", () => {
  it("opens options and commits a selection", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const { container } = render(
      <Select defaultValue="todo" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Status">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todo">Todo</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByRole("combobox", { name: "Status" })
    expect(trigger).toHaveTextContent("Todo")
    expect(await axe(container)).toHaveNoViolations()

    await user.click(trigger)
    await user.click(await screen.findByRole("option", { name: "Done" }))
    expect(onValueChange).toHaveBeenCalledWith("done")
  })

  it("resolves badge remove labels from the catalogue", () => {
    render(
      <DfIntlProvider strings={{ selectRemove: "Entfernen" }}>
        <Select
          selectionMode="multiple"
          defaultValues={["a"]}
          onValuesChange={() => {}}
        >
          <SelectTrigger aria-label="Tags">
            <SelectValue placeholder="Choose">
              {(ctx) =>
                ctx.values.map((value) => (
                  <SelectValueBadge key={value} value={value} />
                ))
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="b">Beta</SelectItem>
          </SelectContent>
        </Select>
      </DfIntlProvider>
    )

    expect(
      screen.getByRole("button", { name: "Entfernen" })
    ).toBeInTheDocument()
  })
})
