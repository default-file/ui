import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { NavRail, NavRailItem } from "./df-nav-rail"

afterEach(() => {
  cleanup()
})

describe("NavRailItem current page", () => {
  it("uses aria-current on the active non-asChild item", () => {
    render(
      <NavRail>
        <NavRailItem active icon={<span>H</span>}>
          Home
        </NavRailItem>
        <NavRailItem icon={<span>S</span>}>Settings</NavRailItem>
      </NavRail>
    )

    expect(screen.getByRole("button", { name: /Home/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("button", { name: /Home/ })).not.toHaveAttribute(
      "aria-pressed"
    )
    expect(
      screen.getByRole("button", { name: /Settings/ })
    ).not.toHaveAttribute("aria-current")
  })
})
