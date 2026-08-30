import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { DfIntlProvider } from "../lib/df-intl"
import { ChartFrame, ChartLegend, ChartTooltip } from "./df-chart"

afterEach(() => {
  cleanup()
})

describe("Chart colour sanitization", () => {
  it("rejects a hostile legend colour", () => {
    const { container } = render(
      <ChartLegend
        items={[
          {
            id: "hostile",
            label: "Series",
            color: "red; background: url(javascript:alert(1))",
          },
        ]}
      />
    )

    const swatch = container.querySelector(
      '[data-df="chart-legend-swatch"]'
    ) as HTMLElement
    expect(swatch).toBeTruthy()
    expect(swatch.style.backgroundColor).toBe("")
  })

  it("rejects a hostile tooltip colour", () => {
    const { container } = render(
      <ChartTooltip
        active
        label="Point"
        payload={[
          {
            name: "Series",
            value: 12,
            color: "red; background: url(javascript:alert(1))",
          },
        ]}
      />
    )

    const swatch = container.querySelector(
      '[data-df="chart-tooltip-swatch"]'
    ) as HTMLElement
    expect(swatch).toBeTruthy()
    expect(swatch.style.backgroundColor).toBe("")
  })

  it("accepts a safe hex colour on the legend", () => {
    const { container } = render(
      <ChartLegend
        items={[{ id: "ok", label: "Series", color: "#112233" }]}
      />
    )

    const swatch = container.querySelector(
      '[data-df="chart-legend-swatch"]'
    ) as HTMLElement
    expect(swatch.style.backgroundColor).toBe("rgb(17, 34, 51)")
  })
})

describe("ChartFrame accessible plot", () => {
  it("exposes the plot as a named image", () => {
    render(
      <ChartFrame title="Revenue" plotLabel="Revenue by quarter">
        <svg data-testid="plot" />
      </ChartFrame>
    )

    const plot = screen.getByRole("img", { name: "Revenue by quarter" })
    expect(plot).toHaveAttribute("data-df", "chart-frame-plot")
  })

  it("falls back to a string title when plotLabel is omitted", () => {
    render(
      <ChartFrame title="Bookings">
        <svg />
      </ChartFrame>
    )

    expect(screen.getByRole("img", { name: "Bookings" })).toBeInTheDocument()
  })

  it("does not use role=img when no accessible name is available", () => {
    const { container } = render(
      <ChartFrame>
        <span>Visible series label</span>
      </ChartFrame>
    )

    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    const plot = container.querySelector('[data-df="chart-frame-plot"]')
    expect(plot).not.toHaveAttribute("role")
    expect(screen.getByText("Visible series label")).toBeInTheDocument()
  })

  it("passes axe when the plot has no name and leaves children exposed", async () => {
    const { container } = render(
      <ChartFrame>
        <span>Quarterly totals</span>
      </ChartFrame>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("resolves empty copy from the intl provider", () => {
    render(
      <DfIntlProvider strings={{ chartEmpty: "Sin datos" }}>
        <ChartFrame empty />
      </DfIntlProvider>
    )

    expect(screen.getByRole("status")).toHaveTextContent("Sin datos")
  })

  it("passes axe when the plot is labelled", async () => {
    const { container } = render(
      <ChartFrame title="Trend" plotLabel="Trend over time">
        <svg />
      </ChartFrame>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
