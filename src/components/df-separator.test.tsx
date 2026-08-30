import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { Separator } from "./df-separator"

afterEach(() => {
  cleanup()
})

describe("Separator contracts", () => {
  it("renders decorative chrome by default and forwards className", async () => {
    const { container } = render(<Separator className="rule-host" />)

    const root = container.querySelector('[data-df="separator"]')
    expect(root).toHaveClass("rule-host")
    expect(root).toHaveAttribute("role", "none")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("exposes separator semantics when not decorative", () => {
    const { container } = render(
      <Separator decorative={false} orientation="vertical" />
    )
    const root = container.querySelector('[data-df="separator"]')
    expect(root).toHaveAttribute("role", "separator")
    expect(root).toHaveAttribute("aria-orientation", "vertical")
  })
})
