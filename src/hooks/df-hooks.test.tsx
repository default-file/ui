import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  useAnchoredPosition,
  useDragGesture,
  useLatestRef,
  useNearestDarkClass,
  usePresence,
} from "./df-hooks"

afterEach(() => {
  vi.unstubAllGlobals()
})

function dispatchWindowPointer(
  type: "pointermove" | "pointerup" | "pointercancel",
  pointerId: number,
  clientX = 0
) {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, "pointerId", { value: pointerId })
  Object.defineProperty(event, "clientX", { value: clientX })
  window.dispatchEvent(event)
}

describe("useLatestRef", () => {
  it("exposes the newest value to a deferred callback", async () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useLatestRef(value),
      { initialProps: { value: "one" } }
    )

    const seen: string[] = []
    const schedule = () => {
      queueMicrotask(() => {
        seen.push(result.current.current)
      })
    }

    schedule()
    await act(async () => {
      await Promise.resolve()
    })
    expect(seen).toEqual(["one"])

    rerender({ value: "two" })
    schedule()
    await act(async () => {
      await Promise.resolve()
    })
    expect(seen).toEqual(["one", "two"])
  })
})

describe("usePresence", () => {
  it("is present immediately when open becomes true", () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => usePresence(open),
      { initialProps: { open: false } }
    )
    expect(result.current.present).toBe(false)

    rerender({ open: true })
    expect(result.current.present).toBe(true)
  })

  it("stays present while closing until exit animation ends", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    )

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => usePresence(open, { animated: true }),
      { initialProps: { open: true } }
    )
    expect(result.current.present).toBe(true)

    rerender({ open: false })
    expect(result.current.present).toBe(true)

    const panel = document.createElement("div")
    act(() => {
      result.current.onExitAnimationEnd({
        target: panel,
        currentTarget: panel,
      })
    })
    expect(result.current.present).toBe(false)
  })

  it("reopening mid-exit keeps the host present and open", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    )

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => usePresence(open, { animated: true }),
      { initialProps: { open: true } }
    )

    rerender({ open: false })
    expect(result.current.present).toBe(true)

    rerender({ open: true })
    expect(result.current.present).toBe(true)

    const panel = document.createElement("div")
    act(() => {
      result.current.onExitAnimationEnd({
        target: panel,
        currentTarget: panel,
      })
    })
    expect(result.current.present).toBe(true)
  })

  it("unmounts immediately when animated is false", () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => usePresence(open, { animated: false }),
      { initialProps: { open: true } }
    )

    rerender({ open: false })
    expect(result.current.present).toBe(false)
  })
})

describe("useNearestDarkClass", () => {
  it("resolves after mount instead of staying undefined", async () => {
    function Host({ enabled }: { enabled: boolean }) {
      const ref = React.useRef<HTMLDivElement | null>(null)
      const theme = useNearestDarkClass(ref, enabled)
      return (
        <div className="dark">
          <div ref={ref} data-testid="trigger" />
          <span data-testid="theme">{theme ?? "none"}</span>
        </div>
      )
    }

    const { getByTestId, rerender, unmount } = render(
      <Host enabled={false} />
    )
    expect(getByTestId("theme").textContent).toBe("none")

    rerender(<Host enabled={true} />)
    await waitFor(() => {
      expect(getByTestId("theme").textContent).toBe("dark")
    })
    unmount()
  })

  it("follows an ancestor theme class while enabled stays true", async () => {
    function Host() {
      const ref = React.useRef<HTMLDivElement | null>(null)
      const [dark, setDark] = React.useState(false)
      const theme = useNearestDarkClass(ref, true)
      return (
        <div className={dark ? "dark" : undefined}>
          <div ref={ref} />
          <span data-testid="theme">{theme ?? "none"}</span>
          <button type="button" onClick={() => setDark(true)}>
            Enable dark
          </button>
        </div>
      )
    }

    const { getByTestId, getByRole, unmount } = render(<Host />)
    expect(getByTestId("theme").textContent).toBe("none")

    fireEvent.click(getByRole("button", { name: "Enable dark" }))
    await waitFor(() => {
      expect(getByTestId("theme").textContent).toBe("dark")
    })
    unmount()
  })
})

describe("useDragGesture", () => {
  it("tears down on pointerup", () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { result } = renderHook(() => useDragGesture())
    const target = document.createElement("div")

    act(() => {
      result.current.begin(
        { pointerId: 1, currentTarget: target },
        { origin: 10 },
        { onMove, onEnd },
        { capture: false }
      )
    })

    act(() => {
      dispatchWindowPointer("pointermove", 1, 24)
      dispatchWindowPointer("pointerup", 1, 24)
    })

    expect(onMove).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ pointerId: 1 }),
      { origin: 10 },
      "up"
    )

    onMove.mockClear()
    act(() => {
      dispatchWindowPointer("pointermove", 1, 40)
    })
    expect(onMove).not.toHaveBeenCalled()
  })

  it("tears down on pointercancel", () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { result } = renderHook(() => useDragGesture())
    const target = document.createElement("div")

    act(() => {
      result.current.begin(
        { pointerId: 2, currentTarget: target },
        { origin: 5 },
        { onMove, onEnd },
        { capture: false }
      )
    })

    act(() => {
      dispatchWindowPointer("pointercancel", 2)
    })

    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ pointerId: 2 }),
      { origin: 5 },
      "cancel"
    )
  })

  it("tears down on unmount mid-drag", () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { result, unmount } = renderHook(() => useDragGesture())
    const target = document.createElement("div")

    act(() => {
      result.current.begin(
        { pointerId: 3, currentTarget: target },
        { origin: 8 },
        { onMove, onEnd },
        { capture: false }
      )
    })

    unmount()

    expect(onEnd).toHaveBeenCalledWith(null, { origin: 8 }, "unmount")
    expect(() => {
      dispatchWindowPointer("pointermove", 3, 50)
    }).not.toThrow()
  })
})

describe("useAnchoredPosition", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  it("marks positionAttempted and clears visibility after a failed measure", async () => {
    const triggerRef = { current: document.createElement("button") }
    const contentRef = { current: document.createElement("div") }
    document.body.append(triggerRef.current, contentRef.current)
    Object.defineProperty(contentRef.current, "offsetWidth", { value: 0 })
    Object.defineProperty(contentRef.current, "offsetHeight", { value: 0 })

    const { result } = renderHook(() =>
      useAnchoredPosition({
        open: true,
        triggerRef,
        contentRef,
        matchTriggerWidth: false,
      })
    )

    await waitFor(() => {
      expect(result.current.positionAttempted).toBe(true)
      expect(result.current.style.visibility).toBe("visible")
    })

    triggerRef.current.remove()
    contentRef.current.remove()
  })

  it("resets positionAttempted when closed", async () => {
    const triggerRef = { current: document.createElement("button") }
    const contentRef = { current: document.createElement("div") }
    document.body.append(triggerRef.current, contentRef.current)
    Object.defineProperty(contentRef.current, "offsetWidth", { value: 0 })
    Object.defineProperty(contentRef.current, "offsetHeight", { value: 0 })

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useAnchoredPosition({
          open,
          triggerRef,
          contentRef,
          matchTriggerWidth: false,
        }),
      { initialProps: { open: true } }
    )

    await waitFor(() => {
      expect(result.current.positionAttempted).toBe(true)
    })

    rerender({ open: false })
    expect(result.current.positionAttempted).toBe(false)
    expect(result.current.style.visibility).toBe("hidden")

    triggerRef.current.remove()
    contentRef.current.remove()
  })
})
