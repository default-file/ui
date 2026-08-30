import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  resolveTokenLengths,
  checkWholePixelTokens,
  checkCenteredPairs,
  checkZeroSlack,
  explainZeroSlack,
  checkBannedTokenNames,
  findHardcodedGeometry,
  NON_GEOMETRY_TOKEN_RULE,
} from "./lib/df-geometry.mjs"

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tokensPath = path.join(kitRoot, "src/css/df-tokens.css")
const componentsPath = path.join(kitRoot, "src/css/df-components.css")

/** @type {Record<string, string>} */
export const WHOLE_PIXEL_EXEMPTIONS = {
  "--df-layer-promote-z": "compositing hint, not geometry.",
  "--border-width-fine": "used only as an SVG stroke width, never as a layout box.",
  "--border-width-thin":
    "painted border width, snapped by the engine, layout absorbed by derived padding.",
  "--df-tooltip-arrow-offset":
    "rotated square geometry cannot land on whole pixels.",
  "--df-popover-arrow-offset":
    "alias of the tooltip arrow offset; rotated square geometry cannot land on whole pixels.",
  "--df-date-picker-today-ring": "painted ring width, not a layout box.",
  "--df-timeline-dependency-width":
    "painted connector line width, not a layout box.",
  "--radius-full": "sentinel value, not a measured length.",
}

/**
 * @type {Array<{
 *   outer: string,
 *   inner: string,
 *   tier: "zero" | "strict" | "even",
 *   reason: string
 * }>}
 */
export const CENTERED_PAIRS = [
  {
    outer: "--df-switch-track-height",
    inner: "--df-switch-thumb-size",
    tier: "strict",
    reason: "Enclosed thumb gap is 2 * gap; total slack is a multiple of 8.",
  },
  {
    outer: "--df-switch-track-height-sm",
    inner: "--df-switch-thumb-size-sm",
    tier: "strict",
    reason: "Enclosed thumb gap is 2 * gap; total slack is a multiple of 8.",
  },
  {
    outer: "--df-radio-size-md",
    inner: "--df-radio-dot-size-md",
    tier: "strict",
    reason: "Enclosed radio dot gap must keep half-gaps whole at common zooms.",
  },
  {
    outer: "--df-radio-size-sm",
    inner: "--df-radio-dot-size-sm",
    tier: "strict",
    reason: "Enclosed radio dot gap must keep half-gaps whole at common zooms.",
  },
  {
    outer: "--df-checkbox-size-md",
    inner: "--df-checkbox-icon-size-md",
    tier: "even",
    reason: "Icon slack is even so each half stays whole in device pixels.",
  },
  {
    outer: "--df-checkbox-size-sm",
    inner: "--df-checkbox-icon-size-sm",
    tier: "even",
    reason: "Icon slack is even so each half stays whole in device pixels.",
  },
  {
    outer: "--df-slider-thumb-size",
    inner: "--df-slider-track-height",
    tier: "even",
    reason:
      "The thumb overhangs the track, so there is no enclosed gap; even slack keeps every half whole and the residual is bounded to one device pixel against a silhouette edge rather than a visible ring.",
  },
  {
    outer: "--df-slider-thumb-size-sm",
    inner: "--df-slider-track-height-sm",
    tier: "even",
    reason:
      "The thumb overhangs the track, so there is no enclosed gap; even slack keeps every half whole and the residual is bounded to one device pixel against a silhouette edge rather than a visible ring.",
  },
  {
    outer: "--df-slider-thumb-size-lg",
    inner: "--df-slider-track-height-lg",
    tier: "even",
    reason:
      "The thumb overhangs the track, so there is no enclosed gap; even slack keeps every half whole and the residual is bounded to one device pixel against a silhouette edge rather than a visible ring.",
  },
  {
    outer: "--df-tick-slider-shell-height",
    inner: "--df-tick-slider-thumb-height",
    tier: "even",
    reason: "Shell to thumb slack is even so each half stays whole in device pixels.",
  },
]

/** Base input chrome rule (default md height, hairline border, padding formula). */
const INPUT_BASE = {
  includes: [':where([data-df="input"])', ".df-input"],
  excludes: ["data-size", "border-width", "input-field"],
}

/** @param {"sm" | "md" | "lg" | "xl"} size */
function inputSizeScope(size) {
  return { includes: [`[data-df="input"][data-size="${size}"]`] }
}

/** @param {"hairline" | "thin" | "thick"} border */
function inputBorderScope(border) {
  return {
    includes: [
      `:where([data-df="input"][data-border-width="${border}"])`,
      `.df-input[data-border-width="${border}"]`,
    ],
  }
}

/** Base select-trigger chrome rule. */
const SELECT_BASE = {
  includes: [':where([data-df="select-trigger"])'],
  excludes: ["data-size", "selection-mode", "select-trigger-"],
}

/** @param {"sm" | "md" | "lg"} size */
function selectSizeScope(size) {
  if (size === "md") {
    return {
      includes: [':where([data-df="select-trigger"][data-size="md"])'],
    }
  }
  return {
    includes: [`:where([data-df="select-trigger"][data-size="${size}"])`],
  }
}

