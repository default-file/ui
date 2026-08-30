import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { TextMark } from "./df-text-mark"

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    }),
  })
})

describe("TextMark contracts", () => {
  it("renders marked text, forwards className, and passes axe when inactive", async () => {
    const { container } = render(
      <TextMark className="mark-host" active={false} kind="underline">
        Annotated
      </TextMark>
    )

    const root = container.querySelector('[data-df="text-mark"]')
    expect(root).toHaveClass("mark-host")
    expect(root).toHaveAttribute("data-active", "false")
    expect(screen.getByText("Annotated")).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("records the active kind on the host", () => {
    const { container } = render(
      <TextMark active kind="highlight">
        Glow
      </TextMark>
    )
    const root = container.querySelector('[data-df="text-mark"]')
    expect(root).toHaveAttribute("data-kind", "highlight")
    expect(root).toHaveAttribute("data-active", "true")
  })
})
