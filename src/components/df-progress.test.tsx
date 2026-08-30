import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { Progress } from "./df-progress"

afterEach(() => {
  cleanup()
})

describe("Progress accessibility", () => {
  it("sets aria-valuetext and aria-busy when indeterminate", () => {
    render(<Progress />)
    const bar = screen.getByRole("progressbar", { name: "Progress" })
    expect(bar).toHaveAttribute("aria-valuetext", "In progress")
    expect(bar).toHaveAttribute("aria-busy", "true")
    expect(bar).not.toHaveAttribute("aria-valuenow")
  })

  it("exposes numeric values when determinate", () => {
    render(<Progress value={42} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "42")
    expect(bar).not.toHaveAttribute("aria-valuetext")
    expect(bar).not.toHaveAttribute("aria-busy")
  })

  it("resolves the label from the intl provider", () => {
    render(
      <DfIntlProvider strings={{ progressAriaLabel: "Avance" }}>
        <Progress value={10} />
      </DfIntlProvider>
    )
    expect(screen.getByRole("progressbar", { name: "Avance" })).toBeInTheDocument()
  })

  it("passes axe for indeterminate progress", async () => {
    const { container } = render(<Progress />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
