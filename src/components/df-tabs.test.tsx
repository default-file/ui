import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./df-tabs"

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

describe("TabsContent keyboard reachability", () => {
  it("makes the selected panel focusable with tabIndex 0", () => {
    render(
      <Tabs defaultValue="alpha">
        <TabsList>
          <TabsTrigger value="alpha">Alpha</TabsTrigger>
          <TabsTrigger value="beta">Beta</TabsTrigger>
        </TabsList>
        <TabsContent value="alpha">Alpha panel</TabsContent>
        <TabsContent value="beta">Beta panel</TabsContent>
      </Tabs>
    )

    const panel = screen.getByRole("tabpanel", { name: "Alpha" })
    expect(panel).toHaveAttribute("tabIndex", "0")
    expect(panel).toHaveTextContent("Alpha panel")
  })
})
