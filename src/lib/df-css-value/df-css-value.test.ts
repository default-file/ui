import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseCssHslChannelTriplet,
  sanitizeCssColor,
  sanitizeCssLength,
} from "./index.ts"

test("sanitizeCssColor accepts hex rgb hsl oklch var and named colors", () => {
  assert.equal(sanitizeCssColor("#fff"), "#fff")
  assert.equal(sanitizeCssColor("#112233"), "#112233")
  assert.equal(sanitizeCssColor("rgb(1, 2, 3)"), "rgb(1, 2, 3)")
  assert.equal(sanitizeCssColor("rgba(1, 2, 3, 0.5)"), "rgba(1, 2, 3, 0.5)")
  assert.equal(sanitizeCssColor("hsl(120 50% 40%)"), "hsl(120 50% 40%)")
  assert.equal(sanitizeCssColor("oklch(0.7 0.1 40)"), "oklch(0.7 0.1 40)")
  assert.equal(sanitizeCssColor("var(--df-brand)"), "var(--df-brand)")
  assert.equal(sanitizeCssColor("transparent"), "transparent")
  assert.equal(sanitizeCssColor("currentColor"), "currentColor")
})

test("sanitizeCssColor rejects bare HSL channel triplets", () => {
  assert.equal(sanitizeCssColor("210 40 98"), null)
  assert.equal(sanitizeCssColor("12.5 3.25 90"), null)
})

test("parseCssHslChannelTriplet returns channels or null", () => {
  assert.deepEqual(parseCssHslChannelTriplet("210 40 98"), {
    h: 210,
    s: 40,
    l: 98,
  })
  assert.deepEqual(parseCssHslChannelTriplet(" 12.5  3.25  90 "), {
    h: 12.5,
    s: 3.25,
    l: 90,
  })
  assert.equal(parseCssHslChannelTriplet("210 40"), null)
  assert.equal(parseCssHslChannelTriplet("210 40 98 50"), null)
  assert.equal(parseCssHslChannelTriplet("-1 40 98"), null)
  assert.equal(parseCssHslChannelTriplet("210 40% 50%"), null)
  assert.equal(parseCssHslChannelTriplet("#fff"), null)
  assert.equal(parseCssHslChannelTriplet("hsl(210 40% 50%)"), null)
  assert.equal(parseCssHslChannelTriplet("."), null)
  assert.equal(parseCssHslChannelTriplet(". . ."), null)
})

test("sanitizeCssColor accepts modern color functions and nested var fallbacks", () => {
  assert.equal(sanitizeCssColor("hwb(210 40% 20%)"), "hwb(210 40% 20%)")
  assert.equal(sanitizeCssColor("lab(50% 40 59.5)"), "lab(50% 40 59.5)")
  assert.equal(sanitizeCssColor("lch(50% 40 270)"), "lch(50% 40 270)")
  assert.equal(sanitizeCssColor("oklab(0.7 0.1 0.05)"), "oklab(0.7 0.1 0.05)")
  assert.equal(
    sanitizeCssColor("color(display-p3 1 0.5 0)"),
    "color(display-p3 1 0.5 0)"
  )
  assert.equal(
    sanitizeCssColor("color-mix(in oklch, #112233 40%, white)"),
    "color-mix(in oklch, #112233 40%, white)"
  )
  assert.equal(
    sanitizeCssColor("var(--df-brand, #112233)"),
    "var(--df-brand, #112233)"
  )
  assert.equal(
    sanitizeCssColor("var(--df-brand, oklch(0.7 0.1 40))"),
    "var(--df-brand, oklch(0.7 0.1 40))"
  )
  assert.equal(
    sanitizeCssColor("var(--a, var(--b, hsl(120 40% 50%)))"),
    "var(--a, var(--b, hsl(120 40% 50%)))"
  )
  assert.equal(
    sanitizeCssColor("color-mix(in srgb, var(--df-brand) 50%, transparent)"),
    "color-mix(in srgb, var(--df-brand) 50%, transparent)"
  )
})

test("sanitizeCssColor rejects unknown function names at any depth", () => {
  assert.equal(sanitizeCssColor("notacolor(1)"), null)
  assert.equal(sanitizeCssColor("var(--x, notacolor(1))"), null)
  assert.equal(sanitizeCssColor("color-mix(in oklch, blur(4px), red)"), null)
  assert.equal(sanitizeCssColor("calc(1 + 1)"), null)
  assert.equal(sanitizeCssColor("light-dark(white, black)"), null)
})

