import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Switch } from "./df-switch"

afterEach(() => {
  cleanup()
})

describe("Switch event composition", () => {
  it("keeps toggling when the consumer passes onClick", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Switch onClick={onClick} />)

    const control = screen.getByRole("switch")
    expect(control).toHaveAttribute("aria-checked", "false")

    await user.click(control)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(control).toHaveAttribute("aria-checked", "true")
  })

  it("runs the consumer onClick handler", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Switch onClick={onClick} defaultChecked />)

    await user.click(screen.getByRole("switch"))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("skips the toggle when the consumer calls preventDefault", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    render(<Switch onClick={onClick} />)

    const control = screen.getByRole("switch")
    await user.click(control)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(control).toHaveAttribute("aria-checked", "false")
  })
})
