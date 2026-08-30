import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

vi.mock("lucide-react", () => {
  const Icon = (props: Record<string, unknown>) => <svg {...props} />
  return {
    ChevronDown: Icon,
  }
})

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./df-accordion"

afterEach(() => {
  cleanup()
})

describe("Accordion multiple mode", () => {
  it("does not put aria-multiselectable on the generic root", async () => {
    const { container } = render(
      <Accordion type="multiple" defaultValue={["one"]}>
        <AccordionItem value="one">
          <AccordionTrigger>One</AccordionTrigger>
          <AccordionContent>First</AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>Two</AccordionTrigger>
          <AccordionContent>Second</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const root = container.querySelector('[data-df="accordion"]')
    expect(root).not.toHaveAttribute("aria-multiselectable")
    expect(root).not.toHaveAttribute("role")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("omits aria-multiselectable in single mode", async () => {
    const { container } = render(
      <Accordion type="single" defaultValue="one">
        <AccordionItem value="one">
          <AccordionTrigger>One</AccordionTrigger>
          <AccordionContent>First</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const root = container.querySelector('[data-df="accordion"]')
    expect(root).not.toHaveAttribute("aria-multiselectable")
    expect(await axe(container)).toHaveNoViolations()
  })
})
