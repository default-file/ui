import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { BorderGlow } from "./df-border-glow"

afterEach(() => {
  cleanup()
})

describe("BorderGlow channel triplets", () => {
  it("composes hsl bloom layers from a bare channel triplet", () => {
    const { container } = render(
      <BorderGlow glowColor="210 40 98" bloom>
        Card
      </BorderGlow>
    )

    const root = container.querySelector('[data-df="border-glow"]')
    expect(root).toBeInstanceOf(HTMLElement)
    const style = (root as HTMLElement).style
    expect(style.getPropertyValue("--df-border-glow-ink-100")).toContain(
      "hsl(210deg 40% 98%"
    )
    expect(style.getPropertyValue("--df-border-glow-ink-60")).toContain("hsl(")
    expect(style.getPropertyValue("--df-border-glow-ink-100")).not.toContain(
      "color-mix"
    )
  })

  it("filters a triplet out of mesh colors instead of emitting it into gradients", () => {
    const { container } = render(
      <BorderGlow colors={["210 40 98", "#112233"]} bloom={false}>
        Card
      </BorderGlow>
    )

    const root = container.querySelector('[data-df="border-glow"]')
    expect(root).toBeInstanceOf(HTMLElement)
    const style = (root as HTMLElement).style
    const g1 = style.getPropertyValue("--df-border-glow-g1")
    const gBase = style.getPropertyValue("--df-border-glow-g-base")
    expect(g1).toContain("#112233")
    expect(g1).not.toContain("210 40 98")
    expect(gBase).toContain("#112233")
    expect(gBase).not.toContain("210 40 98")
  })
})
