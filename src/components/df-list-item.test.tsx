import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ListItem, ListItemNest } from "./df-list-item"

afterEach(() => {
  cleanup()
})

describe("ListItem contracts", () => {
  it("renders a named button, forwards className and ref, and runs click", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const ref = React.createRef<HTMLElement>()
    const { container } = render(
      <ListItem
        ref={ref}
        as="button"
        className="row-host"
        onClick={onClick}
      >
        Inbox
      </ListItem>
    )

    const control = screen.getByRole("button", { name: "Inbox" })
    expect(control).toHaveClass("row-host")
    expect(ref.current).toBe(control)
    await user.click(control)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("activates from the keyboard when rendered as a button", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ListItem as="button" onClick={onClick}>
        Open
      </ListItem>
    )

    const control = screen.getByRole("button", { name: "Open" })
    control.focus()
    await user.keyboard("{Enter}")
    expect(onClick).toHaveBeenCalled()
  })
})

describe("ListItemNest contracts", () => {
  it("renders nest chrome around child rows and forwards className", async () => {
    const { container } = render(
      <ListItemNest className="nest-host" line>
        <ListItem as="button">Child</ListItem>
      </ListItemNest>
    )

    const nest = container.querySelector('[data-df="list-item-nest"]')
    expect(nest).toHaveClass("nest-host")
    expect(nest).toHaveAttribute("data-line", "true")
    expect(screen.getByRole("button", { name: "Child" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("can omit the guide line", () => {
    const { container } = render(
      <ListItemNest line={false}>
        <ListItem>Nested</ListItem>
      </ListItemNest>
    )
    expect(container.querySelector('[data-df="list-item-nest"]')).toHaveAttribute(
      "data-line",
      "false"
    )
  })
})
