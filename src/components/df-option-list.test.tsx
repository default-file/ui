import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("lucide-react", () => {
  const Icon = (props: Record<string, unknown>) => <svg {...props} />
  return {
    Check: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
    ChevronUp: Icon,
    Search: Icon,
    X: Icon,
  }
})

import {
  OptionList,
  OptionListContent,
  OptionListItem,
} from "./df-option-list"

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

describe("OptionListItem search filtering", () => {
  it("does not crash when a visible option is filtered out by a later search query", () => {
    render(
      <OptionList open>
        <OptionListContent portal={false} search scrollable={false}>
          <OptionListItem value="apple">Apple</OptionListItem>
          <OptionListItem value="banana">Banana</OptionListItem>
        </OptionListContent>
      </OptionList>
    )

    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "ban" },
    })

    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument()
  })
})

describe("OptionListContent zero-box host", () => {
  it("becomes interactive after a position attempt in a zero-box container", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <div style={{ width: 0, height: 0, overflow: "hidden" }}>
        <OptionList open onValueChange={onValueChange}>
          <OptionListContent>
            <OptionListItem value="apple">Apple</OptionListItem>
          </OptionListContent>
        </OptionList>
      </div>
    )

    const panel = document.querySelector(
      '[data-df="option-list-content"]'
    ) as HTMLElement
    expect(panel).toBeTruthy()

    await waitFor(() => {
      expect(panel.style.visibility).not.toBe("hidden")
    })

    await user.click(screen.getByRole("option", { name: "Apple" }))
    expect(onValueChange).toHaveBeenCalled()
  })
})
