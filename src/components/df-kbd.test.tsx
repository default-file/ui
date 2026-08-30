import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { Kbd } from "./df-kbd"

afterEach(() => {
  cleanup()
})

describe("Kbd contracts", () => {
  it("renders, forwards className and ref, and exposes an accessible name", () => {
    const ref = React.createRef<HTMLElement>()
    const { container } = render(<Kbd ref={ref} className="kbd-host">⌘K</Kbd>)

    const root = container.querySelector('[data-df="kbd"]')
    expect(root).toHaveClass("kbd-host")
    expect(ref.current).toBe(root)
    expect(screen.getByLabelText("Command K")).toBeInTheDocument()
  })

  it("passes axe for composed children without a host aria-label", async () => {
    const { container } = render(
      <Kbd>
        <span>Esc</span>
      </Kbd>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("resolves glyph titles from the intl provider", () => {
    render(
      <DfIntlProvider strings={{ kbdCommand: "Befehl" }}>
        <Kbd>⌘</Kbd>
      </DfIntlProvider>
    )
    expect(screen.getByLabelText("Befehl")).toBeInTheDocument()
  })
})
