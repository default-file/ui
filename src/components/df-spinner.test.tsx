import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { Spinner } from "./df-spinner"

afterEach(() => {
  cleanup()
})

describe("Spinner contracts", () => {
  it("announces loading status, forwards className, and passes axe", async () => {
    const { container } = render(<Spinner className="spin-host" />)

    const status = screen.getByRole("status", { name: "Loading" })
    expect(status).toHaveClass("spin-host")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("resolves the label from the intl provider", () => {
    render(
      <DfIntlProvider strings={{ spinnerLoading: "Laden" }}>
        <Spinner />
      </DfIntlProvider>
    )
    expect(screen.getByRole("status", { name: "Laden" })).toBeInTheDocument()
  })
})
