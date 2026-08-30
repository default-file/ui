import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

vi.mock("lucide-react", () => {
  const Icon = (props: Record<string, unknown>) => <svg {...props} />
  return {
    PanelLeft: Icon,
    X: Icon,
  }
})

import { DockPanel } from "./df-dock-panel"

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

describe("DockPanel landmark name", () => {
  it("names the complementary landmark from the label", async () => {
    const { container } = render(
      <DockPanel label="Inspector" title="Inspector">
        Body
      </DockPanel>
    )

    expect(
      screen.getByRole("complementary", { name: "Inspector" })
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("falls back to the catalogue default name", () => {
    render(<DockPanel>Body</DockPanel>)
    expect(
      screen.getByRole("complementary", { name: "Panel" })
    ).toBeInTheDocument()
  })
})
