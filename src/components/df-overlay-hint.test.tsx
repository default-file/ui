import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { OverlayHint } from "./df-overlay-hint"

afterEach(() => {
  cleanup()
})

describe("OverlayHint contracts", () => {
  it("renders label content, forwards className, and passes axe", async () => {
    const { container } = render(
      <OverlayHint className="hint-host">Press Esc to close</OverlayHint>
    )

    const root = container.querySelector('[data-df="overlay-hint"]')
    expect(root).toHaveClass("hint-host")
    expect(screen.getByText("Press Esc to close")).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("exposes a named chip action on marquee clickTarget chip", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <OverlayHint
        variant="marquee"
        clickTarget="chip"
        actionLabel="Open gallery"
        onAction={onAction}
      >
        New look
      </OverlayHint>
    )

    const chip = screen.getByRole("button", { name: "Open gallery" })
    await user.click(chip)
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
