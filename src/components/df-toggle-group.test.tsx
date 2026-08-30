import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ToggleGroup, ToggleGroupItem } from "./df-toggle-group"

afterEach(() => {
  cleanup()
})

describe("ToggleGroupItem event composition", () => {
  it("keeps selecting when the consumer passes onClick", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ToggleGroup defaultValue={[]}>
        <ToggleGroupItem value="a" onClick={onClick}>
          Alpha
        </ToggleGroupItem>
        <ToggleGroupItem value="b">Beta</ToggleGroupItem>
      </ToggleGroup>
    )

    const control = screen.getByRole("button", { name: "Alpha" })
    expect(control).toHaveAttribute("aria-pressed", "false")

    await user.click(control)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(control).toHaveAttribute("aria-pressed", "true")
  })

  it("runs the consumer onClick handler", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ToggleGroup defaultValue={["a"]}>
        <ToggleGroupItem value="a" onClick={onClick}>
          Alpha
        </ToggleGroupItem>
      </ToggleGroup>
    )

    await user.click(screen.getByRole("button", { name: "Alpha" }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("skips selection when the consumer calls preventDefault", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    render(
      <ToggleGroup defaultValue={[]}>
        <ToggleGroupItem value="a" onClick={onClick}>
          Alpha
        </ToggleGroupItem>
      </ToggleGroup>
    )

    const control = screen.getByRole("button", { name: "Alpha" })
    await user.click(control)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(control).toHaveAttribute("aria-pressed", "false")
  })
})
