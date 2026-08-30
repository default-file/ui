/**
 * Resolve CSS custom-property lengths and check geometry contracts.
 * Pure ESM: no side effects on import, no process or console I/O.
 */

const ROOT_PX = 16

const GEOMETRY_PROPS = new Set([
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "max-height",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "padding-block",
  "padding-block-start",
  "padding-block-end",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "inset",
  "inset-inline",
  "inset-inline-start",
  "inset-inline-end",
  "inset-block",
  "inset-block-start",
  "inset-block-end",
  "top",
  "right",
  "bottom",
  "left",
  "gap",
  "row-gap",
  "column-gap",
  "translate",
  "transform",
])

/** Token-name categories excluded from whole-pixel geometry checks. */
export const NON_GEOMETRY_TOKEN_RULE =
  "Excluded by name: radius, duration, z-index, opacity, and font-weight tokens. Excluded by unit: non-length values (skipped during resolve)."

const NON_GEOMETRY_NAME_RE =
  /(^|--|-)(radius|duration|opacity|font-weight)(-|$)|(^|--)z(-|$)|-z$/i

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isNonGeometryTokenName(name) {
  return NON_GEOMETRY_NAME_RE.test(name)
}

/**
 * @param {string} cssText
 * @returns {string}
 */
function stripComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, "")
}

/**
 * @param {string} cssText
 * @returns {{ selector: string, body: string }[]}
 */
function parseDeclaringBlocks(cssText) {
  const text = stripComments(cssText)
  const blocks = []
  let i = 0
  const n = text.length

  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++
    if (i >= n) break

    if (text[i] === "@") {
      while (i < n && text[i] !== "{" && text[i] !== ";") i++
      if (i >= n) break
      if (text[i] === ";") {
        i++
        continue
      }
      let depth = 0
      do {
        if (text[i] === "{") depth++
        else if (text[i] === "}") depth--
        i++
      } while (i < n && depth > 0)
      continue
    }

    const selStart = i
    while (i < n && text[i] !== "{") i++
    if (i >= n) break
    const selector = text.slice(selStart, i).trim()
    i++
    const bodyStart = i
    let depth = 1
    while (i < n && depth > 0) {
      if (text[i] === "{") depth++
      else if (text[i] === "}") depth--
      if (depth > 0) i++
    }
    const body = text.slice(bodyStart, i)
    if (text[i] === "}") i++
    if (selector) blocks.push({ selector, body })
  }

  return blocks
}

/**
 * @param {string} body
 * @returns {Map<string, string>}
 */
