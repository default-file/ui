import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { SpectrumText } from "./df-spectrum-text"

afterEach(() => {
  cleanup()
})

describe("SpectrumText color sanitization", () => {
  it("rejects a hostile color before it reaches an inline style", () => {
    const { container } = render(
      <SpectrumText colors={["red; background:url(javascript:alert(1))", "blue"]}>
        Label
      </SpectrumText>
    )

    const fill = container.querySelector('[data-slot="fill"]')
    expect(fill).toBeInstanceOf(HTMLElement)
    const backgroundImage = (fill as HTMLElement).style.backgroundImage
    expect(backgroundImage).not.toContain("javascript:")
    expect(backgroundImage).not.toContain("url(javascript")
    expect(backgroundImage).not.toContain("background:")
  })

  it("keeps a legitimate token color in the gradient", () => {
    const { container } = render(
      <SpectrumText colors={["var(--df-brand)", "var(--df-brand)"]}>
        Brand
      </SpectrumText>
    )

    const fill = container.querySelector('[data-slot="fill"]')
    expect(fill).toBeInstanceOf(HTMLElement)
    expect((fill as HTMLElement).style.backgroundImage).toContain(
      "var(--df-brand)"
    )
  })
})
