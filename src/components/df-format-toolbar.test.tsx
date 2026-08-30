import { describe, expect, it } from "vitest"

import { isSafeHref } from "../lib/df-url"
import { resolveToolbarHref } from "./df-format-toolbar"

describe("resolveToolbarHref format policy", () => {
  it("promotes a bare domain to https", () => {
    expect(resolveToolbarHref("example.com")).toBe("https://example.com")
    expect(resolveToolbarHref("www.example.com/docs")).toBe(
      "https://www.example.com/docs"
    )
  })

  it("keeps rooted relative, hash, and query targets", () => {
    expect(resolveToolbarHref("/docs/start")).toBe("/docs/start")
    expect(resolveToolbarHref("#section")).toBe("#section")
    expect(resolveToolbarHref("?q=1")).toBe("?q=1")
  })

  it("accepts complete absolute http, https, and mailto urls", () => {
    expect(resolveToolbarHref("https://example.com/a")).toBe(
      "https://example.com/a"
    )
    expect(resolveToolbarHref("http://example.com")).toBe("http://example.com")
    expect(resolveToolbarHref("mailto:a@example.com")).toBe(
      "mailto:a@example.com"
    )
  })

  it("rejects incomplete absolutes, ambiguous relatives, and unsafe schemes", () => {
    expect(resolveToolbarHref("https://")).toBeNull()
    expect(resolveToolbarHref("mailto:")).toBeNull()
    expect(resolveToolbarHref("docs/page")).toBeNull()
    expect(resolveToolbarHref("javascript:alert(1)")).toBeNull()
    expect(resolveToolbarHref("//example.com")).toBeNull()
  })

  it("never admits a value that isSafeHref rejects even if a custom checker allows it", () => {
    expect(
      resolveToolbarHref("javascript:alert(1)", () => true)
    ).toBeNull()
    expect(isSafeHref("javascript:alert(1)")).toBe(false)
  })
})
