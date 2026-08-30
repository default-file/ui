import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { StatusDot } from "./df-status-dot"

afterEach(() => {
  cleanup()
})

describe("StatusDot contracts", () => {
  it("renders presentational chrome, forwards className, and passes axe", async () => {
    const { container } = render(
      <StatusDot className="dot-host" size="md" />
    )

    const root = container.querySelector('[data-df="status-dot"]')
    expect(root).toHaveClass("dot-host")
    expect(root).toHaveAttribute("aria-hidden", "true")
    expect(root).toHaveAttribute("data-size", "md")
    expect(await axe(container)).toHaveNoViolations()
  })
})