test("sanitizeCssColor rejects declaration breakouts and resource loads", () => {
  assert.equal(sanitizeCssColor("red; background: url(x)"), null)
  assert.equal(sanitizeCssColor("red;--x:1"), null)
  assert.equal(sanitizeCssColor("red}"), null)
  assert.equal(sanitizeCssColor("red{"), null)
  assert.equal(sanitizeCssColor("url(javascript:alert(1))"), null)
  assert.equal(sanitizeCssColor("URL(https://evil.test)"), null)
  assert.equal(sanitizeCssColor("red /* comment */"), null)
  assert.equal(sanitizeCssColor("red*/"), null)
  assert.equal(sanitizeCssColor("/*),url(x),hsl(0"), null)
})

test("sanitizeCssColor rejects comment escape and unbalanced or hostile nesting", () => {
  assert.equal(
    sanitizeCssColor("hsl(0 0% 0% /*); background: red; /*)"),
    null
  )
  assert.equal(sanitizeCssColor("rgb(1, 2, 3"), null)
  assert.equal(sanitizeCssColor("rgb(1, 2, 3))"), null)
  assert.equal(sanitizeCssColor("rgb(1, 2, 3) rgb(4, 5, 6)"), null)
  assert.equal(sanitizeCssColor("rgb(0, 0, url(evil))"), null)
  assert.equal(
    sanitizeCssColor("color-mix(in oklch, red 50%, url(evil))"),
    null
  )
  assert.equal(
    sanitizeCssColor("var(--ok, red; background: url(x))"),
    null
  )
  assert.equal(
    sanitizeCssColor("var(--ok, rgb(0, 0, url(x)))"),
    null
  )
  assert.equal(sanitizeCssColor("hsl(0 0% 0%)\\9"), null)
  assert.equal(sanitizeCssColor("rgb(0, 0, 0) <script>"), null)
  assert.equal(sanitizeCssColor("expression(alert(1))"), null)
})

test("sanitizeCssLength accepts units calc var clamp min and max", () => {
  assert.equal(sanitizeCssLength("12px"), "12px")
  assert.equal(sanitizeCssLength("1.5rem"), "1.5rem")
  assert.equal(sanitizeCssLength("50%"), "50%")
  assert.equal(sanitizeCssLength("calc(100% - 8px)"), "calc(100% - 8px)")
  assert.equal(sanitizeCssLength("calc(2 * 1rem)"), "calc(2 * 1rem)")
  assert.equal(
    sanitizeCssLength("var(--df-control-height-md)"),
    "var(--df-control-height-md)"
  )
  assert.equal(
    sanitizeCssLength("clamp(12px, 2vw, 48px)"),
    "clamp(12px, 2vw, 48px)"
  )
  assert.equal(sanitizeCssLength("min(40px, 10%)"), "min(40px, 10%)")
  assert.equal(sanitizeCssLength("max(1rem, 24px)"), "max(1rem, 24px)")
  assert.equal(
    sanitizeCssLength("calc(min(100%, 40px) + max(0px, 1rem))"),
    "calc(min(100%, 40px) + max(0px, 1rem))"
  )
  assert.equal(
    sanitizeCssLength("clamp(0px, var(--df-space-3), 4rem)"),
    "clamp(0px, var(--df-space-3), 4rem)"
  )
})

test("sanitizeCssLength rejects unsafe characters and unknown functions", () => {
  assert.equal(sanitizeCssLength("12px; color: red"), null)
  assert.equal(sanitizeCssLength("url(evil)"), null)
  assert.equal(sanitizeCssLength("12px /* x */"), null)
  assert.equal(sanitizeCssLength("calc(1px + notafunction(2))"), null)
  assert.equal(sanitizeCssLength("min(10px, blur(4px))"), null)
  assert.equal(sanitizeCssLength("env(safe-area-inset-top)"), null)
  assert.equal(sanitizeCssLength("calc(100% - 8px) calc(1px)"), null)
  assert.equal(sanitizeCssLength("calc(1px + url(x))"), null)
})
