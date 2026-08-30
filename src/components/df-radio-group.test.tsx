import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { RadioGroup, RadioItem } from "./df-radio-group"

afterEach(() => {
  cleanup()
})

describe("RadioGroup contracts", () => {
  it("exposes a labelled radiogroup and moves selection with click", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const { container } = render(
      <RadioGroup
        label="Plan"
        defaultValue="free"
        onValueChange={onValueChange}
      >
        <RadioItem value="free" label="Free" />
        <RadioItem value="pro" label="Pro" />
      </RadioGroup>
    )

    const group = screen.getByRole("radiogroup", { name: "Plan" })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Free" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Pro" })).not.toBeChecked()
    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole("radio", { name: "Pro" }))
    expect(onValueChange).toHaveBeenCalledWith("pro")
    expect(screen.getByRole("radio", { name: "Pro" })).toBeChecked()
  })

  it("supports controlled value updates from the consumer", () => {
    const { rerender } = render(
      <RadioGroup label="Size" value="sm" onValueChange={() => {}}>
        <RadioItem value="sm" label="Small" />
        <RadioItem value="lg" label="Large" />
      </RadioGroup>
    )
    expect(screen.getByRole("radio", { name: "Small" })).toBeChecked()

    rerender(
      <RadioGroup label="Size" value="lg" onValueChange={() => {}}>
        <RadioItem value="sm" label="Small" />
        <RadioItem value="lg" label="Large" />
      </RadioGroup>
    )
    expect(screen.getByRole("radio", { name: "Large" })).toBeChecked()
  })

  it("does not select a disabled item", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <RadioGroup label="Tier" defaultValue="a" onValueChange={onValueChange}>
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" disabled />
      </RadioGroup>
    )

    await user.click(screen.getByRole("radio", { name: "Beta" }))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole("radio", { name: "Alpha" })).toBeChecked()
  })
})
