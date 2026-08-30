#!/usr/bin/env node
/**
 * Generates owned CSS utilities from className tokens.
 *
 * Run with no arguments to build the kit stylesheet from kit components.
 * Pass `--app-root <dir>` to additionally build a product stylesheet holding
 * only the classes that consumer app uses and the kit does not already cover.
 *
 * Kit sources are present in a repository checkout but not in an installed
 * package. Without them the shipped stylesheet is authoritative: the covered
 * class list is read from `df-utilities.classes.json` and no kit CSS is
 * rewritten.
 *
 * Theme tables live in df-theme.mjs (DF spacing, color, and type scales).
 * Colors resolve through --df-neutral-* so compact/detailed scale modes apply.
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  BLUR,
  BREAKPOINTS,
  breakpointMaxWidth,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LEADING,
  MAX_W,
  NON_UTILITY_ALLOWLIST,
  RADIUS,
  SHADOW_COMPAT,
  SPACING,
  TRACKING,
} from "./df-theme.mjs"

const VIEWPORT_MAX_VARIANTS = new Set(
  Object.keys(BREAKPOINTS).map((name) => `max-${name}`)
)
const CONTAINER_MIN_VARIANTS = new Set(
  Object.keys(BREAKPOINTS).map((name) => `@${name}`)
)
const RESPONSIVE_VARIANT_PATTERN =
  "dark|max-sm|max-md|max-lg|max-xl|max-2xl|max-3xl|sm|md|lg|xl|2xl|3xl|@sm|@md|@lg|@xl|@2xl|@3xl"

const KIT_ROOT = path.resolve(import.meta.dirname, "..")
const KIT_COMPONENTS = path.join(KIT_ROOT, "src/components")
const KIT_UTILITIES_OUT = path.join(KIT_ROOT, "src/css/df-utilities.css")
const KIT_CLASS_LIST_OUT = path.join(
  KIT_ROOT,
  "src/css/df-utilities.classes.json",
)

/** Value of a `--flag value` argument, or null when absent. */
function readFlag(name) {
  const index = process.argv.indexOf(name)
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (!value || value.startsWith("--")) {
    console.error(`DF utility generator: ${name} needs a directory path.`)
    process.exit(1)
  }
  return path.resolve(value)
}

const APP_ROOT = readFlag("--app-root")
const APP_SRC = APP_ROOT ? path.join(APP_ROOT, "src") : null
const APP_UTILITIES_OUT = APP_ROOT
  ? path.join(APP_ROOT, "src/app/df-app-utilities.css")
  : null
const APP_EXTRA_CLASSES = APP_ROOT
  ? path.join(APP_ROOT, "scripts/df-app-extra-classes.mjs")
  : null

// A checkout carries component sources. An installed package does not, so the
// stylesheet that shipped with it stays authoritative.
const HAS_KIT_SOURCES = fs.existsSync(KIT_COMPONENTS)

const KIT_OUT_TARGETS = []
if (HAS_KIT_SOURCES) {
  KIT_OUT_TARGETS.push(KIT_UTILITIES_OUT)
  const installedKit = APP_ROOT
    ? path.join(APP_ROOT, "node_modules/@default-file/ui/src/css/df-utilities.css")
    : null
  if (installedKit && fs.existsSync(path.dirname(installedKit))) {
    KIT_OUT_TARGETS.push(installedKit)
  }
}

function walk(dir, files = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "css" ||
        entry.name === "default-file-ui" ||
        entry.name.startsWith("_compare")
      )
        continue
      walk(p, files)
    } else if (
      /\.(tsx|ts)$/.test(entry.name) &&
      !/\.test\.(tsx|ts)$/.test(entry.name)
    ) {
      files.push(p)
    }
  }
  return files
}

function isAllowedAtToken(token) {
  if (token === "@container") return true
  return /^@(?:sm|md|lg|xl|2xl|3xl):/.test(token)
}

function addTokens(set, str) {
  if (!str || typeof str !== "string") return
  for (const token of str.split(/\s+/)) {
    if (!token) continue
    if (token.includes("${")) continue
    if (token.startsWith("http")) continue
    if (token.includes("/legal") || token.includes("/studio") || token.includes("/api")) continue
    if (token.startsWith("@")) {
      if (isAllowedAtToken(token)) set.add(token)
      continue
    }
    // utility tokens typically contain hyphen, colon, bracket, or slash opacity.
    // Variant prefixes may start with a digit (e.g. 3xl: for wider screens).
    if (
      /^(?:[a-z0-9][a-z0-9-]*:)*-?(?:[a-z][a-z0-9-]*|[a-z]+-\[[^\]]+\])/.test(token) ||
      token.includes("[") ||
      /\/\d+$/.test(token)
    ) {
      set.add(token)
    }
  }
}

/** Balanced-paren scan so nested oklch(...) inside cn(...) does not truncate. */
function extractCallBodies(source, name) {
  const bodies = []
  const re = new RegExp(`\\b${name}\\(`, "g")
  let m
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length
    let depth = 1
    while (i < source.length && depth > 0) {
      const ch = source[i]
      if (ch === "(") depth++
      else if (ch === ")") depth--
      i++
    }
    bodies.push(source.slice(m.index + m[0].length, i - 1))
  }
  return bodies
}

/** True when a string at `index` is the right-hand side of == / != / === / !==. */
function isComparisonOperand(body, index) {
  let k = index - 1
  while (k >= 0 && /\s/.test(body[k])) k--
  if (k < 1) return false
  if (body[k] !== "=" && body[k] !== "!") return false
  if (body[k - 1] !== "=") return false
  // === or !==
  if (k >= 2 && (body[k - 2] === "=" || body[k - 2] === "!")) return true
  // == or !=
  return true
}

/**
 * Read a quoted string starting at `index`. Returns null value for template
 * interpolations. `end` is always after the closing quote so callers do not
 * resume inside the literal.
 */
function readQuotedString(body, index) {
  const quote = body[index]
  if (quote !== '"' && quote !== "'" && quote !== "`") {
    return { value: null, end: index + 1 }
  }
  let j = index + 1
  let value = ""
  let interpolated = false
  while (j < body.length) {
    if (body[j] === "\\" && quote === "`") {
      value += body[j] + (body[j + 1] ?? "")
      j += 2
      continue
    }
    if (quote === "`" && body[j] === "$" && body[j + 1] === "{") {
      interpolated = true
      value = null
      j += 2
      continue
    }
    if (body[j] === quote) {
      return { value: interpolated ? null : value, end: j + 1 }
    }
    if (!interpolated) value += body[j]
    j++
  }
  return { value: null, end: j }
}

function addStringLiterals(set, body) {
  // Only top-level string literals in the call (skip nested fn args like size: "lg").
  let depth = 0
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch === "(" || ch === "{" || ch === "[") {
      depth++
      i++
      continue
    }
    if (ch === ")" || ch === "}" || ch === "]") {
      depth = Math.max(0, depth - 1)
      i++
      continue
    }
    if (depth === 0 && (ch === '"' || ch === "'" || ch === "`")) {
      const { value, end } = readQuotedString(body, i)
      if (value != null && !isComparisonOperand(body, i)) {
        addTokens(set, value)
      }
      i = end
      continue
    }
    i++
  }
}

