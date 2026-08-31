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

  it("writes chrome props onto button CSS variables", () => {
    render(
      <Button
        paddingX="calc(6 * var(--spacing-unit))"
        paddingY="calc(3 * var(--spacing-unit))"
        height="calc(12 * var(--spacing-unit))"
        width="calc(36 * var(--spacing-unit))"
        fontSize="var(--df-text-base)"
        lineHeight="var(--df-leading-6)"
        fontFamily="var(--df-font-mono)"
        radius="var(--radius-md)"
      >
        Custom
      </Button>
    )
    const control = screen.getByRole("button", { name: "Custom" })
    expect(control.style.getPropertyValue("--df-button-padding-inline-start")).toBe(
      "calc(6 * var(--spacing-unit))"
    )
    expect(control.style.getPropertyValue("--df-button-padding-inline-end")).toBe(
      "calc(6 * var(--spacing-unit))"
    )
    expect(control.style.getPropertyValue("--df-button-padding-block-start")).toBe(
      "calc(3 * var(--spacing-unit))"
    )
    expect(control.style.getPropertyValue("--df-button-padding-block-end")).toBe(
      "calc(3 * var(--spacing-unit))"
    )
    expect(control.style.getPropertyValue("--df-button-height")).toBe(
      "calc(12 * var(--spacing-unit))"
    )
    expect(control.style.getPropertyValue("--df-button-width")).toBe(
      "calc(36 * var(--spacing-unit))"
    )
    expect(control.style.getPropertyValue("--df-button-font-size")).toBe(
      "var(--df-text-base)"
    )
    expect(control.style.getPropertyValue("--df-button-line-height")).toBe(
      "var(--df-leading-6)"
    )
    expect(control.style.getPropertyValue("--df-button-font-family")).toBe(
      "var(--df-font-mono)"
    )
    expect(control.style.getPropertyValue("--df-button-radius")).toBe(
      "var(--radius-md)"
    )
  })
})
