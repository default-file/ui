import { StrictMode } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  FloatingControls,
  FloatingControlsDivider,
  FloatingControlsItem,
} from "./df-floating-controls"

afterEach(() => {
  cleanup()
})

describe("FloatingControls toolbar roving tabindex", () => {
  it("moves focus with arrow keys among toolbar items", () => {
    render(
      <FloatingControls>
        <FloatingControlsItem>One</FloatingControlsItem>
        <FloatingControlsItem>Two</FloatingControlsItem>
        <FloatingControlsItem>Three</FloatingControlsItem>
      </FloatingControls>
    )

    const one = screen.getByRole("button", { name: "One" })
    const two = screen.getByRole("button", { name: "Two" })
    const three = screen.getByRole("button", { name: "Three" })

    expect(one).toHaveAttribute("tabIndex", "0")
    expect(two).toHaveAttribute("tabIndex", "-1")
    expect(three).toHaveAttribute("tabIndex", "-1")

    one.focus()
    fireEvent.keyDown(one, { key: "ArrowRight" })
    expect(two).toHaveFocus()
    expect(two).toHaveAttribute("tabIndex", "0")

    fireEvent.keyDown(two, { key: "ArrowRight" })
    expect(three).toHaveFocus()

    fireEvent.keyDown(three, { key: "Home" })
    expect(one).toHaveFocus()
  })

  it("keeps a single tab stop when React Strict Mode double-invokes render", () => {
    render(
      <StrictMode>
        <FloatingControls>
          <FloatingControlsItem>One</FloatingControlsItem>
          <FloatingControlsItem>Two</FloatingControlsItem>
          <FloatingControlsItem>Three</FloatingControlsItem>
        </FloatingControls>
      </StrictMode>
    )

    const one = screen.getByRole("button", { name: "One" })
    const two = screen.getByRole("button", { name: "Two" })
    const three = screen.getByRole("button", { name: "Three" })

    expect(one).toHaveAttribute("tabIndex", "0")
    expect(two).toHaveAttribute("tabIndex", "-1")
    expect(three).toHaveAttribute("tabIndex", "-1")
  })

  it("indexes items across dividers for the items prop API", () => {
    render(
      <FloatingControls
        items={[
          { label: "Reset" },
          { type: "divider" },
          { label: "Share" },
        ]}
      />
    )

    const reset = screen.getByRole("button", { name: "Reset" })
    const share = screen.getByRole("button", { name: "Share" })

    expect(reset).toHaveAttribute("tabIndex", "0")
    expect(share).toHaveAttribute("tabIndex", "-1")

    reset.focus()
    fireEvent.keyDown(reset, { key: "ArrowRight" })
    expect(share).toHaveFocus()
  })

  it("skips disabled items when moving focus", () => {
    render(
      <FloatingControls>
        <FloatingControlsItem>One</FloatingControlsItem>
        <FloatingControlsItem disabled>Two</FloatingControlsItem>
        <FloatingControlsItem>Three</FloatingControlsItem>
        <FloatingControlsDivider />
      </FloatingControls>
    )

    const one = screen.getByRole("button", { name: "One" })
    const three = screen.getByRole("button", { name: "Three" })

    one.focus()
    fireEvent.keyDown(one, { key: "ArrowRight" })
    expect(three).toHaveFocus()
  })
})
