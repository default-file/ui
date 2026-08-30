import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { Split } from "./df-split"

afterEach(() => {
  cleanup()
})

describe("Split contracts", () => {
  it("names the separator from aria-label and keeps keyboard resize", async () => {
    const user = userEvent.setup()
    const onRatioChange = vi.fn()
    const { container } = render(
      <Split
        aria-label="Resize panes"
        defaultRatio={0.4}
        step={0.1}
        onRatioChange={onRatioChange}
      >
        <div>Primary</div>
        <div>Secondary</div>
      </Split>
    )

    const separator = screen.getByRole("separator", { name: "Resize panes" })
    expect(separator).toHaveAttribute("aria-orientation", "horizontal")
    expect(separator).toHaveAttribute("aria-valuenow", "40")
    expect(separator).toHaveAttribute("tabIndex", "0")
    expect(await axe(container)).toHaveNoViolations()

    separator.focus()
    await user.keyboard("{ArrowRight}")
    expect(onRatioChange).toHaveBeenCalled()
    const next = onRatioChange.mock.calls.at(-1)?.[0] as number
    expect(next).toBeGreaterThan(0.4)
  })

  it("names the separator from the catalogue when aria-label is omitted", () => {
    render(
      <Split defaultRatio={0.5}>
        <div>A</div>
        <div>B</div>
      </Split>
    )
    expect(screen.getByRole("separator", { name: "Resize" })).toBeInTheDocument()
  })

  it("honours controlled ratio updates", () => {
    const { rerender } = render(
      <Split ratio={0.25} onRatioChange={() => {}}>
        <div>A</div>
        <div>B</div>
      </Split>
    )
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "25")

    rerender(
      <Split ratio={0.75} onRatioChange={() => {}}>
        <div>A</div>
        <div>B</div>
      </Split>
    )
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "75")
  })

  it("disables pointer and keyboard interaction when disabled", async () => {
    const user = userEvent.setup()
    const onRatioChange = vi.fn()
    render(
      <Split disabled defaultRatio={0.5} onRatioChange={onRatioChange}>
        <div>A</div>
        <div>B</div>
      </Split>
    )
    const separator = screen.getByRole("separator")
    expect(separator).toHaveAttribute("aria-disabled", "true")
    expect(separator).toHaveAttribute("tabIndex", "-1")
    await user.keyboard("{ArrowRight}")
    expect(onRatioChange).not.toHaveBeenCalled()
  })
})
