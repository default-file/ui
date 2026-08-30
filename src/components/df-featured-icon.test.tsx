import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { FeaturedIcon } from "./df-featured-icon"

afterEach(() => {
  cleanup()
})

describe("FeaturedIcon contracts", () => {
  it("renders, forwards className and ref, and passes axe", async () => {
    const ref = React.createRef<HTMLDivElement>()
    const { container } = render(
      <FeaturedIcon ref={ref} className="icon-host">
        <span>*</span>
      </FeaturedIcon>
    )

    const root = container.querySelector('[data-df="featured-icon"]')
    expect(root).toHaveClass("icon-host")
    expect(ref.current).toBe(root)
    expect(root).toHaveAttribute("data-variant", "soft")
    expect(await axe(container)).toHaveNoViolations()
  })
})