/**
 * @param {string} label
 * @param {string} outer
 * @param {string} borderToken
 * @param {string} paddingToken
 * @param {string} lineToken
 * @param {Array<{ includes: string[], excludes?: string[] }>} compose
 */
function textControlEquation(
  label,
  outer,
  borderToken,
  paddingToken,
  lineToken,
  compose
) {
  return {
    label,
    outer,
    compose,
    subtract: [
      { token: borderToken, times: 2 },
      { token: paddingToken, times: 2 },
      { token: lineToken, times: 1 },
    ],
  }
}

/**
 * @type {Array<{
 *   label: string,
 *   outer: string,
 *   subtract: Array<{ token: string, times: number }>,
 *   compose?: Array<{ includes: string[], excludes?: string[] }>
 * }>}
 */
export const ZERO_SLACK_EQUATIONS = [
  {
    label: "switch default",
    outer: "--df-switch-track-height",
    subtract: [
      { token: "--df-switch-thumb-gap", times: 2 },
      { token: "--df-switch-thumb-size", times: 1 },
    ],
  },
  {
    label: "switch small",
    outer: "--df-switch-track-height-sm",
    subtract: [
      { token: "--df-switch-thumb-gap", times: 2 },
      { token: "--df-switch-thumb-size-sm", times: 1 },
    ],
  },
  .../** @type {Array<"sm" | "md" | "lg" | "xl">} */ (
    ["sm", "md", "lg", "xl"]
  ).flatMap((size) =>
    /** @type {Array<"hairline" | "thin" | "thick">} */ ([
      "hairline",
      "thin",
      "thick",
    ]).map((border) =>
      textControlEquation(
        `input ${size} (${border})`,
        "--df-input-height",
        "--df-input-border-width",
        "--df-input-padding-block",
        "--df-input-line-height",
        [INPUT_BASE, inputSizeScope(size), inputBorderScope(border)]
      )
    )
  ),
  .../** @type {Array<"sm" | "md" | "lg">} */ (["sm", "md", "lg"]).map((size) =>
    textControlEquation(
      `select-trigger ${size} (hairline)`,
      "--df-select-height",
      "--df-select-border-width",
      "--df-select-padding-block",
      "--df-select-line-height",
      [SELECT_BASE, selectSizeScope(size)]
    )
  ),
]

/** Banned token-name substrings / patterns. */
export const BANNED_TOKEN_NAME_PATTERNS = ["optical-shift"]

/**
 * Centered geometry expressed as literals or non-pair tokens in components CSS.
 * Report-only: does not affect the exit code.
 *
 * @type {Array<{ where: string, note: string }>}
 */
export const NOT_VERIFIABLE_BY_TOKEN_AUDIT = [
  {
    where: 'badge xs height calc(4 * spacing-unit) with 1px border vs status-dot xs',
    note: "Content height 14px, dot 6px, slack 8px (even). Badge heights are inline literals.",
  },
  {
    where: 'badge sm height calc(4.5 * spacing-unit) with 1px border vs status-dot sm',
    note: "Content height 16px, dot 8px, slack 8px (even). Badge heights are inline literals.",
  },
  {
    where: 'badge md height calc(5 * spacing-unit) with 1px border and 2px block padding vs status-dot md',
    note: "Content height 14px, dot 10px, slack 4px (even). Badge heights are inline literals.",
  },
  {
    where: 'badge lg height calc(6 * spacing-unit) with 1px border and 2px block padding vs status-dot lg',
    note: "Content height 18px, dot 12px, slack 6px (even). Badge heights are inline literals.",
  },
  {
    where: 'badge xl height calc(7 * spacing-unit) with 1px border and 4px block padding vs status-dot xl',
    note: "Content height 18px, dot 14px, slack 4px (even). Badge heights are inline literals.",
  },
]

/**
 * @param {string} filePath
 * @param {string} label
 * @returns {string}
 */
function readRequired(filePath, label) {
  let text
  try {
    text = fs.readFileSync(filePath, "utf8")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`df:audit-geometry: cannot read ${label} at ${filePath}`)
    console.error(message)
    process.exit(2)
  }
  if (!text.trim()) {
    console.error(`df:audit-geometry: ${label} is empty at ${filePath}`)
    process.exit(2)
  }
  return text
}

/**
 * @param {string} title
 */
function section(title) {
  console.log("")
  console.log(`## ${title}`)
  console.log("")
}

