import assert from "node:assert/strict"
import { test } from "node:test"

import { isSafeHref, sanitizeHref, sanitizeSrc } from "./index.ts"

test("sanitizeSrc accepts https blob and data image png", () => {
  assert.equal(sanitizeSrc("https://cdn.example/a.png"), "https://cdn.example/a.png")
  assert.equal(
    sanitizeSrc("blob:https://app.example/uuid"),
    "blob:https://app.example/uuid"
  )
  assert.equal(
    sanitizeSrc("data:image/png;base64,abc"),
    "data:image/png;base64,abc"
  )
})

test("sanitizeSrc rejects javascript svg and html data urls", () => {
  assert.equal(sanitizeSrc("javascript:alert(1)"), null)
  assert.equal(sanitizeSrc("data:image/svg+xml;base64,abc"), null)
  assert.equal(sanitizeSrc("data:text/html;base64,abc"), null)
})

test("sanitizeSrc allows relative paths and rejects protocol relative", () => {
  assert.equal(sanitizeSrc("/images/a.png"), "/images/a.png")
  assert.equal(sanitizeSrc("./local.webp"), "./local.webp")
  assert.equal(sanitizeSrc("//evil.example/x.png"), null)
})

test("isSafeHref and sanitizeHref keep prior editor contract", () => {
  assert.equal(isSafeHref("https://ok.com"), true)
  assert.equal(isSafeHref("mailto:a@b.com"), true)
  assert.equal(isSafeHref("javascript:alert(1)"), false)
  assert.equal(isSafeHref("data:image/png;base64,xx"), false)
  assert.equal(sanitizeHref("https://ok.com"), "https://ok.com")
  assert.equal(sanitizeHref("javascript:alert(1)"), null)
})
