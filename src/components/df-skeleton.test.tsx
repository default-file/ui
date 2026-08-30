import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { Skeleton } from "./df-skeleton"

afterEach(() => {
  cleanup()
})

describe("Skeleton contracts", () => {
  it("renders presentational chrome, forwards className, and passes axe", async () => {
    const { container } = render(
      <Skeleton className="pulse-host" shape="block" />
    )

    const root = container.querySelector('[data-df="skeleton"]')
    expect(root).toHaveClass("pulse-host")
    expect(root).toHaveAttribute("aria-hidden", "true")
    expect(root).toHaveAttribute("data-shape", "block")
    expect(await axe(container)).toHaveNoViolations()
  })
})