function main() {
  const tokensCss = readRequired(tokensPath, "df-tokens.css")
  const componentsCss = readRequired(componentsPath, "df-components.css")

  const resolved = resolveTokenLengths(tokensCss)
  const merged = resolveTokenLengths(componentsCss, { baseCss: tokensCss })
  const wholePixel = checkWholePixelTokens(resolved, WHOLE_PIXEL_EXEMPTIONS)
  const pairs = checkCenteredPairs(resolved, CENTERED_PAIRS)
  const zeroSlack = checkZeroSlack(merged, ZERO_SLACK_EQUATIONS)
  const zeroSlackExplain = explainZeroSlack(merged, ZERO_SLACK_EQUATIONS)
  const banned = checkBannedTokenNames(merged, BANNED_TOKEN_NAME_PATTERNS)
  const hardcoded = findHardcodedGeometry(componentsCss)

  console.log("df:audit-geometry")
  console.log(`tokens: ${tokensPath}`)
  console.log(`components: ${componentsPath}`)
  console.log(`resolved length entries (tokens): ${resolved.entries.length}`)
  console.log(`resolved length entries (merged): ${merged.entries.length}`)
  console.log(`base selector: ${merged.baseSelector}`)
  console.log("")
  console.log("Exclusion rule (whole-pixel):")
  console.log(`  ${NON_GEOMETRY_TOKEN_RULE}`)
  console.log("Exemptions:")
  for (const [name, reason] of Object.entries(WHOLE_PIXEL_EXEMPTIONS)) {
    console.log(`  ${name}: ${reason}`)
  }

  section("Whole-pixel violations")
  if (wholePixel.length === 0) {
    console.log("(none)")
  } else {
    for (const v of wholePixel) {
      console.log(
        `${v.selector} ${v.name} = ${v.px}px (raw: ${v.raw})`
      )
    }
  }

  section("Centered-pair violations")
  if (pairs.violations.length === 0) {
    console.log("(none)")
  } else {
    for (const v of pairs.violations) {
      console.log(
        `${v.selector} ${v.outer} (${v.outerPx}px) - ${v.inner} (${v.innerPx}px) = slack ${v.slack}px [tier=${v.tier}]`
      )
    }
  }

  section("Stale centered-pair table entries")
  if (pairs.stale.length === 0) {
    console.log("(none)")
  } else {
    for (const s of pairs.stale) {
      console.log(
        `${s.outer} / ${s.inner} [tier=${s.tier}] (pair missing from every selector block)`
      )
    }
  }

  section("Zero-slack equations")
  for (const row of zeroSlackExplain) {
    const parts =
      row.parts.length > 0
        ? row.parts
            .map((p) => `${p.times}*${p.token}(${p.px}px)`)
            .join(" + ")
        : "(no parts)"
    const status = row.ok ? "ok" : "FAIL"
    console.log(
      `${status}  ${row.label}: ${row.outer}(${row.outerPx ?? "?"}px) - (${parts}) = ${row.residual ?? "?"}px` +
        (row.reason && !row.ok ? ` [${row.reason}]` : "")
    )
  }

  section("Zero-slack equation violations")
  if (zeroSlack.length === 0) {
    console.log("(none)")
  } else {
    for (const v of zeroSlack) {
      const sel = v.selector ?? "(no selector)"
      console.log(
        `${v.label}: ${sel} ${v.outer}` +
          (v.outerPx != null ? ` (${v.outerPx}px)` : "") +
          ` [${v.reason}]`
      )
    }
  }

  section("Banned token names")
  if (banned.length === 0) {
    console.log("(none)")
  } else {
    for (const b of banned) {
      console.log(
        `${b.selector} ${b.name} = ${b.raw} (pattern: ${b.pattern})`
      )
    }
  }

  section("Informational: hardcoded geometry in df-components.css")
  if (hardcoded.length === 0) {
    console.log("(none)")
  } else {
    /** @type {Map<string, Array<{ line: number, literal: string, value: string }>>} */
    const byProp = new Map()
    for (const hit of hardcoded) {
      const list = byProp.get(hit.property) ?? []
      list.push({
        line: hit.line,
        literal: hit.literal,
        value: hit.value,
      })
      byProp.set(hit.property, list)
    }
    for (const [property, hits] of [...byProp.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      console.log(`${property}:`)
      for (const hit of hits) {
        console.log(
          `  L${hit.line}: ${hit.literal}  (value: ${hit.value})`
        )
      }
    }
  }

  section("Informational: not verifiable by the token audit")
  if (NOT_VERIFIABLE_BY_TOKEN_AUDIT.length === 0) {
    console.log("(none)")
  } else {
    for (const item of NOT_VERIFIABLE_BY_TOKEN_AUDIT) {
      console.log(`${item.where}`)
      console.log(`  ${item.note}`)
    }
  }

  const failCount =
    wholePixel.length +
    pairs.violations.length +
    pairs.stale.length +
    zeroSlack.length +
    banned.length

  section("Summary")
  console.log(`whole-pixel: ${wholePixel.length}`)
  console.log(`centered-pair: ${pairs.violations.length}`)
  console.log(`stale-table: ${pairs.stale.length}`)
  console.log(`zero-slack: ${zeroSlack.length}`)
  console.log(`banned-names: ${banned.length}`)
  console.log(
    `hardcoded-geometry (informational): ${hardcoded.length}`
  )
  console.log(
    `not-verifiable (informational): ${NOT_VERIFIABLE_BY_TOKEN_AUDIT.length}`
  )
  console.log(`exit: ${failCount > 0 ? 1 : 0}`)

  process.exit(failCount > 0 ? 1 : 0)
}

main()