function parseCustomProperties(body) {
  const map = new Map()
  const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g
  let match
  while ((match = re.exec(body)) !== null) {
    map.set(match[1], match[2].trim())
  }
  return map
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function looksNonLength(value) {
  const v = value.trim()
  if (!v) return true
  if (/%/.test(v)) return true
  if (/color-mix\s*\(/i.test(v)) return true
  if (/oklch\s*\(/i.test(v)) return true
  if (/var\s*\(\s*--font-/i.test(v)) return true
  if (v.includes(",")) return true
  if (
    /url\s*\(|hsl[a]?\s*\(|rgb[a]?\s*\(|hwb\s*\(|lab\s*\(|lch\s*\(|color\s*\(/i.test(
      v
    )
  ) {
    return true
  }
  if (/env\s*\(|clamp\s*\(|min\s*\(|max\s*\(/i.test(v)) return true
  if (/\b(auto|none|inherit|initial|unset|revert|transparent|solid|currentcolor|round|squircle|on|off|light|dark)\b/i.test(v)) {
    return true
  }
  if (/(?:^|[^a-z-])(?:em|ex|ch|cap|ic|lh|rlh|vh|vw|vmin|vmax|cqw|cqh|cqi|cqb|cqmin|cqmax|svh|lvh|dvh|fr|deg|rad|turn|grad|s|ms)\b/i.test(v)) {
    return true
  }
  return false
}

/**
 * @param {string} text
 * @param {number} openIndex index of '('
 * @returns {number} index of matching ')'
 */
function matchingParen(text, openIndex) {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth++
    else if (text[i] === ")") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * @param {string} expr
 * @returns {number}
 */
function evalArithmetic(expr) {
  const tokens = tokenizeArithmetic(expr)
  let index = 0

  function peek() {
    return tokens[index]
  }

  function consume() {
    return tokens[index++]
  }

  function parseExpression() {
    let left = parseTerm()
    while (peek() === "+" || peek() === "-") {
      const op = consume()
      const right = parseTerm()
      left = op === "+" ? left + right : left - right
    }
    return left
  }

  function parseTerm() {
    let left = parseFactor()
    while (peek() === "*" || peek() === "/") {
      const op = consume()
      const right = parseFactor()
      if (op === "*") left = left * right
      else {
        if (right === 0) throw new Error("division by zero")
        left = left / right
      }
    }
    return left
  }

  function parseFactor() {
    const t = peek()
    if (t === "+") {
      consume()
      return parseFactor()
    }
    if (t === "-") {
      consume()
      return -parseFactor()
    }
    if (t === "(") {
      consume()
      const value = parseExpression()
      if (consume() !== ")") throw new Error("expected )")
      return value
    }
    if (typeof t === "number") {
      consume()
      return t
    }
    throw new Error(`unexpected token in calc: ${String(t)}`)
  }

  const result = parseExpression()
  if (index !== tokens.length) {
    throw new Error("trailing tokens in calc")
  }
  return result
}

/**
 * @param {string} expr
 * @returns {(number|string)[]}
 */
function tokenizeArithmetic(expr) {
  const tokens = []
  let i = 0
  const s = expr.replace(/\s+/g, "")
  while (i < s.length) {
    const ch = s[i]
    if ("+-*/()".includes(ch)) {
      tokens.push(ch)
      i++
      continue
    }
    if (/\d/.test(ch) || (ch === "." && /\d/.test(s[i + 1] || ""))) {
      let j = i
      while (j < s.length && /[\d.]/.test(s[j])) j++
      tokens.push(Number(s.slice(i, j)))
      i = j
      continue
    }
    throw new Error(`invalid calc character: ${ch}`)
  }
  return tokens
}

/**
 * @param {string} value
 * @param {number} rootPx
 * @returns {{ ok: true, px: number } | { ok: false, reason: string }}
 */
function parseAbsoluteLength(value, rootPx) {
  const v = value.trim()
  const pxMatch = /^([+-]?(?:\d+\.?\d*|\.\d+))px$/i.exec(v)
  if (pxMatch) return { ok: true, px: Number(pxMatch[1]) }
  const remMatch = /^([+-]?(?:\d+\.?\d*|\.\d+))rem$/i.exec(v)
  if (remMatch) return { ok: true, px: Number(remMatch[1]) * rootPx }
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(v)) {
    return { ok: false, reason: "unitless number" }
  }
  return { ok: false, reason: "not an absolute length" }
}

/**
 * Resolve a raw custom-property value to pixels within a declaring block.
 *
 * @param {string} raw
 * @param {Map<string, string>} blockMap
 * @param {Map<string, string>} baseMap
 * @param {object} options
 * @param {number} options.rootPx
 * @param {Set<string>} [stack]
 * @returns {{ px: number | null, skipReason: string | null }}
 */
function resolveRawValue(raw, blockMap, baseMap, options, stack = new Set()) {
  const rootPx = options.rootPx ?? ROOT_PX
  let value = raw.trim()

  if (looksNonLength(value)) {
    return { px: null, skipReason: "non-length" }
  }

  // Expand var() references, same block then base.
  const expandVars = (input) => {
    let out = input
    let guard = 0
    while (guard++ < 64) {
      const varIndex = out.search(/var\s*\(/i)
      if (varIndex === -1) break
      const open = out.indexOf("(", varIndex)
      const close = matchingParen(out, open)
      if (close === -1) {
        return { error: "unbalanced var()" }
      }
      const inner = out.slice(open + 1, close)
      const comma = findTopLevelComma(inner)
      const namePart = (comma === -1 ? inner : inner.slice(0, comma)).trim()
      const fallback =
        comma === -1 ? null : inner.slice(comma + 1).trim()
      const nameMatch = /^(--[A-Za-z0-9_-]+)$/.exec(namePart)
      if (!nameMatch) {
        return { error: "invalid var() name" }
      }
      const name = nameMatch[1]
      if (stack.has(name)) {
        return { error: `reference cycle involving ${name}` }
      }
      let refRaw = blockMap.get(name)
      if (refRaw === undefined) refRaw = baseMap.get(name)
      if (refRaw === undefined) {
        if (fallback != null && fallback !== "") {
          const fb = expandVars(fallback)
          if (fb.error) return fb
          out = out.slice(0, varIndex) + fb.value + out.slice(close + 1)
          continue
        }
        return { error: `unresolved var(${name})` }
      }
      stack.add(name)
      const resolved = resolveRawValue(refRaw, blockMap, baseMap, options, stack)
      stack.delete(name)
      if (resolved.skipReason) {
        return { error: resolved.skipReason }
      }
      if (resolved.px == null) {
        return { error: `non-length var(${name})` }
      }
      // Substitute as px so a bare var() resolves to an absolute length.
      out =
        out.slice(0, varIndex) +
        `${resolved.px}px` +
        out.slice(close + 1)
    }
    return { value: out }
  }

  const expanded = expandVars(value)
  if (expanded.error) {
    if (String(expanded.error).startsWith("reference cycle")) {
      return { px: null, skipReason: expanded.error }
    }
    return { px: null, skipReason: expanded.error }
  }
  value = expanded.value.trim()

  if (looksNonLength(value)) {
    return { px: null, skipReason: "non-length" }
  }

  const calcMatch = /^calc\s*\(/i.exec(value)
  if (calcMatch) {
    const open = value.indexOf("(")
    const close = matchingParen(value, open)
    if (close === -1 || close !== value.length - 1) {
      return { px: null, skipReason: "invalid calc()" }
    }
    let inner = value.slice(open + 1, close).trim()
    // Strip residual px/rem units; vars already expanded to unitless px.
    inner = inner.replace(
      /([+-]?(?:\d+\.?\d*|\.\d+))\s*(px|rem)\b/gi,
      (_, num, unit) => {
        const n = Number(num)
        return String(unit.toLowerCase() === "rem" ? n * rootPx : n)
      }
    )
    if (/(?:[a-z%]|--)/i.test(inner.replace(/[eE][+-]?\d+/g, ""))) {
      // Remaining identifiers or units mean this is not a pure length calc.
      if (/%/.test(inner) || /[a-z]/i.test(inner)) {
        return { px: null, skipReason: "non-length" }
      }
    }
    try {
      const px = evalArithmetic(inner)
      if (!Number.isFinite(px)) {
        return { px: null, skipReason: "non-finite calc result" }
      }
      return { px, skipReason: null }
    } catch {
      return { px: null, skipReason: "invalid calc()" }
    }
  }

  const abs = parseAbsoluteLength(value, rootPx)
  if (abs.ok) return { px: abs.px, skipReason: null }
  return { px: null, skipReason: abs.reason }
}

/**
 * @param {string} text
 * @returns {number} index of top-level comma, or -1
 */
function findTopLevelComma(text) {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "(") depth++
    else if (ch === ")") depth--
    else if (ch === "," && depth === 0) return i
  }
  return -1
}

/**
 * @param {string} cssText
 * @returns {Map<string, Map<string, string>>}
 */
function collectRawBySelector(cssText) {
  /** @type {Map<string, Map<string, string>>} */
  const rawBySelector = new Map()
  for (const block of parseDeclaringBlocks(cssText)) {
    const props = parseCustomProperties(block.body)
    if (props.size === 0) continue
    rawBySelector.set(block.selector, props)
  }
  return rawBySelector
}

/**
 * @param {Map<string, Map<string, string>>} rawBySelector
 * @param {string} preferredBase
 * @returns {string}
 */
function pickBaseSelector(rawBySelector, preferredBase) {
  if (rawBySelector.has(preferredBase)) return preferredBase
  const rootLike = [...rawBySelector.keys()].find(
    (sel) =>
      sel === ":root" || sel.startsWith(":root,") || sel.startsWith(":root ")
  )
  return rootLike ?? [...rawBySelector.keys()][0] ?? preferredBase
}

/**
 * Default-density :root scopes used when resolving an overlay sheet.
 * Includes bare :root and :root paired with cozy density.
 *
 * @param {string} selector
 * @returns {boolean}
 */
function isDefaultDensityRootScope(selector) {
  const compact = selector.replace(/\s+/g, " ").trim()
  if (compact === ":root") return true
  return (
    compact.includes(":root") &&
    compact.includes('[data-df-density="cozy"]')
  )
}

/**
 * Merge raw custom properties from default-density root scopes.
 * Cozy :root layers over bare :root so control sizes resolve.
 *
 * @param {Map<string, Map<string, string>>} rawBySelector
 * @returns {Map<string, string>}
 */
function buildOverlayBaseRawMap(rawBySelector) {
  /** @type {Map<string, string>} */
  const map = new Map()
  const scopes = [...rawBySelector.entries()].filter(([sel]) =>
    isDefaultDensityRootScope(sel)
  )
  scopes.sort(([a], [b]) => {
    const aCozy = a.includes('[data-df-density="cozy"]') ? 1 : 0
    const bCozy = b.includes('[data-df-density="cozy"]') ? 1 : 0
    return aCozy - bCozy
  })
  for (const [, props] of scopes) {
    for (const [name, raw] of props) map.set(name, raw)
  }
  return map
}

/**
 * Parse and resolve length custom properties from CSS text.
 *
 * When `baseCss` is set, `cssText` is the overlay sheet: each overlay block
 * resolves `var()` against its own declarations first, then against the base
 * scope from `baseCss`. Base selector entries are included in the result so
 * equations can mix overlay and base tokens.
 *
 * @param {string} cssText
 * @param {{ rootPx?: number, baseSelector?: string, baseCss?: string }} [options]
 * @returns {{
 *   entries: Array<{
 *     selector: string,
 *     name: string,
 *     raw: string,
 *     px: number | null,
 *     skipReason: string | null
 *   }>,
 *   bySelector: Map<string, Map<string, { raw: string, px: number | null, skipReason: string | null }>>,
 *   baseSelector: string,
 *   overlayRawBySelector: Map<string, Map<string, string>> | null,
 *   baseRawMap: Map<string, string> | null,
 *   rootPx: number
 * }}
 */
export function resolveTokenLengths(cssText, options = {}) {
  const rootPx = options.rootPx ?? ROOT_PX
  const preferredBase = options.baseSelector ?? ":root"

  if (options.baseCss != null) {
    const baseResolved = resolveTokenLengths(options.baseCss, {
      rootPx,
      baseSelector: preferredBase,
    })
    const baseRawBySelector = collectRawBySelector(options.baseCss)
    const baseSelector = baseResolved.baseSelector
    const baseMap = buildOverlayBaseRawMap(baseRawBySelector)
    if (baseMap.size === 0) {
      const fallback = baseRawBySelector.get(baseSelector) ?? new Map()
      for (const [name, raw] of fallback) baseMap.set(name, raw)
    }

    const overlayRaw = collectRawBySelector(cssText)
    /** @type {Map<string, Map<string, { raw: string, px: number | null, skipReason: string | null }>>} */
    const bySelector = new Map(baseResolved.bySelector)
    /** @type {Array<{ selector: string, name: string, raw: string, px: number | null, skipReason: string | null }>} */
    const entries = [...baseResolved.entries]

    for (const [selector, propMap] of overlayRaw) {
      const resolvedMap = new Map()
      for (const [name, raw] of propMap) {
        const { px, skipReason } = resolveRawValue(
          raw,
          propMap,
          baseMap,
          { rootPx },
          new Set([name])
        )
        const entry = { selector, name, raw, px, skipReason }
        entries.push(entry)
        resolvedMap.set(name, { raw, px, skipReason })
      }
      bySelector.set(selector, resolvedMap)
    }

    return {
      entries,
      bySelector,
      baseSelector,
      overlayRawBySelector: overlayRaw,
      baseRawMap: baseMap,
      rootPx,
    }
  }

  const rawBySelector = collectRawBySelector(cssText)
  const baseSelector = pickBaseSelector(rawBySelector, preferredBase)
  const baseMap = rawBySelector.get(baseSelector) ?? new Map()

  /** @type {Map<string, Map<string, { raw: string, px: number | null, skipReason: string | null }>>} */
  const bySelector = new Map()
  /** @type {Array<{ selector: string, name: string, raw: string, px: number | null, skipReason: string | null }>} */
  const entries = []

  for (const [selector, propMap] of rawBySelector) {
    const resolvedMap = new Map()
    const fallbackBase = selector === baseSelector ? new Map() : baseMap
    for (const [name, raw] of propMap) {
      const { px, skipReason } = resolveRawValue(
        raw,
        propMap,
        fallbackBase,
        { rootPx },
        new Set([name])
      )
      const entry = { selector, name, raw, px, skipReason }
      entries.push(entry)
      resolvedMap.set(name, { raw, px, skipReason })
    }
    bySelector.set(selector, resolvedMap)
  }

  return {
    entries,
    bySelector,
    baseSelector,
    overlayRawBySelector: null,
    baseRawMap: null,
    rootPx,
  }
}

/**
 * @typedef {{ includes: string[], excludes?: string[] }} ComposeMatcher
 */

/**
 * Pick the unique selector key matching includes/excludes, or null.
 *
 * @param {Iterable<string>} selectors
 * @param {ComposeMatcher} matcher
 * @returns {string | null}
 */
export function matchComposeSelector(selectors, matcher) {
  const includes = matcher.includes ?? []
  const excludes = matcher.excludes ?? []
  const hits = [...selectors].filter(
    (sel) =>
      includes.every((part) => sel.includes(part)) &&
      excludes.every((part) => !sel.includes(part))
  )
  return hits.length === 1 ? hits[0] : null
}

/**
 * Merge overlay raw maps in cascade order (later wins), then resolve lengths.
 * Models an element that matches several component rules at once.
 *
 * @param {{
 *   overlayRawBySelector: Map<string, Map<string, string>> | null,
 *   baseRawMap: Map<string, string> | null,
 *   rootPx: number
 * }} resolved
 * @param {ComposeMatcher[]} matchers
 * @returns {{
 *   selector: string,
 *   map: Map<string, { raw: string, px: number | null, skipReason: string | null }>
 * } | { error: string }}
 */
export function resolveComposedScope(resolved, matchers) {
  if (!resolved.overlayRawBySelector || !resolved.baseRawMap) {
    return {
      error:
        "compose requires resolveTokenLengths(..., { baseCss }) so overlay raw maps are available",
    }
  }

  /** @type {string[]} */
  const picked = []
  /** @type {Map<string, string>} */
  const mergedRaw = new Map()

  for (const matcher of matchers) {
    const sel = matchComposeSelector(
      resolved.overlayRawBySelector.keys(),
      matcher
    )
    if (sel == null) {
      return {
        error: `compose matcher matched ${
          [...resolved.overlayRawBySelector.keys()].filter(
            (candidate) =>
              (matcher.includes ?? []).every((part) =>
                candidate.includes(part)
              ) &&
              (matcher.excludes ?? []).every(
                (part) => !candidate.includes(part)
              )
          ).length
        } selectors (need 1): includes=${JSON.stringify(matcher.includes)}`,
      }
    }
    picked.push(sel)
    for (const [name, raw] of resolved.overlayRawBySelector.get(sel)) {
      mergedRaw.set(name, raw)
    }
  }

  /** @type {Map<string, { raw: string, px: number | null, skipReason: string | null }>} */
  const map = new Map()
  for (const [name, raw] of mergedRaw) {
    const { px, skipReason } = resolveRawValue(
      raw,
      mergedRaw,
      resolved.baseRawMap,
      { rootPx: resolved.rootPx },
      new Set([name])
    )
    map.set(name, { raw, px, skipReason })
  }

  return { selector: picked.join(" + "), map }
}

/**
 * @param {{ entries: Array<{ selector: string, name: string, raw: string, px: number | null, skipReason: string | null }> }} resolved
 * @param {Record<string, string>} exemptions name -> reason
 * @returns {Array<{ selector: string, name: string, raw: string, px: number }>}
 */
export function checkWholePixelTokens(resolved, exemptions = {}) {
  const violations = []
  for (const entry of resolved.entries) {
    if (entry.px == null) continue
    if (exemptions[entry.name]) continue
    if (isNonGeometryTokenName(entry.name)) continue
    if (!isWholePixel(entry.px)) {
      violations.push({
        selector: entry.selector,
        name: entry.name,
        raw: entry.raw,
        px: entry.px,
      })
    }
  }
  return violations
}

/**
 * @param {number} px
 * @returns {boolean}
 */
function isWholePixel(px) {
  return Number.isFinite(px) && Math.abs(px - Math.round(px)) < 1e-9
}

/**
 * Resolve a token length on a selector, then the base selector.
 *
 * @param {{
 *   bySelector: Map<string, Map<string, { px: number | null }>>,
 *   baseSelector: string
 * }} resolved
 * @param {string} selector
 * @param {string} token
 * @returns {{ px: number } | null}
 */
function lookupResolvedPx(resolved, selector, token) {
  const local = resolved.bySelector.get(selector)?.get(token)
  if (local && local.px != null) return { px: local.px }

  const base = resolved.bySelector.get(resolved.baseSelector)?.get(token)
  if (base && base.px != null) return { px: base.px }

  for (const [sel, map] of resolved.bySelector) {
    if (!isDefaultDensityRootScope(sel)) continue
    if (sel === resolved.baseSelector) continue
    const entry = map.get(token)
    if (entry && entry.px != null) return { px: entry.px }
  }
  return null
}

/**
 * Evaluate one zero-slack equation against a resolved property map.
 *
 * @param {Map<string, { px: number | null }>} map
 * @param {{
 *   label: string,
 *   outer: string,
 *   subtract: Array<{ token: string, times: number }>
 * }} equation
 * @param {string | null} selector
 * @param {(token: string) => { px: number } | null} [lookup]
 * @returns {{
 *   label: string,
 *   selector: string | null,
 *   outer: string,
 *   outerPx: number | null,
 *   residual: number | null,
 *   reason: string,
 *   parts?: Array<{ token: string, times: number, px: number }>
 * } | null}
 * Returns null when the equation holds (residual 0).
 */
function evaluateZeroSlackOnMap(map, equation, selector, lookup) {
  const resolveToken =
    lookup ??
    ((token) => {
      const entry = map.get(token)
      if (entry && entry.px != null) return { px: entry.px }
      return null
    })

  const outerEntry = resolveToken(equation.outer)
  if (!outerEntry) {
    return {
      label: equation.label,
      selector,
      outer: equation.outer,
      outerPx: null,
      residual: null,
      reason: `missing token ${equation.outer}`,
    }
  }

  let sum = 0
  /** @type {Array<{ token: string, times: number, px: number }>} */
  const parts = []
  for (const part of equation.subtract) {
    const entry = resolveToken(part.token)
    if (!entry) {
      return {
        label: equation.label,
        selector,
        outer: equation.outer,
        outerPx: outerEntry.px,
        residual: null,
        reason: `missing token ${part.token}`,
      }
    }
    sum += entry.px * part.times
    parts.push({ token: part.token, times: part.times, px: entry.px })
  }

  const residual = outerEntry.px - sum
  if (residual === 0) return null
  return {
    label: equation.label,
    selector,
    outer: equation.outer,
    outerPx: outerEntry.px,
    residual,
    reason: `residual ${residual}px`,
    parts,
  }
}

/**
 * Zero-slack equations: outer - sum(token * times) === 0.
 *
 * When `compose` is set, overlay rules are merged in order (later wins) and
 * re-resolved so size and border variants that share an element can be checked.
 *
 * @param {{
 *   bySelector: Map<string, Map<string, { px: number | null }>>,
 *   baseSelector: string,
 *   overlayRawBySelector?: Map<string, Map<string, string>> | null,
 *   baseRawMap?: Map<string, string> | null,
 *   rootPx?: number
 * }} resolved
 * @param {Array<{
 *   label: string,
 *   outer: string,
 *   subtract: Array<{ token: string, times: number }>,
 *   compose?: ComposeMatcher[]
 * }>} equations
 * @returns {Array<{
 *   label: string,
 *   selector: string | null,
 *   outer: string,
 *   outerPx: number | null,
 *   residual: number | null,
 *   reason: string
 * }>}
 */
export function checkZeroSlack(resolved, equations) {
  const violations = []

  for (const equation of equations) {
    if (equation.compose) {
      const composed = resolveComposedScope(resolved, equation.compose)
      if ("error" in composed) {
        violations.push({
          label: equation.label,
          selector: null,
          outer: equation.outer,
          outerPx: null,
          residual: null,
          reason: composed.error,
        })
        continue
      }
      const failure = evaluateZeroSlackOnMap(
        composed.map,
        equation,
        composed.selector
      )
      if (failure) violations.push(failure)
      continue
    }

    let seenComplete = false

    for (const [selector, map] of resolved.bySelector) {
      const outer = map.get(equation.outer)
      if (!outer || outer.px == null) continue

      const failure = evaluateZeroSlackOnMap(
        map,
        equation,
        selector,
        (token) => lookupResolvedPx(resolved, selector, token)
      )
      seenComplete = true
      if (failure) violations.push(failure)
    }

    if (!seenComplete) {
      const missing =
        equation.subtract.find((part) => {
          for (const map of resolved.bySelector.values()) {
            const entry = map.get(part.token)
            if (entry && entry.px != null) return false
          }
          return true
        })?.token ?? equation.outer

      violations.push({
        label: equation.label,
        selector: null,
        outer: equation.outer,
        outerPx: null,
        residual: null,
        reason: `missing token ${missing}`,
      })
    }
  }

  return violations
}

/**
 * Resolve arithmetic for zero-slack equations (pass and fail) for reporting.
 *
 * @param {Parameters<typeof checkZeroSlack>[0]} resolved
 * @param {Parameters<typeof checkZeroSlack>[1]} equations
 * @returns {Array<{
 *   label: string,
 *   selector: string | null,
 *   outer: string,
 *   outerPx: number | null,
 *   residual: number | null,
 *   ok: boolean,
 *   reason: string | null,
 *   parts: Array<{ token: string, times: number, px: number }>
 * }>}
 */
export function explainZeroSlack(resolved, equations) {
  /** @type {ReturnType<typeof explainZeroSlack>} */
  const rows = []

  for (const equation of equations) {
    if (equation.compose) {
      const composed = resolveComposedScope(resolved, equation.compose)
      if ("error" in composed) {
        rows.push({
          label: equation.label,
          selector: null,
          outer: equation.outer,
          outerPx: null,
          residual: null,
          ok: false,
          reason: composed.error,
          parts: [],
        })
        continue
      }
      const failure = evaluateZeroSlackOnMap(
        composed.map,
        equation,
        composed.selector
      )
      if (failure) {
        rows.push({
          label: equation.label,
          selector: composed.selector,
          outer: equation.outer,
          outerPx: failure.outerPx,
          residual: failure.residual,
          ok: false,
          reason: failure.reason,
          parts: failure.parts ?? [],
        })
      } else {
        const outer = composed.map.get(equation.outer)
        const parts = equation.subtract.map((part) => ({
          token: part.token,
          times: part.times,
          px: composed.map.get(part.token)?.px ?? NaN,
        }))
        rows.push({
          label: equation.label,
          selector: composed.selector,
          outer: equation.outer,
          outerPx: outer?.px ?? null,
          residual: 0,
          ok: true,
          reason: null,
          parts,
        })
      }
      continue
    }

    let matched = false
    for (const [selector, map] of resolved.bySelector) {
      const outer = map.get(equation.outer)
      if (!outer || outer.px == null) continue
      matched = true
      const failure = evaluateZeroSlackOnMap(
        map,
        equation,
        selector,
        (token) => lookupResolvedPx(resolved, selector, token)
      )
      const parts = equation.subtract.map((part) => {
        const entry = lookupResolvedPx(resolved, selector, part.token)
        return {
          token: part.token,
          times: part.times,
          px: entry?.px ?? NaN,
        }
      })
      if (failure) {
        rows.push({
          label: equation.label,
          selector,
          outer: equation.outer,
          outerPx: failure.outerPx,
          residual: failure.residual,
          ok: false,
          reason: failure.reason,
          parts: failure.parts ?? parts,
        })
      } else {
        rows.push({
          label: equation.label,
          selector,
          outer: equation.outer,
          outerPx: outer.px,
          residual: 0,
          ok: true,
          reason: null,
          parts,
        })
      }
    }
    if (!matched) {
      rows.push({
        label: equation.label,
        selector: null,
        outer: equation.outer,
        outerPx: null,
        residual: null,
        ok: false,
        reason: `missing token ${equation.outer}`,
        parts: [],
      })
    }
  }

  return rows
}

/**
 * @param {{ bySelector: Map<string, Map<string, { px: number | null }>> }} resolved
 * @param {Array<{ outer: string, inner: string, tier: "zero" | "strict" | "even" }>} pairs
 * @returns {{
 *   violations: Array<{
 *     selector: string,
 *     outer: string,
 *     inner: string,
 *     tier: string,
 *     outerPx: number,
 *     innerPx: number,
 *     slack: number
 *   }>,
 *   stale: Array<{ outer: string, inner: string, tier: string }>
 * }}
 */
export function checkCenteredPairs(resolved, pairs) {
  const violations = []
  const stale = []

  for (const pair of pairs) {
    let seenComplete = false
    for (const [selector, map] of resolved.bySelector) {
      const outer = map.get(pair.outer)
      const inner = map.get(pair.inner)
      if (!outer || outer.px == null || !inner || inner.px == null) {
        continue
      }
      seenComplete = true
      const slack = outer.px - inner.px
      if (!tierSatisfied(pair.tier, slack)) {
        violations.push({
          selector,
          outer: pair.outer,
          inner: pair.inner,
          tier: pair.tier,
          outerPx: outer.px,
          innerPx: inner.px,
          slack,
        })
      }
    }
    if (!seenComplete) {
      stale.push({
        outer: pair.outer,
        inner: pair.inner,
        tier: pair.tier,
      })
    }
  }

  return { violations, stale }
}

/**
 * @param {"zero" | "strict" | "even"} tier
 * @param {number} slack
 * @returns {boolean}
 */
function tierSatisfied(tier, slack) {
  if (tier === "zero") return slack === 0
  if (tier === "strict") return Math.abs(slack) % 8 === 0
  if (tier === "even") return Math.abs(slack) % 2 === 0
  return false
}

/**
 * @param {{ entries: Array<{ selector: string, name: string, raw: string }> }} resolved
 * @param {(string|RegExp)[]} patterns
 * @returns {Array<{ selector: string, name: string, raw: string, pattern: string }>}
 */
export function checkBannedTokenNames(resolved, patterns) {
  const compiled = patterns.map((p) =>
    typeof p === "string"
      ? { source: p, re: new RegExp(p) }
      : { source: String(p), re: p }
  )
  const hits = []
  for (const entry of resolved.entries) {
    for (const { source, re } of compiled) {
      if (re.test(entry.name)) {
        hits.push({
          selector: entry.selector,
          name: entry.name,
          raw: entry.raw,
          pattern: source,
        })
        break
      }
    }
  }
  return hits
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isEntirelyVarOrCalcOverVar(value) {
  const v = value.trim()
  if (/^var\s*\(/i.test(v)) {
    const open = v.indexOf("(")
    const close = matchingParen(v, open)
    return close === v.length - 1
  }
  if (/^calc\s*\(/i.test(v)) {
    const open = v.indexOf("(")
    const close = matchingParen(v, open)
    if (close !== v.length - 1) return false
    const withoutVars = stripVarCalls(v.slice(open + 1, close))
    // Allow unitless numbers and operators only (var leaves already removed).
    const cleaned = withoutVars
      .replace(/([+-]?(?:\d+\.?\d*|\.\d+))/g, "")
      .replace(/[+\-*/()\s]/g, "")
    return cleaned.length === 0
  }
  return false
}

/**
 * @param {string} text
 * @returns {string}
 */
function stripVarCalls(text) {
  let out = text
  let guard = 0
  while (guard++ < 64) {
    const idx = out.search(/var\s*\(/i)
    if (idx === -1) break
    const open = out.indexOf("(", idx)
    const close = matchingParen(out, open)
    if (close === -1) break
    out = out.slice(0, idx) + out.slice(close + 1)
  }
  return out
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function extractHardcodedLengthLiterals(value) {
  const literals = []
  let i = 0
  const s = value
  while (i < s.length) {
    if (/^var\s*\(/i.test(s.slice(i))) {
      const open = s.indexOf("(", i)
      const close = matchingParen(s, open)
      if (close === -1) break
      i = close + 1
      continue
    }
    const calcMatch = /^calc\s*\(/i.exec(s.slice(i))
    if (calcMatch) {
      const open = s.indexOf("(", i)
      const close = matchingParen(s, open)
      if (close === -1) break
      const inner = s.slice(open + 1, close)
      if (!isEntirelyVarOrCalcOverVar(`calc(${inner})`)) {
        literals.push(...extractHardcodedLengthLiterals(inner))
      }
      i = close + 1
      continue
    }
    const lenMatch = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem)\b/i.exec(s.slice(i))
    if (lenMatch) {
      const literal = lenMatch[0]
      const abs = Math.abs(Number(lenMatch[1]))
      if (!(abs === 0 || literal.toLowerCase() === "0px")) {
        literals.push(literal)
      }
      i += literal.length
      continue
    }
    i++
  }
  return literals
}

/**
 * Scan CSS for hardcoded length literals on geometry-affecting properties.
 *
 * @param {string} cssText
 * @returns {Array<{ line: number, property: string, literal: string, value: string }>}
 */
export function findHardcodedGeometry(cssText) {
  const lines = cssText.split(/\r?\n/)
  const results = []
  const propRe =
    /^(width|min-width|max-width|height|min-height|max-height|padding(?:-(?:top|right|bottom|left|inline|inline-start|inline-end|block|block-start|block-end))?|margin(?:-(?:top|right|bottom|left|inline|inline-start|inline-end|block|block-start|block-end))?|inset(?:-(?:inline|inline-start|inline-end|block|block-start|block-end))?|top|right|bottom|left|gap|row-gap|column-gap|translate|transform)\s*:\s*([^;]+);/i

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const trimmed = line.trim()
    if (trimmed.startsWith("--")) continue
    if (trimmed.startsWith("@")) continue

    const match = propRe.exec(trimmed)
    if (!match) continue
    const property = match[1].toLowerCase()
    if (!GEOMETRY_PROPS.has(property)) continue
    let value = match[2].trim()
    if (/^auto$/i.test(value)) continue
    if (/^0(?:px)?$/i.test(value)) continue
    if (/^[\d.]+%$/.test(value)) continue

    if (property === "transform") {
      const translateRe =
        /translate(?:X|Y|Z|3d)?\s*\(([^)]*)\)|translate\s*\(([^)]*)\)/gi
      let tm
      while ((tm = translateRe.exec(value)) !== null) {
        const arg = tm[1] ?? tm[2] ?? ""
        if (isEntirelyVarOrCalcOverVar(arg.trim())) continue
        for (const literal of extractHardcodedLengthLiterals(arg)) {
          results.push({
            line: lineIndex + 1,
            property: "transform",
            literal,
            value: arg.trim(),
          })
        }
      }
      continue
    }

    if (isEntirelyVarOrCalcOverVar(value)) continue

    // Multi-value: skip values that are only var/calc-over-var components and zeros.
    const parts = splitCssList(value)
    if (
      parts.length > 1 &&
      parts.every(
        (part) =>
          /^0(?:px)?$/i.test(part) ||
          /^[\d.]+%$/.test(part) ||
          /^auto$/i.test(part) ||
          isEntirelyVarOrCalcOverVar(part)
      )
    ) {
      continue
    }

    for (const literal of extractHardcodedLengthLiterals(value)) {
      results.push({
        line: lineIndex + 1,
        property,
        literal,
        value,
      })
    }
  }

  return results
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function splitCssList(value) {
  const parts = []
  let depth = 0
  let current = ""
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (/\s/.test(ch) && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}
