import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { ContentSwitcher, ContentSwitcherItem } from "./df-content-switcher"
import { ToggleGroup, ToggleGroupItem } from "./df-toggle-group"
import { NumberSlider } from "./df-number-slider"
import { Combobox } from "./df-combobox"
import { Label } from "./df-label"

afterEach(() => {
  cleanup()
})

describe("ToggleGroup state model", () => {
  it("uses toggle-button semantics in single-select mode with clearable selection", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const { container } = render(
      <ToggleGroup defaultValue={["a"]} onValueChange={onValueChange}>
        <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
        <ToggleGroupItem value="b">Beta</ToggleGroupItem>
      </ToggleGroup>
    )

    const alpha = screen.getByRole("button", { name: "Alpha" })
    const beta = screen.getByRole("button", { name: "Beta" })
    expect(alpha).toHaveAttribute("aria-pressed", "true")
    expect(alpha).not.toHaveAttribute("aria-checked")
    expect(beta).toHaveAttribute("aria-pressed", "false")
    expect(beta).not.toHaveAttribute("aria-checked")
    expect(await axe(container)).toHaveNoViolations()

    alpha.focus()
    await user.keyboard("{ArrowRight}")
    expect(beta).toHaveFocus()
    expect(alpha).toHaveAttribute("aria-pressed", "true")
    expect(beta).toHaveAttribute("aria-pressed", "false")

    await user.keyboard("{Enter}")
    expect(onValueChange).toHaveBeenCalledWith(["b"])
    expect(beta).toHaveAttribute("aria-pressed", "true")
    expect(alpha).toHaveAttribute("aria-pressed", "false")

    await user.click(beta)
    expect(onValueChange).toHaveBeenCalledWith([])
  })

  it("uses toggle-button semantics in multiple mode without aria-checked", () => {
    render(
      <ToggleGroup multiple defaultValue={["a"]}>
        <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
        <ToggleGroupItem value="b">Beta</ToggleGroupItem>
      </ToggleGroup>
    )

    const alpha = screen.getByRole("button", { name: "Alpha" })
    expect(alpha).toHaveAttribute("aria-pressed", "true")
    expect(alpha).not.toHaveAttribute("aria-checked")
    expect(alpha).not.toHaveAttribute("role", "checkbox")
    expect(alpha).not.toHaveAttribute("role", "radio")
  })
})

describe("ContentSwitcher radiogroup arrows", () => {
  it("moves selection with arrow keys and keeps one tab stop", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <ContentSwitcher defaultValue="a" onValueChange={onValueChange}>
        <ContentSwitcherItem value="a">Alpha</ContentSwitcherItem>
        <ContentSwitcherItem value="b">Beta</ContentSwitcherItem>
        <ContentSwitcherItem value="c">Gamma</ContentSwitcherItem>
      </ContentSwitcher>
    )

    const alpha = screen.getByRole("radio", { name: "Alpha" })
    expect(alpha).toHaveAttribute("tabIndex", "0")
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute(
      "tabIndex",
      "-1"
    )

    alpha.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(onValueChange).toHaveBeenCalledWith("b")
  })
})

describe("NumberSlider label association", () => {
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

describe("Combobox accessible name", () => {
  it("puts the accessible name on the combobox input", async () => {
    const { container } = render(
      <Combobox aria-label="City" options={[{ value: "a", label: "Austin" }]} />
    )

    const combobox = screen.getByRole("combobox", { name: "City" })
    expect(combobox.tagName).toBe("INPUT")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("associates via aria-labelledby when a visible label id is provided", () => {
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

describe("Label catalogue markers", () => {
  it("renders required and optional markers without added punctuation", () => {
    render(
      <DfIntlProvider
        strings={{
          labelRequired: "必須",
          labelOptional: "任意",
          labelAsterisk: "※",
        }}
      >
        <Label required requiredVariant="text">
          Name
        </Label>
        <Label optional optionalVariant="text">
          Nickname
        </Label>
        <Label required requiredVariant="asterisk">
          Age
        </Label>
      </DfIntlProvider>
    )

    expect(document.querySelector("[data-df='label-required']")?.textContent).toBe(
      "必須"
    )
    expect(
      document.querySelector("[data-df='label-optional']")?.textContent
    ).toBe("任意")
    expect(
      document.querySelectorAll("[data-df='label-required']")[1]?.textContent
    ).toBe("※")
  })

  it("resolves a provider override for required text", () => {
    render(
      <DfIntlProvider strings={{ labelRequired: "(pflicht)" }}>
        <Label required requiredVariant="text">
          Titel
        </Label>
      </DfIntlProvider>
    )
    expect(document.querySelector("[data-df='label-required']")?.textContent).toBe(
      "(pflicht)"
    )
  })
})

describe("DatePicker first day of week", () => {
  it("orders weekday headers from the locale week start", async () => {
    const {
      rotateWeekdayLabels,
      weekStartsOnForLocale,
    } = await import("../lib/df-calendar-grid")
    const sundayFirst = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const

    const enStart = weekStartsOnForLocale("en-US")
    const deStart = weekStartsOnForLocale("de-DE")
    const en = rotateWeekdayLabels(sundayFirst, enStart)
    const de = rotateWeekdayLabels(sundayFirst, deStart)

    expect(enStart).toBe(0)
    expect(deStart).toBe(1)
    expect(en[0]).toBe("Su")
    expect(de[0]).toBe("Mo")
    expect(en).not.toEqual(de)
  })
})
