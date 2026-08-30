import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { Button } from "./df-button"

afterEach(() => {
  cleanup()
})

describe("Button contracts", () => {
  it("renders a named button and runs the consumer click handler", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { container } = render(<Button onClick={onClick}>Save</Button>)

    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("disables interaction while loading and keeps an accessible name", () => {
    render(
      <Button loading aria-label="Saving">
        Save
      </Button>
    )
    const control = screen.getByRole("button", { name: "Saving" })
    expect(control).toBeDisabled()
  })

  it("requires an accessible name for plain icon buttons", () => {
    render(
      <Button variant="plain" size="icon" aria-label="More">
        ···
      </Button>
    )
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument()
  })
})
