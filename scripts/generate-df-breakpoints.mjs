#!/usr/bin/env node
import fs from "node:fs"
import {
  BREAKPOINT_NAMES,
  BREAKPOINTS,
  breakpointMaxWidth,
  breakpointMinWidth,
} from "./df-theme.mjs"

const componentsTarget = new URL("../src/css/df-components.css", import.meta.url)
const tokensTarget = new URL("../src/css/df-tokens.css", import.meta.url)

function value(token) {
  const max = token.match(/^max-(.+)$/)
  if (max) {
    return ["max-width", breakpointMaxWidth(max[1])]
  }
  return ["min-width", breakpointMinWidth(token)]
}

function syncTaggedMedia(css) {
  let count = 0
  const next = css.replace(
    /@media \((?:min|max)-width:\s*[\d.]+px\) \{ \/\* df-bp:([\w-]+) \*\//g,
    (_full, token) => {
      const [feature, px] = value(token)
      count += 1
      return (
        "@media (" +
        feature +
        ": " +
        px +
        ") { /* df-bp:" +
        token +
        " */"
      )
    }
  )
  return { css: next, count }
}

function emitBreakpointTokens(css) {
  const lines = BREAKPOINT_NAMES.map(
    (name) => `  --df-breakpoint-${name}: ${BREAKPOINTS[name]};`
  )
  const block = [
    "  /* df-generated:breakpoints */",
    ...lines,
    "  /* /df-generated:breakpoints */",
  ].join("\n")

  const marker =
    /  \/\* df-generated:breakpoints \*\/[\s\S]*?  \/\* \/df-generated:breakpoints \*\//
  if (marker.test(css)) {
    return { css: css.replace(marker, block), mode: "updated" }
  }

  const spacingAnchor = /(\s*--spacing-unit:\s*[^;]+;\n)/
  if (spacingAnchor.test(css)) {
    return {
      css: css.replace(spacingAnchor, `$1\n${block}\n`),
      mode: "inserted",
    }
  }

  throw new Error(
    "df:breakpoints: could not find --spacing-unit in df-tokens.css to insert breakpoint tokens"
  )
}

let componentsCss = fs.readFileSync(componentsTarget, "utf8")
const originalComponents = componentsCss
const tagged = syncTaggedMedia(componentsCss)
componentsCss = tagged.css

if (componentsCss !== originalComponents) {
  fs.writeFileSync(componentsTarget, componentsCss)
  console.log(
    `df:breakpoints: resolved ${tagged.count} tagged media query(ies) from BREAKPOINTS`
  )
} else {
  console.log(
    `df:breakpoints: ${tagged.count} tagged query(ies) already in sync`
  )
}

let tokensCss = fs.readFileSync(tokensTarget, "utf8")
const originalTokens = tokensCss
const tokens = emitBreakpointTokens(tokensCss)
tokensCss = tokens.css

if (tokensCss !== originalTokens) {
  fs.writeFileSync(tokensTarget, tokensCss)
  console.log(
    `df:breakpoints: ${tokens.mode} CSS breakpoint tokens in df-tokens.css`
  )
} else {
  console.log("df:breakpoints: CSS breakpoint tokens already in sync")
}
