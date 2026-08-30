import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { Badge } from "./df-badge"

describe("Badge smoke", () => {
  it("renders and passes axe", async () => {
    const { container } = render(<Badge>Status</Badge>)
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
