import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Avatar } from "./df-avatar"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Avatar accessible name", () => {
  it("names the root from name when no image is shown", () => {
    render(<Avatar name="Ada Lovelace" />)
    const root = document.querySelector("[data-df='avatar']")
    expect(root).toHaveAttribute("aria-label", "Ada Lovelace")
    expect(
      document.querySelector("[data-df='avatar-fallback']")
    ).toBeInTheDocument()
  })

  it("prefers alt over name for the root label", () => {
    render(<Avatar name="Ada" alt="Ada profile" />)
    expect(document.querySelector("[data-df='avatar']")).toHaveAttribute(
      "aria-label",
      "Ada profile"
    )
  })
})

describe("Avatar image source sanitization", () => {
  it("rejects a javascript: image source without loading it", () => {
    const loadSpy = vi.fn()
    vi.stubGlobal(
      "Image",
      class {
        onload: ((event: Event) => void) | null = null
        onerror: ((event: Event) => void) | null = null
        set src(_value: string) {
          loadSpy()
        }
      }
    )

    render(<Avatar name="Ada" src="javascript:alert(1)" />)

    expect(loadSpy).not.toHaveBeenCalled()
    expect(
      document.querySelector("[data-df='avatar-image']")
    ).not.toBeInTheDocument()
    expect(
      document.querySelector("[data-df='avatar-fallback']")
    ).toBeInTheDocument()
    expect(document.querySelector("[data-df='avatar']")).toHaveAttribute(
      "aria-label",
      "Ada"
    )
  })

  it("accepts a blob: image source and keeps the root name", async () => {
    const blobUrl = "blob:https://example.local/avatar-1"
    vi.stubGlobal(
      "Image",
      class {
        onload: ((event: Event) => void) | null = null
        onerror: ((event: Event) => void) | null = null
        set src(value: string) {
          queueMicrotask(() => {
            this.onload?.(new Event("load"))
          })
          Object.defineProperty(this, "src", {
            value,
            configurable: true,
            writable: true,
          })
        }
      }
    )

    render(<Avatar name="Ada" src={blobUrl} />)
    await waitFor(() => {
      const image = document.querySelector(
        "[data-df='avatar-image']"
      ) as HTMLElement | null
      expect(image).toBeTruthy()
      expect(image).toHaveAttribute("aria-hidden", "true")
      expect(image!.style.backgroundImage).toContain(blobUrl)
    })
    expect(document.querySelector("[data-df='avatar']")).toHaveAttribute(
      "aria-label",
      "Ada"
    )
  })
})