/**
 * Collect utilities from `className: <expr>` RHS values, including ternaries
 * inside object literals (for example dfButtonClass({ className: cond ? "…" : "…" })).
 */
function addClassNamePropertyStrings(set, source) {
  const re = /(?:^|[\s,{])className\s*:/g
  let m
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length
    let depth = 0
    while (i < source.length) {
      const ch = source[i]
      if (ch === "(" || ch === "{" || ch === "[") {
        depth++
        i++
        continue
      }
      if (ch === ")" || ch === "}" || ch === "]") {
        if (depth === 0) break
        depth--
        i++
        continue
      }
      if (depth === 0 && (ch === "," || ch === ";")) break
      if (ch === '"' || ch === "'" || ch === "`") {
        const start = i
        const { value, end } = readQuotedString(source, i)
        if (value != null && !isComparisonOperand(source, start)) {
          addTokens(set, value)
        }
        i = end
        continue
      }
      i++
    }
  }
}

function extractClasses(source) {
  const classes = new Set()

  // className="..."
  for (const m of source.matchAll(/className\s*=\s*"([^"]*)"/g)) addTokens(classes, m[1])
  // className='...'
  for (const m of source.matchAll(/className\s*=\s*'([^']*)'/g)) addTokens(classes, m[1])
  // className={`...`}
  for (const m of source.matchAll(/className\s*=\s*\{`([^`]*)`\}/g)) addTokens(classes, m[1])
  // cn(...): full call bodies (handles nested parens / ternaries)
  for (const body of extractCallBodies(source, "cn")) addStringLiterals(classes, body)
  // dfButtonClass(...) call sites
  for (const body of extractCallBodies(source, "dfButtonClass"))
    addStringLiterals(classes, body)
  // viewportClassName / expandedClass / etc. (JSX assignment props)
  for (const m of source.matchAll(/(?:^|[\s,{])(?:\w*)[Cc]lass(?:Name)?\s*=\s*"([^"]*)"/g))
    addTokens(classes, m[1])
  for (const m of source.matchAll(/(?:^|[\s,{])(?:\w*)[Cc]lass(?:Name)?\s*=\s*'([^']*)'/g))
    addTokens(classes, m[1])
  // Data tables: className: "font-sans" (exact key only; not dataClass / maxDataClass)
  for (const m of source.matchAll(/(?:^|[\s,{])className\s*:\s*"([^"]*)"/g))
    addTokens(classes, m[1])
  for (const m of source.matchAll(/(?:^|[\s,{])className\s*:\s*'([^']*)'/g))
    addTokens(classes, m[1])
  // className: ternaries and other non-literal RHS expressions
  addClassNamePropertyStrings(classes, source)

  return classes
}

/** Arbitrary-value decode: `_` → space, `\_` → literal `_`. */
function decodeArbitrary(value) {
  return value.replace(/\\_|_/g, (m) => (m === "\\_" ? "_" : " "))
}

/**
 * Utility type hints in arbitrary values (e.g. text-[length:var(--x)]).
 * The hint disambiguates font-size vs color; it must not appear in CSS output.
 */
const ARBITRARY_TYPE_HINTS = new Set([
  "length",
  "color",
  "angle",
  "size",
  "percentage",
  "url",
  "number",
  "integer",
  "position",
  "image",
  "family-name",
  "generic-name",
  "line-width",
  "absolute-size",
  "relative-size",
])

function parseTypedArbitrary(raw) {
  const value = decodeArbitrary(raw)
  const m = value.match(/^([a-z-]+):(.+)$/i)
  if (!m) return { hint: null, value }
  const hint = m[1].toLowerCase()
  if (!ARBITRARY_TYPE_HINTS.has(hint)) return { hint: null, value }
  return { hint, value: m[2] }
}

function isGradientOrImage(value) {
  return (
    value.includes("gradient(") ||
    value.startsWith("linear") ||
    value.startsWith("radial") ||
    value.startsWith("conic") ||
    value.startsWith("url(")
  )
}

/**
 * Escape a class name for use in a CSS selector.
 * Leading digits must use hex escapes (e.g. 3xl → \33 xl). CSS forbids
 * identifiers that start with a digit. Always terminate the hex escape with a
 * space so the next character is never consumed as part of the escape.
 */
function escapeClass(name) {
  let out = ""
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]
    const code = ch.charCodeAt(0)
    if (i === 0 && code >= 48 && code <= 57) {
      out += `\\${code.toString(16)} `
      continue
    }
    if (/[^a-zA-Z0-9_-]/.test(ch)) {
      out += `\\${ch}`
      continue
    }
    out += ch
  }
  return out
}

/**
 * Opacity modifiers for semantic tokens (muted/50, card/95, …) resolve to opaque
 * shades blended against --background. Absolute overlays (white, black, hex)
 * mix with transparent so they stay see-through on dark stages and media.
 *
 * white/black are aliased to var(--df-neutral-*), so name must be checked; a
 * bare startsWith("var(") test would wrongly tint them against the page surface.
 */
const OVERLAY_COLOR_NAMES = new Set(["white", "black"])

function colorValue(name, opacity) {
  const base = COLORS[name]
  if (!base) return null
  if (opacity == null) return base
  const pct = Number(opacity)
  if (base.startsWith("var(") && !OVERLAY_COLOR_NAMES.has(name)) {
    return `color-mix(in oklch, ${base} ${pct}%, var(--background))`
  }
  return `color-mix(in srgb, ${base} ${pct}%, transparent)`
}

function parseColorToken(rest) {
  const arb = rest.match(/^\[(.+)\](?:\/(\d+))?$/)
  if (arb) {
    const val = decodeArbitrary(arb[1])
    // Gradients / images are not colors; leave for bg-/text- handlers.
    if (isGradientOrImage(val)) return null
    // CSS lengths are font-size (text-[11px]), not colors.
    if (/^-?[\d.]+(?:px|rem|em|%|ch|ex|vh|vw|dvh|svh|lvh|cqw|cqh|lh)?$/i.test(val))
      return null
    if (arb[2]) return `color-mix(in srgb, ${val} ${arb[2]}%, transparent)`
    return val
  }
  const m = rest.match(/^([a-z0-9-]+)(?:\/(\d+))?$/)
  if (!m) return null
  return colorValue(m[1], m[2])
}

function spacing(val) {
  if (val in SPACING) return SPACING[val]
  if (val === "auto") return "auto"
  const arb = val.match(/^\[(.+)\]$/)
  if (arb) return decodeArbitrary(arb[1])
  const frac = val.match(/^(\d+)\/(\d+)$/)
  if (frac) return `${(Number(frac[1]) / Number(frac[2])) * 100}%`
  return null
}

function sizeValue(val) {
  const s = spacing(val)
  if (s != null) return s
  if (val === "full") return "100%"
  if (val === "fit") return "fit-content"
  if (val === "auto") return "auto"
  if (val === "min") return "min-content"
  if (val === "max") return "max-content"
  if (val === "svh") return "100svh"
  if (val === "dvh") return "100dvh"
  if (val === "screen") return "100vh"
  if (val === "px") return "var(--spacing-px)"
  return null
}

function declsFor(utility) {
  let important = false
  let u = utility
  if (u.startsWith("!")) {
    important = true
    u = u.slice(1)
  }

  const add = (obj) => {
    if (!important) return obj
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = `${v} !important`
    return out
  }

  const staticMap = {
    flex: { display: "flex" },
    "inline-flex": { display: "inline-flex" },
    grid: { display: "grid" },
    block: { display: "block" },
    inline: { display: "inline" },
    "inline-block": { display: "inline-block" },
    contents: { display: "contents" },
    hidden: { display: "none" },
    "flex-1": { flex: "1 1 0%" },
    "flex-col": { "flex-direction": "column" },
    "flex-row": { "flex-direction": "row" },
    "flex-wrap": { "flex-wrap": "wrap" },
    "flex-nowrap": { "flex-wrap": "nowrap" },
    "items-center": { "align-items": "center" },
    "items-start": { "align-items": "flex-start" },
    "items-end": { "align-items": "flex-end" },
    "items-stretch": { "align-items": "stretch" },
    "items-baseline": { "align-items": "baseline" },
    "justify-center": { "justify-content": "center" },
    "justify-between": { "justify-content": "space-between" },
    "justify-start": { "justify-content": "flex-start" },
    "justify-end": { "justify-content": "flex-end" },
    "self-center": { "align-self": "center" },
    "self-start": { "align-self": "flex-start" },
    "self-end": { "align-self": "flex-end" },
    "self-stretch": { "align-self": "stretch" },
    "shrink-0": { "flex-shrink": "0" },
    grow: { "flex-grow": "1" },
    "grow-0": { "flex-grow": "0" },
    "min-w-0": { "min-width": "0" },
    "min-h-0": { "min-height": "0" },
    "min-h-full": { "min-height": "100%" },
    "min-h-dvh": { "min-height": "100dvh" },
    "min-h-svh": { "min-height": "100svh" },
    "w-full": { width: "100%" },
    "w-fit": { width: "fit-content" },
    "w-auto": { width: "auto" },
    "w-px": { width: "var(--spacing-px)" },
    "h-full": { height: "100%" },
    "h-auto": { height: "auto" },
    "h-px": { height: "var(--spacing-px)" },
    "size-full": { width: "100%", height: "100%" },
    relative: { position: "relative" },
    absolute: { position: "absolute" },
    fixed: { position: "fixed" },
    sticky: { position: "sticky" },
    static: { position: "static" },
    isolate: { isolation: "isolate" },
    "inset-0": { inset: "0" },
    "inset-x-0": { left: "0", right: "0" },
    "inset-y-0": { top: "0", bottom: "0" },
    "top-0": { top: "0" },
    "top-1/2": { top: "50%" },
    "bottom-0": { bottom: "0" },
    "bottom-1/2": { bottom: "50%" },
    "left-0": { left: "0" },
    "left-1/2": { left: "50%" },
    "right-0": { right: "0" },
    "right-1/2": { right: "50%" },
    "pointer-events-none": { "pointer-events": "none" },
    "pointer-events-auto": { "pointer-events": "auto" },
    "select-none": { "user-select": "none" },
    "select-text": { "user-select": "text" },
    "overflow-hidden": { overflow: "hidden" },
    "overflow-auto": { overflow: "auto" },
    "overflow-visible": { overflow: "visible" },
    "overflow-x-auto": { "overflow-x": "auto" },
    "overflow-y-auto": { "overflow-y": "auto" },
    "overflow-x-hidden": { "overflow-x": "hidden" },
    "overflow-y-hidden": { "overflow-y": "hidden" },
    "resize-none": { resize: "none" },
    "overscroll-none": { "overscroll-behavior": "none" },
    "touch-none": { "touch-action": "none" },
    "cursor-pointer": { cursor: "pointer" },
    "cursor-grab": { cursor: "grab" },
    "cursor-grabbing": { cursor: "grabbing" },
    "object-cover": { "object-fit": "cover" },
    "object-contain": { "object-fit": "contain" },
    "object-center": { "object-position": "center" },
    "object-top": { "object-position": "top" },
    "object-bottom": { "object-position": "bottom" },
    "object-left": { "object-position": "left" },
    "object-right": { "object-position": "right" },
    "bg-cover": { "background-size": "cover" },
    "bg-center": { "background-position": "center" },
    "cursor-default": { cursor: "default" },
    "cursor-not-allowed": { cursor: "not-allowed" },
    "cursor-crosshair": { cursor: "crosshair" },
    "cursor-ns-resize": { cursor: "ns-resize" },
    "cursor-ew-resize": { cursor: "ew-resize" },
    "text-left": { "text-align": "left" },
    "text-center": { "text-align": "center" },
    "text-right": { "text-align": "right" },
    "text-balance": { "text-wrap": "balance" },
    "text-pretty": { "text-wrap": "pretty" },
    uppercase: { "text-transform": "uppercase" },
    capitalize: { "text-transform": "capitalize" },
    lowercase: { "text-transform": "lowercase" },
    truncate: {
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
    "whitespace-nowrap": { "white-space": "nowrap" },
    "whitespace-pre": { "white-space": "pre" },
    "whitespace-pre-line": { "white-space": "pre-line" },
    "whitespace-pre-wrap": { "white-space": "pre-wrap" },
    "list-none": { "list-style-type": "none" },
    "list-disc": { "list-style-type": "disc" },
    "list-decimal": { "list-style-type": "decimal" },
    "align-baseline": { "vertical-align": "baseline" },
    "align-top": { "vertical-align": "top" },
    "align-middle": { "vertical-align": "middle" },
    "align-bottom": { "vertical-align": "bottom" },
    "align-text-top": { "vertical-align": "text-top" },
    "align-text-bottom": { "vertical-align": "text-bottom" },
    "align-sub": { "vertical-align": "sub" },
    "align-super": { "vertical-align": "super" },
    "font-mono": {
      "font-family": "var(--df-font-mono)",
    },
    "font-sans": {
      "font-family": "var(--df-font-sans)",
    },
    "font-heading": {
      "font-family": "var(--df-font-sans)",
    },
    "tabular-nums": { "font-variant-numeric": "tabular-nums" },
    "not-italic": { "font-style": "normal" },
    italic: { "font-style": "italic" },
    "sr-only": {
      position: "absolute",
      width: "var(--spacing-px)",
      height: "var(--spacing-px)",
      padding: "0",
      margin: "calc(-1 * var(--spacing-px))",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      "white-space": "nowrap",
      "border-width": "0",
    },
    "origin-center": { "transform-origin": "center" },
    "origin-top": { "transform-origin": "top" },
    "origin-top-right": { "transform-origin": "top right" },
    "origin-right": { "transform-origin": "right" },
    "origin-bottom-right": { "transform-origin": "bottom right" },
    "origin-bottom": { "transform-origin": "bottom" },
    "origin-bottom-left": { "transform-origin": "bottom left" },
    "origin-left": { "transform-origin": "left" },
    "origin-top-left": { "transform-origin": "top left" },
    underline: { "text-decoration-line": "underline" },
    "no-underline": { "text-decoration-line": "none" },
    "underline-offset-2": {
      "text-underline-offset": "var(--df-underline-offset-sm)",
    },
    "underline-offset-3": {
      "text-underline-offset": "var(--df-underline-offset-md)",
    },
    "underline-offset-4": {
      "text-underline-offset": "var(--df-underline-offset)",
    },
    border: {
      "border-width": "var(--border-width-hairline)",
      "border-style": "solid",
    },
    "border-0": { "border-width": "0" },
    "border-2": {
      "border-width": "var(--border-width-thick)",
      "border-style": "solid",
    },
    "border-b": {
      "border-bottom-width": "var(--border-width-hairline)",
      "border-bottom-style": "solid",
    },
    "border-t": {
      "border-top-width": "var(--border-width-hairline)",
      "border-top-style": "solid",
    },
    "border-l": {
      "border-left-width": "var(--border-width-hairline)",
      "border-left-style": "solid",
    },
    "border-r": {
      "border-right-width": "var(--border-width-hairline)",
      "border-right-style": "solid",
    },
    "border-x": {
      "border-left-width": "var(--border-width-hairline)",
      "border-right-width": "var(--border-width-hairline)",
      "border-left-style": "solid",
      "border-right-style": "solid",
    },
    "border-y": {
      "border-top-width": "var(--border-width-hairline)",
      "border-bottom-width": "var(--border-width-hairline)",
      "border-top-style": "solid",
      "border-bottom-style": "solid",
    },
    "border-x-0": { "border-left-width": "0", "border-right-width": "0" },
    "border-y-0": { "border-top-width": "0", "border-bottom-width": "0" },
    "border-t-0": { "border-top-width": "0" },
    "border-b-0": { "border-bottom-width": "0" },
    "border-l-0": { "border-left-width": "0" },
    "border-r-0": { "border-right-width": "0" },
    "border-transparent": { "border-color": "transparent" },
    "rounded-none": { "border-radius": "0" },
    "rounded-full": { "border-radius": "var(--radius-full)" },
    "shadow-none": { "box-shadow": "none" },
    "ring-0": { "box-shadow": "0 0 0 0 transparent" },
    "ring-1": {
      "box-shadow":
        "0 0 0 var(--ring-width) var(--df-ring-color, var(--ring))",
    },
    "ring-4": {
      "box-shadow":
        "0 0 0 var(--ring-width-lg) var(--df-ring-color, color-mix(in oklch, var(--ring) 50%, transparent))",
    },
    outline: { "outline-style": "solid" },
    "outline-none": { outline: "none" },
    "outline-hidden": { outline: "none" },
    "outline-1": {
      "outline-width": "var(--border-width-hairline)",
      "outline-style": "solid",
    },
    antialiased: {
      "-webkit-font-smoothing": "antialiased",
      "-moz-osx-font-smoothing": "grayscale",
    },
    "transition-colors": {
      "transition-property":
        "color, background-color, border-color, text-decoration-color, fill, stroke",
      "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
      "transition-duration": "150ms",
    },
    "transition-opacity": {
      "transition-property": "opacity",
      "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
      "transition-duration": "150ms",
    },
    "transition-transform": {
      "transition-property": "transform",
      "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
      "transition-duration": "150ms",
    },
    "transition-shadow": {
      "transition-property": "box-shadow",
      "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
      "transition-duration": "150ms",
    },
    "transition-all": {
      "transition-property": "all",
      "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
      "transition-duration": "150ms",
    },
    "transition-none": { transition: "none" },
    "duration-100": { "transition-duration": "100ms" },
    "duration-150": { "transition-duration": "150ms" },
    "duration-200": { "transition-duration": "200ms" },
    "duration-300": { "transition-duration": "300ms" },
    "duration-500": { "transition-duration": "500ms" },
    "ease-in-out": {
      "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
    },
    "animate-spin": {
      animation: "df-spin var(--df-duration-spin) linear infinite",
    },
    "animate-pulse": {
      animation: "df-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    },
    "place-content-center": { "place-content": "center" },
    "aspect-square": { "aspect-ratio": "1 / 1" },
    "bg-clip-padding": { "background-clip": "padding-box" },
    "line-clamp-1": {
      overflow: "hidden",
      display: "-webkit-box",
      "-webkit-box-orient": "vertical",
      "-webkit-line-clamp": "1",
    },
    "line-clamp-2": {
      overflow: "hidden",
      display: "-webkit-box",
      "-webkit-box-orient": "vertical",
      "-webkit-line-clamp": "2",
    },
    rounded: { "border-radius": "var(--radius)" },
    "border-dashed": { "border-style": "dashed" },
    "border-collapse": { "border-collapse": "collapse" },
    "border-separate": { "border-collapse": "separate" },
    "font-bricolage": {
      "font-family": "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif",
    },
    "bg-gradient-to-t": {
      "background-image": "linear-gradient(to top, var(--df-gradient-stops))",
    },
    "bg-gradient-to-b": {
      "background-image": "linear-gradient(to bottom, var(--df-gradient-stops))",
    },
    "mt-auto": { "margin-top": "auto" },
    "mx-auto": { "margin-left": "auto", "margin-right": "auto" },
    "ml-auto": { "margin-left": "auto" },
    "will-change-transform": { "will-change": "transform" },
    "will-change-auto": { "will-change": "auto" },
    "will-change-scroll": { "will-change": "scroll-position" },
    "will-change-contents": { "will-change": "contents" },
  }

  // Theme-driven font weight / tracking / leading / shadow / blur
  for (const [k, v] of Object.entries(FONT_WEIGHT)) {
    staticMap[`font-${k}`] = { "font-weight": v }
  }
  for (const [k, v] of Object.entries(TRACKING)) {
    staticMap[`tracking-${k}`] = { "letter-spacing": v }
  }
  for (const [k, v] of Object.entries(LEADING)) {
    staticMap[`leading-${k}`] = { "line-height": v }
  }
  for (const [k, v] of Object.entries(SHADOW_COMPAT)) {
    staticMap[k === "none" ? "shadow-none" : `shadow-${k}`] = {
      "box-shadow": v,
    }
  }
  for (const [k, v] of Object.entries(BLUR)) {
    staticMap[`backdrop-blur-${k}`] = { "backdrop-filter": `blur(${v})` }
    if (k !== "none") staticMap[`blur-${k}`] = { filter: `blur(${v})` }
  }

  if (staticMap[u]) return add(staticMap[u])

  let m = u.match(/^size-(.+)$/)
  if (m) {
    const v = sizeValue(m[1])
    if (v) return add({ width: v, height: v })
  }

  m = u.match(/^w-(.+)$/)
  if (m) {
    const v = sizeValue(m[1]) ?? MAX_W[m[1]]
    if (v) return add({ width: v })
    if (m[1] === "52") return add({ width: "13rem" })
  }
  m = u.match(/^h-(.+)$/)
  if (m) {
    const v = sizeValue(m[1])
    if (v) return add({ height: v })
  }
  m = u.match(/^min-w-(.+)$/)
  if (m) {
    const v = sizeValue(m[1])
    if (v) return add({ "min-width": v })
  }
  m = u.match(/^max-w-(.+)$/)
  if (m) {
    const v = MAX_W[m[1]] ?? sizeValue(m[1])
    if (v) return add({ "max-width": v })
  }
  m = u.match(/^min-h-(.+)$/)
  if (m) {
    const v = sizeValue(m[1])
    if (v) return add({ "min-height": v })
  }
  m = u.match(/^max-h-(.+)$/)
  if (m) {
    const v = sizeValue(m[1])
    if (v) return add({ "max-height": v })
  }

  m = u.match(
    /^-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap-x|gap-y|gap|scroll-mt|scroll-mb|top|bottom|left|right)-(.+)$/
  )
  if (m) {
    const [, prop, raw] = m
    const neg = u.startsWith("-") || raw.startsWith("-")
    const key = raw.startsWith("-") ? raw.slice(1) : raw
    let v = spacing(key)
    if (v != null) {
      if (neg && v !== "auto") v = `calc(${v} * -1)`
      const map = {
        p: { padding: v },
        px: { "padding-left": v, "padding-right": v },
        py: { "padding-top": v, "padding-bottom": v },
        pt: { "padding-top": v },
        pb: { "padding-bottom": v },
        pl: { "padding-left": v },
        pr: { "padding-right": v },
        m: { margin: v },
        mx: { "margin-left": v, "margin-right": v },
        my: { "margin-top": v, "margin-bottom": v },
        mt: { "margin-top": v },
        mb: { "margin-bottom": v },
        ml: { "margin-left": v },
        mr: { "margin-right": v },
        gap: { gap: v },
        "gap-x": { "column-gap": v },
        "gap-y": { "row-gap": v },
        "scroll-mt": { "scroll-margin-top": v },
        "scroll-mb": { "scroll-margin-bottom": v },
        top: { top: v },
        bottom: { bottom: v },
        left: { left: v },
        right: { right: v },
      }
      if (map[prop]) return add(map[prop])
    }
  }

  m = u.match(/^text-(.+)$/)
  if (m) {
    const rest = m[1]
    if (FONT_SIZE[rest]) {
      const [fs, lh] = FONT_SIZE[rest]
      return add({ "font-size": fs, "line-height": lh })
    }
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb) {
      const { hint, value: val } = parseTypedArbitrary(arb[1])
      // text-[length:var(--x)] → font-size; text-[color:var(--x)] → color
      if (
        hint === "length" ||
        hint === "percentage" ||
        hint === "absolute-size" ||
        hint === "relative-size" ||
        hint === "line-width"
      ) {
        return add({ "font-size": val })
      }
      if (hint === "color") return add({ color: val })
      // text-[11px] → font-size; text-[#fff] / text-[var(--c)] → color
      if (
        val.startsWith("#") ||
        val.startsWith("oklch") ||
        val.startsWith("rgb") ||
        val.startsWith("hsl") ||
        val.startsWith("var(") ||
        val.startsWith("color-mix")
      ) {
        return add({ color: val })
      }
      return add({ "font-size": val })
    }
    const c = parseColorToken(rest)
    if (c) return add({ color: c })
  }

  m = u.match(/^bg-(.+)$/)
  if (m) {
    const rest = m[1]
    if (rest.startsWith("gradient-")) return null
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb) {
      const val = decodeArbitrary(arb[1])
      if (isGradientOrImage(val)) {
        // Use `background` so multi-layer gradients + solid fallbacks work.
        return add({ background: val })
      }
      return add({ "background-color": val })
    }
    const c = parseColorToken(rest)
    if (c) return add({ "background-color": c })
  }

  m = u.match(/^border-(.+)$/)
  if (m) {
    const rest = m[1]
    if (["t", "b", "l", "r", "x", "y", "0", "2", "4", "8"].includes(rest))
      return null
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb) {
      const val = decodeArbitrary(arb[1])
      // Lengths → border-width; colors → border-color
      if (/^-?[\d.]+(?:px|rem|em|%)?$/i.test(val)) {
        return add({
          "border-width": /[a-z%]/i.test(val) ? val : `${val}px`,
          "border-style": "solid",
        })
      }
      return add({ "border-color": val })
    }
    const c = parseColorToken(rest)
    if (c) return add({ "border-color": c })
  }

  m = u.match(/^ring-(.+)$/)
  if (m) {
    const rest = m[1]
    if (["0", "1", "2", "4", "8"].includes(rest)) {
      return add({
        "box-shadow": `0 0 0 ${rest === "0" ? "0" : rest + "px"} var(--df-ring-color, color-mix(in oklch, var(--ring) 50%, transparent))`,
      })
    }
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb && /^\d/.test(arb[1])) {
      return add({
        "box-shadow": `0 0 0 ${decodeArbitrary(arb[1])} var(--df-ring-color, color-mix(in oklch, var(--ring) 50%, transparent))`,
      })
    }
    const c = parseColorToken(rest)
    if (c)
      return add({
        "--df-ring-color": c,
        "box-shadow": `0 0 0 var(--ring-width) ${c}`,
      })
  }

  // outline-offset before outline- so "outline-offset-*" is not parsed as a color.
  m = u.match(/^outline-offset-(.+)$/)
  if (m) {
    const rest = m[1]
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb) {
      const { value } = parseTypedArbitrary(arb[1])
      return add({ "outline-offset": value })
    }
    const spaced = spacing(rest)
    if (spaced != null) return add({ "outline-offset": spaced })
  }

  m = u.match(/^outline-(.+)$/)
  if (m) {
    const rest = m[1]
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb) {
      const { hint, value } = parseTypedArbitrary(arb[1])
      if (
        hint === "length" ||
        hint === "line-width" ||
        hint === "percentage"
      ) {
        return add({
          "outline-width": value,
          "outline-style": "solid",
        })
      }
      if (hint === "color") {
        return add({ "outline-color": value })
      }
    }
    const c = parseColorToken(rest)
    if (c) return add({ "outline-color": c })
  }

  m = u.match(/^order-(.+)$/)
  if (m) {
    const rest = m[1]
    if (rest === "none") return add({ order: "0" })
    if (rest === "first") return add({ order: "-9999" })
    if (rest === "last") return add({ order: "9999" })
    if (/^-?\d+$/.test(rest)) return add({ order: rest })
  }

  m = u.match(/^fill-(.+)$/)
  if (m) {
    const c = parseColorToken(m[1])
    if (c) return add({ fill: c })
  }

  m = u.match(/^stroke-(.+)$/)
  if (m) {
    const c = parseColorToken(m[1])
    if (c) return add({ stroke: c })
  }

  m = u.match(/^accent-(.+)$/)
  if (m) {
    const c = parseColorToken(m[1])
    if (c) return add({ "accent-color": c })
  }

  m = u.match(/^decoration-(.+)$/)
  if (m) {
    const c = parseColorToken(m[1])
    if (c) return add({ "text-decoration-color": c })
  }

  m = u.match(/^from-(.+)$/)
  if (m) {
    const c = parseColorToken(m[1])
    if (c)
      return add({
        "--df-gradient-from": c,
        "--df-gradient-stops":
          "var(--df-gradient-from), var(--df-gradient-to, transparent)",
      })
  }
  m = u.match(/^via-(.+)$/)
  if (m) {
    const c = parseColorToken(m[1])
    if (c)
      return add({
        "--df-gradient-via": c,
        "--df-gradient-stops":
          "var(--df-gradient-from), var(--df-gradient-via), var(--df-gradient-to, transparent)",
      })
  }
  m = u.match(/^to-(.+)$/)
  if (m) {
    const c = parseColorToken(m[1])
    if (c) return add({ "--df-gradient-to": c })
  }

  m = u.match(/^rounded-(.+)$/)
  if (m) {
    const rest = m[1]
    if (RADIUS[rest]) return add({ "border-radius": RADIUS[rest] })
    const side = rest.match(/^(t|b|l|r|tl|tr|bl|br)-(.+)$/)
    if (side) {
      const rad =
        RADIUS[side[2]] ??
        (side[2].match(/^\[(.+)\]$/)
          ? decodeArbitrary(side[2].slice(1, -1))
          : null)
      if (rad) {
        const map = {
          t: {
            "border-top-left-radius": rad,
            "border-top-right-radius": rad,
          },
          b: {
            "border-bottom-left-radius": rad,
            "border-bottom-right-radius": rad,
          },
          l: {
            "border-top-left-radius": rad,
            "border-bottom-left-radius": rad,
          },
          r: {
            "border-top-right-radius": rad,
            "border-bottom-right-radius": rad,
          },
          tl: { "border-top-left-radius": rad },
          tr: { "border-top-right-radius": rad },
          bl: { "border-bottom-left-radius": rad },
          br: { "border-bottom-right-radius": rad },
        }
        if (map[side[1]]) return add(map[side[1]])
      }
    }
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb) return add({ "border-radius": decodeArbitrary(arb[1]) })
  }

  m = u.match(/^opacity-(.+)$/)
  if (m) {
    const arb = m[1].match(/^\[(.+)\]$/)
    if (arb) return add({ opacity: decodeArbitrary(arb[1]) })
    if (/^\d+$/.test(m[1])) return add({ opacity: String(Number(m[1]) / 100) })
  }

  m = u.match(/^z-(.+)$/)
  if (m) {
    const arb = m[1].match(/^\[(.+)\]$/)
    if (arb) return add({ "z-index": decodeArbitrary(arb[1]) })
    if (/^\d+$/.test(m[1]) || m[1] === "auto") return add({ "z-index": m[1] })
  }

  m = u.match(/^shadow-\[(.+)\]$/)
  if (m) return add({ "box-shadow": decodeArbitrary(m[1]) })

  m = u.match(/^grid-cols-(.+)$/)
  if (m) {
    const rest = m[1]
    if (/^\d+$/.test(rest))
      return add({
        "grid-template-columns": `repeat(${rest}, minmax(0, 1fr))`,
      })
    const arb = rest.match(/^\[(.+)\]$/)
    if (arb)
      return add({ "grid-template-columns": decodeArbitrary(arb[1]) })
  }

  m = u.match(/^col-span-(.+)$/)
  if (m) {
    const rest = m[1]
    if (rest === "full") return add({ "grid-column": "1 / -1" })
    if (/^\d+$/.test(rest)) return add({ "grid-column": `span ${rest} / span ${rest}` })
  }

  m = u.match(/^aspect-\[(.+)\]$/)
  if (m) return add({ "aspect-ratio": decodeArbitrary(m[1]) })

  m = u.match(/^tracking-\[(.+)\]$/)
  if (m) return add({ "letter-spacing": decodeArbitrary(m[1]) })

  m = u.match(/^align-\[(.+)\]$/)
  if (m) return add({ "vertical-align": decodeArbitrary(m[1]) })

  m = u.match(/^ease-\[(.+)\]$/)
  if (m) return add({ "transition-timing-function": decodeArbitrary(m[1]) })

  m = u.match(/^transition-\[(.+)\]$/)
  if (m) {
    return add({
      "transition-property": decodeArbitrary(m[1]),
      "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
      "transition-duration": "150ms",
    })
  }

  // Translate, rotate, and scale must share one composed transform so classes
  // from kit and app CSS can stack on the same element without overwriting.
  const DF_TRANSFORM =
    "translate(var(--df-translate-x, 0), var(--df-translate-y, 0)) rotate(var(--df-rotate, 0deg)) scale(var(--df-scale, 1))"

  m = u.match(/^scale-\[(.+)\]$/)
  if (m) {
    return add({
      "--df-scale": decodeArbitrary(m[1]),
      transform: DF_TRANSFORM,
    })
  }
  m = u.match(/^scale-(.+)$/)
  if (m && /^\d+$/.test(m[1])) {
    return add({
      "--df-scale": String(Number(m[1]) / 100),
      transform: DF_TRANSFORM,
    })
  }

  m = u.match(/^-?rotate-(.+)$/)
  if (m) {
    const neg = u.startsWith("-")
    const rest = m[1]
    const arb = rest.match(/^\[(.+)\]$/)
    const deg = arb ? decodeArbitrary(arb[1]) : `${rest}deg`
    return add({
      "--df-rotate": `${neg ? "-" : ""}${deg}`,
      transform: DF_TRANSFORM,
    })
  }

  m = u.match(/^-?translate-([xy])-(.+)$/)
  if (m) {
    const neg = u.startsWith("-")
    const axis = m[1]
    let v = spacing(m[2])
    if (m[2] === "1/2") v = "50%"
    if (m[2] === "full") v = "100%"
    const arb = m[2].match(/^\[(.+)\]$/)
    if (arb) v = decodeArbitrary(arb[1])
    if (v != null) {
      if (neg) v = `calc(${v} * -1)`
      const varName = axis === "x" ? "--df-translate-x" : "--df-translate-y"
      return add({
        [varName]: v,
        transform: DF_TRANSFORM,
      })
    }
  }

  m = u.match(/^backdrop-blur-\[(.+)\]$/)
  if (m) return add({ "backdrop-filter": `blur(${decodeArbitrary(m[1])})` })

  // Axis insets (parity with px/py and left/right pairs). Static inset-x-0 /
  // inset-y-0 remain for the zero case; scale steps resolve here.
  m = u.match(/^inset-([xy])-(.+)$/)
  if (m) {
    const axis = m[1]
    const v = spacing(m[2])
    if (v != null) {
      return add(
        axis === "x" ? { left: v, right: v } : { top: v, bottom: v }
      )
    }
  }

  m = u.match(/^inset-(.+)$/)
  if (m) {
    const v = spacing(m[1])
    if (v != null) return add({ inset: v })
  }

  // writing-mode arbitrary
  m = u.match(/^\[writing-mode:(.+)\]$/)
  if (m) return add({ "writing-mode": decodeArbitrary(m[1]) })

  if (u === "@container") return add({ "container-type": "inline-size" })

  return null
}

function splitVariants(token) {
  const variants = []
  let rest = token

  while (true) {
    const m = rest.match(
      new RegExp(
        `^(${RESPONSIVE_VARIANT_PATTERN}|hover|focus|focus-visible|focus-within|active|disabled|first|last|before|after|motion-safe|motion-reduce|group-hover|group-focus-visible|peer-disabled|placeholder|file|data-open|data-closed|data-checked|data-unchecked|data-disabled|data-horizontal|data-vertical|data-placeholder|aria-invalid|aria-expanded|aria-pressed|aria-disabled|supports-backdrop-filter):(.+)$`
      )
    )
    if (!m) break
    variants.push(m[1])
    rest = m[2]
  }

  while (true) {
    const m = rest.match(
      /^(group-data-\[[^\]]+\](?:\/[a-z0-9-]+)?|group-data-[a-z0-9-]+(?:\/[a-z0-9-]+)?|data-\[[^\]]+\]|data-[a-z0-9-]+|has-data-\[[^\]]+\]|aria-\[[^\]]+\]|\[&[^\]]+\]):(.*)$/
    )
    if (!m) break
    variants.push(m[1])
    rest = m[2]
  }
  return { variants, utility: rest }
}

function queryKey(query) {
  return `${query.type}:${query.feature}`
}

function selectorFor(token, variants) {
  let sel = `.${escapeClass(token)}`
  const suffix = []
  let wrapDark = false
  let query = null
  let motionSafe = false

  for (const v of variants) {
    if (v === "dark") wrapDark = true
    else if (VIEWPORT_MAX_VARIANTS.has(v)) {
      query = {
        type: "media",
        feature: `(max-width: ${breakpointMaxWidth(v.slice(4))})`,
      }
    } else if (BREAKPOINTS[v]) {
      query = { type: "media", feature: `(min-width: ${BREAKPOINTS[v]})` }
    } else if (CONTAINER_MIN_VARIANTS.has(v)) {
      query = {
        type: "container",
        feature: `(min-width: ${BREAKPOINTS[v.slice(1)]})`,
      }
    } else if (v === "hover") suffix.push(":hover")
    else if (v === "focus") suffix.push(":focus")
    else if (v === "focus-visible") suffix.push(":focus-visible")
    else if (v === "focus-within") suffix.push(":focus-within")
    else if (v === "active") suffix.push(":active")
    else if (v === "disabled") suffix.push(":disabled")
    else if (v === "first") suffix.push(":first-child")
    else if (v === "last") suffix.push(":last-child")
    else if (v === "placeholder") suffix.push("::placeholder")
    else if (v === "before") suffix.push("::before")
    else if (v === "after") suffix.push("::after")
    else if (v === "file") suffix.push("::file-selector-button")
    else if (v === "motion-safe") motionSafe = true
    else if (v === "group-hover") sel = `.group:hover .${escapeClass(token)}`
    else if (v === "group-focus-visible")
      sel = `.group:focus-visible .${escapeClass(token)}`
    else if (v === "peer-disabled")
      sel = `.peer:disabled ~ .${escapeClass(token)}`
    else if (v.startsWith("data-[")) {
      // data-[active=true] -> [data-active=true]
      const inner = v.slice("data-[".length, -1)
      suffix.push(`[data-${inner}]`)
    } else if (v.startsWith("data-")) {
      suffix.push(`[${v}]`)
    } else if (v.startsWith("aria-[")) {
      // aria-[invalid] -> [aria-invalid]
      const inner = v.slice("aria-[".length, -1)
      suffix.push(`[aria-${inner}]`)
    } else if (v.startsWith("aria-")) {
      suffix.push(`[${v}="true"]`)
    } else if (v.startsWith("group-data-")) {
      const g = v.match(
        /^group-data-(?:\[([^\]]+)\]|([a-z0-9-]+))(?:\/([a-z0-9-]+))?$/
      )
      if (g) {
        const attr = g[1] ? `data-${g[1]}` : `data-${g[2]}`
        const groupName = g[3] ? `group\\/${g[3]}` : "group"
        sel = `.${groupName}[${attr}] .${escapeClass(token)}`
      }
    } else if (v.startsWith("has-data-[")) {
      const inner = v.slice("has-data-[".length, -1)
      suffix.push(`:has([data-${inner}])`)
    } else if (v.startsWith("[&")) {
      const inner = v.slice(1, -1)
      sel = `.${escapeClass(token)}${inner.replace(/^&/, "")}`
    }
  }

  if (suffix.length) {
    if (!sel.includes(" ")) sel = `${sel}${suffix.join("")}`
    else {
      const parts = sel.split(" ")
      parts[parts.length - 1] += suffix.join("")
      sel = parts.join(" ")
    }
  }

  if (wrapDark) sel = `.dark ${sel}`
  return { sel, query, motionSafe }
}

function formatRule(sel, decls) {
  const body = Object.entries(decls)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")
  return `${sel} {\n${body}\n}`
}

function collectClasses(dirs) {
  const set = new Set()
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const src = fs.readFileSync(file, "utf8")
      for (const c of extractClasses(src)) set.add(c)
    }
  }
  return set
}

/** Class tokens used by kit components in a repository checkout. */
function collectKitClasses() {
  const set = new Set()
  for (const file of walk(path.join(KIT_ROOT, "src"))) {
    if (!file.includes(`${path.sep}components${path.sep}`)) continue
    for (const c of extractClasses(fs.readFileSync(file, "utf8"))) set.add(c)
  }
  return set
}

/** Class tokens covered by the stylesheet that shipped with the package. */
function readShippedKitClasses() {
  if (!fs.existsSync(KIT_CLASS_LIST_OUT)) {
    console.error(
      [
        "DF utility generator: kit component sources are unavailable and",
        `${KIT_CLASS_LIST_OUT} is missing, so the covered class list is unknown.`,
        "Install a @default-file/ui release that ships that file.",
      ].join("\n"),
    )
    process.exit(1)
  }
  return new Set(JSON.parse(fs.readFileSync(KIT_CLASS_LIST_OUT, "utf8")))
}

/**
 * Product tokens that live outside className= and cn() scans, plus class name
 * prefixes the product styles itself and the kit must not try to resolve.
 */
async function readAppExtras() {
  const none = { classes: [], ignoredPrefixes: [] }
  if (!APP_EXTRA_CLASSES || !fs.existsSync(APP_EXTRA_CLASSES)) return none

  const loaded = await import(pathToFileURL(APP_EXTRA_CLASSES).href)
  const classes = loaded.APP_EXTRA_CLASSES ?? []
  const ignoredPrefixes = loaded.APP_IGNORED_PREFIXES ?? []
  if (!Array.isArray(classes) || !Array.isArray(ignoredPrefixes)) {
    console.error(
      `DF utility generator: ${APP_EXTRA_CLASSES} must export APP_EXTRA_CLASSES and APP_IGNORED_PREFIXES as arrays.`,
    )
    process.exit(1)
  }
  return { classes, ignoredPrefixes }
}

const kitClasses = HAS_KIT_SOURCES
  ? collectKitClasses()
  : readShippedKitClasses()

const appExtras = await readAppExtras()
const appIgnoredPrefixes = appExtras.ignoredPrefixes

const appClasses = APP_SRC ? collectClasses([APP_SRC]) : new Set()
for (const token of appExtras.classes) appClasses.add(token)


kitClasses.add("@container")

const animMap = {
  "animate-in": { animation: "df-enter 150ms ease-out" },
  "animate-out": { animation: "df-exit 100ms ease-in forwards" },
  "fade-in-0": { "--df-enter-opacity": "0" },
  "fade-out-0": { "--df-exit-opacity": "0" },
  "fade-in": { "--df-enter-opacity": "0" },
  "zoom-in-95": { "--df-enter-scale": "0.95" },
  "zoom-out-95": { "--df-exit-scale": "0.95" },
  "slide-in-from-top-2": { "--df-enter-translate-y": "-0.5rem" },
  "slide-in-from-bottom-2": { "--df-enter-translate-y": "0.5rem" },
  "slide-in-from-left-2": { "--df-enter-translate-x": "-0.5rem" },
  "slide-in-from-right-2": { "--df-enter-translate-x": "0.5rem" },
}

function sortQueryEntries(entries) {
  return entries.sort((a, b) => {
    const rank = (key) => {
      const type = key.startsWith("container:") ? "container" : "media"
      const feature = key.slice(key.indexOf(":") + 1)
      const min = feature.match(/min-width:\s*(\d+)px/)
      const max = feature.match(/max-width:\s*(\d+)px/)
      const group = type === "container" ? 2 : max ? 1 : 0
      const px = min ? Number(min[1]) : max ? Number(max[1]) : 0
      return group * 100000 + px
    }
    return rank(a[0]) - rank(b[0])
  })
}

function buildUtilities(tokenSet) {
  const baseRules = []
  const queryRules = new Map()
  const unresolved = []

  for (const token of [...tokenSet].sort()) {
    if (token.startsWith("group/") || token === "group" || token === "peer")
      continue

    const { variants, utility } = splitVariants(token)
    let decls = declsFor(utility)
    if (!decls && animMap[utility]) decls = animMap[utility]
    if (!decls) {
      unresolved.push(token)
      continue
    }

    const { sel, query, motionSafe } = selectorFor(token, variants)
    let rule = formatRule(sel, decls)
    if (motionSafe) {
      rule = `@media (prefers-reduced-motion: no-preference) {\n${rule}\n}`
    }
    if (query) {
      const key = queryKey(query)
      if (!queryRules.has(key)) queryRules.set(key, [])
      queryRules.get(key).push(rule)
    } else {
      baseRules.push(rule)
    }
  }

  let css = baseRules.join("\n\n") + "\n"
  const mediaEntries = sortQueryEntries([...queryRules.entries()])
  for (const [key, rules] of mediaEntries) {
    const type = key.startsWith("container:") ? "container" : "media"
    const feature = key.slice(key.indexOf(":") + 1)
    css += `\n@${type} ${feature} {\n${rules.join("\n\n")}\n}\n`
  }

  const ruleCount =
    baseRules.length +
    [...queryRules.values()].reduce((a, b) => a + b.length, 0)

  return { css, unresolved, mediaEntries, ruleCount }
}

// App file = product tokens not already covered by the kit utilities file.
const appOnlyClasses = new Set(
  [...appClasses].filter((token) => !kitClasses.has(token))
)

const kitBuild = buildUtilities(kitClasses)
const appBuild = buildUtilities(appOnlyClasses)

// --- Invariants (fail the build if grammar/cascade regresses) ---
const invariantErrors = []

const text11 = declsFor("text-[11px]")
if (!text11 || text11["font-size"] !== "11px" || text11.color) {
  invariantErrors.push(
    `text-[11px] must emit font-size:11px (got ${JSON.stringify(text11)})`
  )
}
const text10 = declsFor("text-[10px]")
if (!text10 || text10["font-size"] !== "10px" || text10.color) {
  invariantErrors.push(
    `text-[10px] must emit font-size:10px (got ${JSON.stringify(text10)})`
  )
}
const textLenVar = declsFor("text-[length:var(--df-text-relative-sm)]")
if (
  !textLenVar ||
  textLenVar["font-size"] !== "var(--df-text-relative-sm)" ||
  textLenVar.color
) {
  invariantErrors.push(
    `text-[length:var(--…)] must strip the length hint (got ${JSON.stringify(textLenVar)})`
  )
}
const textZinc = declsFor("text-zinc-600")
if (!textZinc || textZinc.color !== "var(--df-neutral-600)") {
  invariantErrors.push(
    `text-zinc-600 must use var(--df-neutral-600) (got ${JSON.stringify(textZinc)})`
  )
}
const textNeutral = declsFor("text-neutral-400")
if (!textNeutral || textNeutral.color !== "var(--df-neutral-400)") {
  invariantErrors.push(
    `text-neutral-400 must use var(--df-neutral-400) (got ${JSON.stringify(textNeutral)})`
  )
}

const composedTransform =
  "translate(var(--df-translate-x, 0), var(--df-translate-y, 0)) rotate(var(--df-rotate, 0deg)) scale(var(--df-scale, 1))"
for (const token of ["-translate-x-1/2", "rotate-45", "scale-110"]) {
  const decls = declsFor(token)
  if (!decls || decls.transform !== composedTransform) {
    invariantErrors.push(
      `${token} must emit composed transform (got ${JSON.stringify(decls?.transform)})`
    )
  }
}

for (const { mediaEntries, label } of [
  { mediaEntries: kitBuild.mediaEntries, label: "kit" },
  { mediaEntries: appBuild.mediaEntries, label: "app" },
]) {
  let lastMinMediaPx = 0
  for (const [key] of mediaEntries) {
    if (!key.startsWith("media:")) continue
    const m = key.match(/min-width:\s*(\d+)px/)
    if (!m) continue
    const px = Number(m[1])
    if (px < lastMinMediaPx) {
      invariantErrors.push(
        `${label} media min-width queries must be ascending (saw ${px}px after ${lastMinMediaPx}px)`
      )
    }
    lastMinMediaPx = px
  }
}

const realUnresolved = [...kitBuild.unresolved, ...appBuild.unresolved].filter(
  (token) => {
    const { utility } = splitVariants(token)
    if (NON_UTILITY_ALLOWLIST.has(utility)) return false
    if (utility.startsWith("df-")) return false
    if (utility.startsWith("group/")) return false
    if (appIgnoredPrefixes.some((prefix) => utility.startsWith(prefix)))
      return false
    return true
  }
)

if (realUnresolved.length) {
  invariantErrors.push(
    `Unresolved utility classes (${realUnresolved.length}): ${realUnresolved.slice(0, 20).join(", ")}${realUnresolved.length > 20 ? "…" : ""}`
  )
}

if (invariantErrors.length) {
  console.error("DF utility generator invariants failed:")
  for (const err of invariantErrors) console.error("  -", err)
  process.exit(1)
}

function writeFile(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, contents)
}

const written = []
for (const target of KIT_OUT_TARGETS) {
  try {
    writeFile(target, kitBuild.css)
    written.push(target)
  } catch (err) {
    console.warn(
      `Could not write kit utilities to ${target}: ${err instanceof Error ? err.message : err}`
    )
  }
}

// Consumers without component sources read this list to know what the kit covers.
if (HAS_KIT_SOURCES) {
  writeFile(
    KIT_CLASS_LIST_OUT,
    `${JSON.stringify([...kitClasses].sort(), null, 2)}\n`
  )
  written.push(KIT_CLASS_LIST_OUT)
}

if (APP_UTILITIES_OUT) {
  try {
    writeFile(APP_UTILITIES_OUT, appBuild.css)
    written.push(APP_UTILITIES_OUT)
  } catch (err) {
    console.error(
      `Could not write app utilities to ${APP_UTILITIES_OUT}: ${err instanceof Error ? err.message : err}`
    )
    process.exit(1)
  }
}

const kitSource = HAS_KIT_SOURCES
  ? "kit components"
  : "shipped class list (kit CSS left untouched)"
const summary = [
  "df:utilities",
  `  kit source: ${kitSource}`,
  `  kit tokens: ${kitClasses.size} (rules ${kitBuild.ruleCount})`,
]
if (APP_ROOT) {
  summary.push(
    `  app-only tokens: ${appOnlyClasses.size} (rules ${appBuild.ruleCount})`
  )
}
summary.push(`  unresolved: ${realUnresolved.length}`)
console.log(summary.join("\n"))
for (const target of written) console.log(`  wrote: ${target}`)
if (realUnresolved.length) console.log("Unresolved:", realUnresolved.join(", "))
