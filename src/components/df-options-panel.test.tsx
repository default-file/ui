import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import {
  OptionsPanel,
  OptionsPanelBody,
  OptionsPanelContent,
  OptionsPanelHeader,
  OptionsPanelTitle,
  OptionsPanelTrigger,
} from "./df-options-panel"

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

describe("OptionsPanel contracts", () => {
  it("opens a named panel from the trigger and forwards content className", async () => {
    const { container } = render(
      <OptionsPanel open>
        <OptionsPanelTrigger>Filters</OptionsPanelTrigger>
        <OptionsPanelContent portal={false} className="panel-host">
          <OptionsPanelHeader>
            <OptionsPanelTitle>Sort</OptionsPanelTitle>
          </OptionsPanelHeader>
          <OptionsPanelBody>Body</OptionsPanelBody>
        </OptionsPanelContent>
      </OptionsPanel>
    )

    const trigger = screen.getByRole("button", { name: "Filters" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    const panel = document.querySelector('[data-df="options-panel-content"]')
    expect(panel).toHaveClass("panel-host")
    expect(screen.getByText("Sort")).toBeInTheDocument()
    const body = document.querySelector('[data-df="options-panel-body"]')
    const scroll = body?.querySelector('[data-df="scroll-area"]')
    expect(scroll).toHaveAttribute("data-orientation", "vertical")
    expect(await axe(container)).toHaveNoViolations()
  })
})
