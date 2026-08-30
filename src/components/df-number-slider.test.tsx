import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { NumberSlider } from "./df-number-slider"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => true)
})

describe("NumberSlider contracts", () => {
  it("renders a labelled slider and passes axe", async () => {
    const onChange = vi.fn()
    const { container } = render(
      <NumberSlider
        label="Opacity"
        value={0.5}
        min={0}
        max={1}
        step={0.1}
        onChange={onChange}
      />
    )

    expect(screen.getByText("Opacity")).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: /Opacity/ })).toHaveAttribute(
      "aria-valuenow",
      "0.5"
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("updates value from keyboard on the slider thumb", () => {
    const onChange = vi.fn()
    render(
      <NumberSlider
        label="Opacity"
        value={0.5}
        min={0}
        max={1}
        step={0.1}
        onChange={onChange}
      />
    )

    const thumb = screen.getByRole("slider", { name: /Opacity/ })
    fireEvent.keyDown(thumb, { key: "ArrowRight" })
    expect(onChange).toHaveBeenCalled()
  })
})
