import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { TagInput } from "./df-tag-input"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

describe("TagInput contracts", () => {
  it("commits a tag on Enter and names the remove control from the catalogue", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const { container } = render(
      <TagInput
        aria-label="Tags"
        defaultValue={[]}
        onValueChange={onValueChange}
      />
    )

    const input = screen.getByRole("combobox", { name: "Tags" })
    await user.type(input, "design{Enter}")
    expect(onValueChange).toHaveBeenCalledWith(["design"])
    expect(
      screen.getByRole("button", { name: "Remove design" })
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("resolves remove labels from a provider override", async () => {
    const user = userEvent.setup()
    render(
      <DfIntlProvider
        strings={{
          tagInputRemove: (tag) => `Entfernen ${tag}`,
        }}
      >
        <TagInput aria-label="Tags" defaultValue={["alpha"]} />
      </DfIntlProvider>
    )

    expect(
      screen.getByRole("button", { name: "Entfernen alpha" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Entfernen alpha" }))
    expect(screen.queryByText("alpha")).not.toBeInTheDocument()
  })

  it("rejects duplicates through onReject without adding a second chip", async () => {
    const user = userEvent.setup()
    const onReject = vi.fn()
    const onValueChange = vi.fn()
    render(
      <TagInput
        aria-label="Tags"
        defaultValue={["alpha"]}
        onReject={onReject}
        onValueChange={onValueChange}
      />
    )

    await user.type(screen.getByRole("combobox", { name: "Tags" }), "alpha{Enter}")
    expect(onReject).toHaveBeenCalled()
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getAllByText("alpha")).toHaveLength(1)
  })
})
