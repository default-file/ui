import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { PanelSection } from "./df-panel-section"

afterEach(() => {
  cleanup()
})

describe("PanelSection contracts", () => {
  it("renders the title, forwards className, and passes axe", async () => {
    const { container } = render(
      <PanelSection title="Appearance" className="section-host">
        <button type="button">Theme</button>
      </PanelSection>
    )

    const root = container.querySelector('[data-df="panel-section"]')
    expect(root).toHaveClass("section-host")
    expect(screen.getByText("Appearance")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
