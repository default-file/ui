import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { EmptyState } from "./df-empty-state"

afterEach(() => {
  cleanup()
})

describe("EmptyState announcement", () => {
  it("does not announce by default", () => {
    render(<EmptyState title="No results" />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("announces when announce is true", () => {
    render(<EmptyState announce title="No matches" description="Try another query." />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("No matches")
    expect(status).toHaveTextContent("Try another query.")
  })

  it("passes axe when announcing", async () => {
    const { container } = render(
      <EmptyState announce title="Empty" description="Nothing here." />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
