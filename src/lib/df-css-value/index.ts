/**
 * CSS value sanitizers for interpolation into declarations and custom properties.
 *
 * Color grammar (accepted):
 * - hex (#rgb, #rgba, #rrggbb, #rrggbbaa)
 * - named CSS colors from the kit allowlist, plus transparent and currentcolor
 * - color functions: rgb, rgba, hsl, hsla, hwb, lab, lch, oklab, oklch, color,
 *   color-mix, var. Every function name in the value must be on that list; the
 *   call must be a single balanced top-level expression; characters must stay in
 *   the color safe alphabet.
 *
 * Length grammar (accepted):
 * - plain lengths with units (px, rem, em, %, vh, vw, ch)
 * - length functions: calc, var, clamp, min, max. Every function name in the
 *   value must be on that list; same single-call and nesting rules as colors;
 *   characters must stay in the length safe alphabet (includes * for calc).
 *
 * Bare HSL channel triplets (e.g. 210 40 98) are not CSS colors. Parse them with
 * parseCssHslChannelTriplet and compose hsl(...) at the call site.
 *
 * Rejected by policy (not an exhaustive CSS parser):
 * - anything that can terminate or extend a declaration (; { })
 * - comment delimiters, quotes, backslashes, angle brackets, at-rules, colons
 * - url( and expression( (resource load / legacy script vectors)
 * - unbalanced or trailing junk after a function call
 * - any function name not on the relevant allowlist, nested or top-level
 *
 * CSS.supports is not used: this must be correct during SSR and render.
 */

const UNSAFE_CSS =
  /[;{}<>\\"'`]|\/\*|\*\/|@|:|\n|\r|\f|url\s*\(|expression\s*\(/i

/** Letters, digits, whitespace, and the tokens modern color functions need. */
const COLOR_SAFE_CHARS = /^[a-zA-Z0-9_\s#%,./()+-]+$/

/**
 * Length expressions need arithmetic operators. Includes * for calc products;
 * omits # because hex is not a length token.
 */
const LENGTH_SAFE_CHARS = /^[a-zA-Z0-9_\s%,./()*+-]+$/

const HEX_COLOR =
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/**
 * Bare space-separated HSL channels for call sites that compose hsl(...).
 * Digits and dots only; no units, signs, or punctuation.
 */
const COLOR_CHANNEL_TRIPLET = /^([\d.]+)\s+([\d.]+)\s+([\d.]+)$/

const COLOR_FUNCTION_NAMES = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "var",
])

const LENGTH_FUNCTION_NAMES = new Set([
  "calc",
  "var",
  "clamp",
  "min",
  "max",
])

const LENGTH_VALUE =
  /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vh|vw|ch)$/i

const NAMED_COLORS = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
  "cyan",
  "magenta",
  "lime",
  "navy",
  "teal",
  "olive",
  "maroon",
  "silver",
  "gold",
  "indigo",
  "violet",
  "brown",
  "coral",
  "crimson",
  "darkblue",
  "darkgray",
  "darkgrey",
  "darkgreen",
  "darkred",
  "lightblue",
  "lightgray",
  "lightgrey",
  "lightgreen",
  "lightyellow",
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "blanchedalmond",
  "blueviolet",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "cornflowerblue",
  "cornsilk",
  "darkcyan",
  "darkgoldenrod",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "goldenrod",
  "greenyellow",
  "honeydew",
  "hotpink",
  "indianred",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "limegreen",
  "linen",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "oldlace",
  "olivedrab",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "plum",
  "powderblue",
  "rebeccapurple",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "thistle",
  "tomato",
  "turquoise",
  "wheat",
  "whitesmoke",
  "yellowgreen",
])

function hasBalancedParens(value: string): boolean {
  let depth = 0
  for (const char of value) {
    if (char === "(") depth += 1
    else if (char === ")") {
      depth -= 1
      if (depth < 0) return false
    }
  }
  return depth === 0
}

/** True when the value is one top-level function call with balanced nesting. */
function isSingleFunctionCall(value: string): boolean {
  const open = value.indexOf("(")
  if (open <= 0 || !value.endsWith(")")) return false
  let depth = 0
  for (let i = open; i < value.length; i += 1) {
    const char = value[i]
    if (char === "(") depth += 1
    else if (char === ")") {
      depth -= 1
      if (depth === 0) return i === value.length - 1
      if (depth < 0) return false
    }
  }
  return false
}

/** True when every `name(` in the value is on the given allowlist. */
function allFunctionNamesAllowed(
  value: string,
  allowed: ReadonlySet<string>
): boolean {
  const functionName = /([a-zA-Z_][\w-]*)\s*\(/g
  let match = functionName.exec(value)
  if (match == null) return false
  while (match != null) {
    const name = match[1]!.toLowerCase()
    if (!allowed.has(name)) return false
    match = functionName.exec(value)
  }
  return true
}

export type CssHslChannelTriplet = {
  h: number
  s: number
  l: number
}

/**
 * Parse a bare three-number HSL channel triplet used before composing hsl(...).
 * Returns null when the value is not exactly three non-negative finite numbers.
 */
export function parseCssHslChannelTriplet(
  value: string
): CssHslChannelTriplet | null {
  const match = COLOR_CHANNEL_TRIPLET.exec(value.trim())
  if (match == null) return null
  const h = Number.parseFloat(match[1]!)
  const s = Number.parseFloat(match[2]!)
  const l = Number.parseFloat(match[3]!)
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) {
    return null
  }
  return { h, s, l }
}

/**
 * Accept a value that is valid in a CSS color position, or null when unsafe.
 * Bare channel triplets are not CSS colors; use parseCssHslChannelTriplet.
 */
export function sanitizeCssColor(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (UNSAFE_CSS.test(trimmed)) return null
  if (HEX_COLOR.test(trimmed)) return trimmed
  if (trimmed.includes("(")) {
    if (!COLOR_SAFE_CHARS.test(trimmed)) return null
    if (!isSingleFunctionCall(trimmed)) return null
    if (!hasBalancedParens(trimmed)) return null
    if (!allFunctionNamesAllowed(trimmed, COLOR_FUNCTION_NAMES)) return null
    return trimmed
  }
  if (NAMED_COLORS.has(trimmed.toLowerCase())) return trimmed
  return null
}

/**
 * Accept a value that is valid in a CSS length position, or null when unsafe.
 */
export function sanitizeCssLength(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (UNSAFE_CSS.test(trimmed)) return null
  if (LENGTH_VALUE.test(trimmed)) return trimmed
  if (trimmed.includes("(")) {
    if (!LENGTH_SAFE_CHARS.test(trimmed)) return null
    if (!isSingleFunctionCall(trimmed)) return null
    if (!hasBalancedParens(trimmed)) return null
    if (!allFunctionNamesAllowed(trimmed, LENGTH_FUNCTION_NAMES)) return null
    return trimmed
  }
  return null
}
