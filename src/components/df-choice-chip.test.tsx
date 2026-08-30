import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ChoiceChip } from "./df-choice-chip"

afterEach(() => {
  cleanup()
})

describe("ChoiceChip contracts", () => {
  it("announces pressed state when selected is provided", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { container, rerender } = render(
      <ChoiceChip selected={false} onClick={onClick}>
        Design
      </ChoiceChip>
    )

    const chip = screen.getByRole("button", { name: "Design" })
    expect(chip).toHaveAttribute("aria-pressed", "false")
    expect(await axe(container)).toHaveNoViolations()

    await user.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <ChoiceChip selected onClick={onClick}>
        Design
      </ChoiceChip>
    )
    expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })
})
