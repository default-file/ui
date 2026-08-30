import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ContentSwitcher,
  ContentSwitcherItem,
} from "./df-content-switcher"

afterEach(() => {
  cleanup()
})

describe("ContentSwitcherItem event composition", () => {
  it("keeps selecting when the consumer passes onClick", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ContentSwitcher defaultValue="">
        <ContentSwitcherItem value="a" onClick={onClick}>
          Alpha
        </ContentSwitcherItem>
        <ContentSwitcherItem value="b">Beta</ContentSwitcherItem>
      </ContentSwitcher>
    )

    const control = screen.getByRole("radio", { name: "Alpha" })
    expect(control).toHaveAttribute("aria-checked", "false")

    await user.click(control)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(control).toHaveAttribute("aria-checked", "true")
  })

  it("runs the consumer onClick handler", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ContentSwitcher defaultValue="a">
        <ContentSwitcherItem value="a" onClick={onClick}>
          Alpha
        </ContentSwitcherItem>
      </ContentSwitcher>
    )

    await user.click(screen.getByRole("radio", { name: "Alpha" }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("skips selection when the consumer calls preventDefault", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    render(
      <ContentSwitcher defaultValue="">
        <ContentSwitcherItem value="a" onClick={onClick}>
          Alpha
        </ContentSwitcherItem>
      </ContentSwitcher>
    )

    const control = screen.getByRole("radio", { name: "Alpha" })
    await user.click(control)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(control).toHaveAttribute("aria-checked", "false")
  })
})
