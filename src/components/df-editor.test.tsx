import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { Editor } from "./df-editor"

afterEach(() => {
  cleanup()
})

describe("Editor contracts", () => {
  it("renders a named textbox and forwards className", async () => {
    const { container } = render(
      <Editor
        value="# Hello"
        className="editor-host"
        aria-label="Notes"
        toolbar="none"
      />
    )

    const root = container.querySelector('[data-df="editor"]')
    expect(root).toHaveClass("editor-host")
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("marks the surface readonly when readOnly is set", () => {
    render(
      <Editor value="Locked" readOnly toolbar="none" aria-label="Locked notes" />
    )
    expect(screen.getByRole("textbox", { name: "Locked notes" })).toHaveAttribute(
      "aria-readonly",
      "true"
    )
  })
})
