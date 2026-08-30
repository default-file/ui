import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { Checkbox } from "./df-checkbox"

afterEach(() => {
  cleanup()
})

describe("Checkbox contracts", () => {
  it("exposes a named checkbox and toggles from unchecked to checked", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    const { container } = render(
      <Checkbox label="Accept terms" onCheckedChange={onCheckedChange} />
    )

    const control = screen.getByRole("checkbox", { name: "Accept terms" })
    expect(control).not.toBeChecked()
    expect(await axe(container)).toHaveNoViolations()

    await user.click(control)
    expect(control).toBeChecked()
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("announces indeterminate as aria-checked mixed", () => {
    render(<Checkbox label="Select all" checked="indeterminate" />)
    expect(screen.getByRole("checkbox", { name: "Select all" })).toHaveAttribute(
      "aria-checked",
      "mixed"
    )
  })

  it("supports controlled checked without flipping on its own", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <Checkbox label="Notify" checked={false} onCheckedChange={onCheckedChange} />
    )
    const control = screen.getByRole("checkbox", { name: "Notify" })
    await user.click(control)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(control).not.toBeChecked()

    rerender(
      <Checkbox label="Notify" checked onCheckedChange={onCheckedChange} />
    )
    expect(screen.getByRole("checkbox", { name: "Notify" })).toBeChecked()
  })

  it("associates description text for assistive tech", () => {
    render(
      <Checkbox
        label="Marketing"
        description="Optional product updates"
      />
    )
    const control = screen.getByRole("checkbox", { name: /Marketing/ })
    const descriptionId = control.getAttribute("aria-describedby")
    expect(descriptionId).toBeTruthy()
    expect(document.getElementById(descriptionId!)).toHaveTextContent(
      "Optional product updates"
    )
  })
})
