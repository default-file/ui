import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { ContentsNav, ContentsNavItem } from "./df-contents-nav"

afterEach(() => {
  cleanup()
})

describe("ContentsNav href sanitization", () => {
  it("rejects a javascript: href and does not render an anchor", () => {
    render(
      <ContentsNav variant="index" scrollSpy={false}>
        <ContentsNavItem href="javascript:alert(1)">Unsafe</ContentsNavItem>
      </ContentsNav>
    )

    expect(screen.getByText("Unsafe")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("keeps relative and fragment hrefs", () => {
    const { rerender } = render(
      <ContentsNav variant="index" scrollSpy={false}>
        <ContentsNavItem href="/docs/intro">Relative</ContentsNavItem>
      </ContentsNav>
    )

    expect(screen.getByRole("link", { name: "Relative" })).toHaveAttribute(
      "href",
      "/docs/intro"
    )

    rerender(
      <ContentsNav variant="index" scrollSpy={false}>
        <ContentsNavItem href="#section">Fragment</ContentsNavItem>
      </ContentsNav>
    )

    expect(screen.getByRole("link", { name: "Fragment" })).toHaveAttribute(
      "href",
      "#section"
    )
  })
})

describe("ContentsNav intl", () => {
  it("resolves the landmark name from a provider override", async () => {
    const { container } = render(
      <DfIntlProvider strings={{ contentsNavToc: "Auf dieser Seite" }}>
        <ContentsNav variant="toc" scrollSpy={false}>
          <ContentsNavItem itemId="a">Alpha</ContentsNavItem>
        </ContentsNav>
      </DfIntlProvider>
    )

    expect(
      screen.getByRole("navigation", { name: "Auf dieser Seite" })
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
