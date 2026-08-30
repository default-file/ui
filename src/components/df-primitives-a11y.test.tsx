import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { Label } from "./df-label"
import { Separator } from "./df-separator"
import { Skeleton } from "./df-skeleton"
import { Spinner } from "./df-spinner"
import { StatusDot } from "./df-status-dot"
import { FeaturedIcon } from "./df-featured-icon"
import { Kbd } from "./df-kbd"
import { PanelSection } from "./df-panel-section"

afterEach(() => {
  cleanup()
})

describe("Separator contracts", () => {
  it("is presentational by default and semantic when decorative is false", async () => {
    const { container, rerender } = render(<Separator />)
    expect(container.querySelector('[data-df="separator"]')).toHaveAttribute(
      "role",
      "none"
    )
    expect(await axe(container)).toHaveNoViolations()

    rerender(<Separator decorative={false} orientation="vertical" />)
    const separator = screen.getByRole("separator")
    expect(separator).toHaveAttribute("aria-orientation", "vertical")
  })
})

describe("Spinner contracts", () => {
  it("announces loading status from the catalogue by default", async () => {
    const { container } = render(<Spinner />)
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("resolves the loading label from a provider override", () => {
    render(
      <DfIntlProvider strings={{ spinnerLoading: "Laden" }}>
        <Spinner />
      </DfIntlProvider>
    )
    expect(screen.getByRole("status", { name: "Laden" })).toBeInTheDocument()
  })

  it("becomes presentational when aria-hidden is set", () => {
    render(<Spinner aria-hidden />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})

describe("Skeleton and StatusDot contracts", () => {
  it("keeps placeholders presentational", async () => {
    const { container } = render(
      <>
        <Skeleton />
        <StatusDot />
      </>
    )
    expect(container.querySelector('[data-df="skeleton"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    )
    expect(container.querySelector('[data-df="status-dot"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("Label contracts", () => {
  it("associates with a control through htmlFor", () => {
    render(
      <>
        <Label htmlFor="email-field">Email</Label>
        <input id="email-field" />
      </>
    )
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email-field")
  })

  it("renders required markers from the catalogue without added punctuation", () => {
    render(
      <DfIntlProvider strings={{ labelRequired: "必須", labelAsterisk: "※" }}>
        <Label required requiredVariant="text">
          Name
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
      document.querySelectorAll("[data-df='label-required']")[1]?.textContent
    ).toBe("※")
  })
})

describe("Kbd contracts", () => {
  it("names a string chord for assistive tech", () => {
    render(<Kbd>⌘S</Kbd>)
    expect(document.querySelector("[data-df='kbd']")).toHaveAttribute(
      "aria-label"
    )
  })

  it("resolves a modifier title from a provider override", () => {
    render(
      <DfIntlProvider strings={{ kbdCommand: "Befehl" }}>
        <Kbd>⌘</Kbd>
      </DfIntlProvider>
    )
    expect(screen.getByTitle("Befehl")).toBeInTheDocument()
  })
})

describe("FeaturedIcon contracts", () => {
  it("keeps decorative chrome presentational by default", async () => {
    const { container } = render(
      <FeaturedIcon>
        <span aria-hidden>+</span>
      </FeaturedIcon>
    )
    expect(container.querySelector('[data-df="featured-icon"]')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("PanelSection contracts", () => {
  it("exposes a section with visible title text", () => {
    render(
      <PanelSection title="Appearance">
        <button type="button">Theme</button>
      </PanelSection>
    )
    expect(screen.getByText("Appearance")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument()
  })
})
