import {
  checkCoverage,
  getDocs,
  kitSummary,
  listComponents,
  listTokens,
  searchKit,
  showComponent,
} from "./discover.mjs"

function wantsJson(args) {
  return args.includes("--json")
}

function takeFlagValue(args, name) {
  const index = args.indexOf(name)
  if (index === -1) return null
  return args[index + 1] ?? null
}

function positional(args) {
  return args.filter((arg, i, all) => {
    if (arg.startsWith("-")) return false
    if (i > 0 && all[i - 1].startsWith("--") && !all[i - 1].includes("=")) {
      // value of previous flag
      const prev = all[i - 1]
      if (
        prev === "--type" ||
        prev === "--chapter" ||
        prev === "--group" ||
        prev === "--limit" ||
        prev === "--cwd"
      ) {
        return false
      }
    }
    return true
  })
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2))
}

export function listCommand(args) {
  if (args.includes("-h") || args.includes("--help")) {
    console.log(`
Usage: df-ui list [--type ui|style] [--chapter <chapter>] [--json]

List registry items with titles, chapters, and prop counts.
`)
    return
  }

  const type = takeFlagValue(args, "--type")
  const chapter = takeFlagValue(args, "--chapter")
  const items = listComponents({
    type: type ? (type.startsWith("registry:") ? type : `registry:${type}`) : undefined,
    chapter: chapter ?? undefined,
  }).map((item) => ({
    name: item.name,
    type: item.type,
    title: item.title,
    chapter: item.chapter,
    description: item.description,
    aliases: item.aliases ?? [],
    propCount: item.propCount,
    registryDependencies: item.registryDependencies,
  }))

  if (wantsJson(args)) {
    printJson({ summary: kitSummary(), items })
    return
  }

  const summary = kitSummary()
  console.log(`\nDefault File UI registry (${summary.itemCount} items, ${summary.totalProps} documented props)\n`)
  for (const item of items) {
    const props =
      item.propCount > 0 ? `${item.propCount} props` : item.type === "registry:style" ? "style" : "no api"
    console.log(
      `  ${item.name.padEnd(22)} ${(item.chapter ?? "-").padEnd(12)} ${props.padEnd(10)} ${item.title}`
    )
  }
  console.log("")
}

export function showCommand(args) {
  if (args.includes("-h") || args.includes("--help") || positional(args).length === 0) {
    console.log(`
Usage: df-ui show <name> [--json]

Show one registry item with prop tables when available. Exact aliases resolve.
`)
    return
  }

  const name = positional(args)[0]
  const detail = showComponent(name)
  if (!detail) {
    throw new Error(`Unknown registry item "${name}". Run df-ui list.`)
  }

  if (detail.ambiguous) {
    if (wantsJson(args)) {
      printJson(detail)
      return
    }
    console.log(`\nAmbiguous name "${detail.query}". Exact matches:\n`)
    for (const match of detail.matches) {
      const aliases =
        match.aliases?.length > 0 ? ` (also: ${match.aliases.join(", ")})` : ""
      console.log(`  ${match.name.padEnd(22)} ${match.title}${aliases}`)
      console.log(`    ${match.description}`)
    }
    console.log("\nPick an exact registry name, or run df-ui search.\n")
    return
  }

  if (wantsJson(args)) {
    printJson(detail)
    return
  }

  console.log(`\n${detail.title} (${detail.name})`)
  console.log(`  type:     ${detail.type}`)
  console.log(`  chapter:  ${detail.chapter ?? "n/a"}`)
  if (detail.importPath) console.log(`  import:   ${detail.importPath}`)
  console.log(`  deps:     ${(detail.registryDependencies ?? []).join(", ") || "none"}`)
  if (detail.aliases?.length) {
    console.log(`  aliases:  ${detail.aliases.join(", ")}`)
  }
  console.log(`\n${detail.docsDescription || detail.description}\n`)

  if (detail.api?.groups?.length) {
    for (const group of detail.api.groups) {
      console.log(`${group.title}`)
      if (group.description) console.log(`  ${group.description}`)
      for (const prop of group.props ?? []) {
        const def = prop.default != null ? ` = ${prop.default}` : ""
        console.log(`  - ${prop.name}: ${prop.type}${def}`)
        if (prop.description) console.log(`      ${prop.description}`)
      }
      console.log("")
    }
  } else if (detail.type === "registry:style") {
    console.log(
      "Style item. See df-ui docs colors or foundation, and df-ui tokens.\n"
    )
  } else {
    console.log("No prop API metadata shipped for this item yet.\n")
  }
}

export function tokensCommand(args) {
  if (args.includes("-h") || args.includes("--help")) {
    console.log(`
Usage: df-ui tokens [--group <group>] [--json]

List design tokens from kit CSS. Groups include color-scale, semantic-color,
radius, typography, spacing, shadow, motion, and more.
`)
    return
  }

  const group = takeFlagValue(args, "--group")
  const includeTokens = args.includes("--all")
  const data = listTokens({
    group: group ?? undefined,
    includeTokens,
  })

  if (wantsJson(args)) {
    printJson(data)
    return
  }

  console.log(`\nDefault File UI tokens (${data.tokenCount} in ${data.groupCount} group(s))\n`)
  for (const entry of data.groups) {
    console.log(`  ${entry.group} (${entry.count})`)
    const names = entry.tokens ?? entry.sample ?? []
    const preview = names.slice(0, 8).join(", ")
    const more = entry.count > 8 ? `, … +${entry.count - 8}` : ""
    console.log(`    ${preview}${more}`)
  }
  console.log("")
}

export function searchCommand(args) {
  if (args.includes("-h") || args.includes("--help") || positional(args).length === 0) {
    console.log(`
Usage: df-ui search <query> [--limit N] [--json]

Search registry names, titles, aliases, descriptions, and capability tags.
`)
    return
  }

  const query = positional(args).join(" ")
  const limitRaw = takeFlagValue(args, "--limit")
  const limit = limitRaw ? Number(limitRaw) : 20
  const results = searchKit(query, { limit })

  if (wantsJson(args)) {
    printJson({ query, results })
    return
  }

  console.log(`\nSearch: ${query}\n`)
  if (results.length === 0) {
    console.log("  No matches.\n")
    return
  }
  for (const row of results) {
    console.log(
      `  ${row.name.padEnd(22)} score ${String(row.score).padStart(3)}  ${row.title}`
    )
  }
  console.log("")
}

export function coverCommand(args) {
  if (args.includes("-h") || args.includes("--help") || positional(args).length === 0) {
    console.log(`
Usage: df-ui cover <need…> [--json]

Assess whether the kit covers a UI surface. Returns covered, partial, or gap.
`)
    return
  }

  const need = positional(args).join(" ")
  const report = checkCoverage(need)

  if (wantsJson(args)) {
    printJson(report)
    return
  }

  console.log(`\nCoverage: ${report.status}`)
  console.log(`Query: ${report.query}`)
  console.log(`\n${report.summary}\n`)
  if (report.matched.length) {
    console.log("Matched:")
    for (const row of report.matched) {
      console.log(`  + ${row.name.padEnd(22)} ${row.reason}`)
    }
    console.log("")
  }
  if (report.gaps.length) {
    console.log("Gaps:")
    for (const gap of report.gaps) {
      console.log(`  - ${gap.need}`)
      console.log(`    ${gap.suggestion}`)
    }
    console.log("")
  }
  if (report.installHint) {
    console.log(`Install hint:\n  ${report.installHint}\n`)
  }
}

export function docsCommand(args) {
  if (args.includes("-h") || args.includes("--help")) {
    console.log(`
Usage: df-ui docs [overview|install|colors|mcp|tokens|foundation|skills] [--json]

Print kit guidance for humans and agents.
`)
    return
  }

  const topic = positional(args)[0] ?? "overview"
  const doc = getDocs(topic)

  if (wantsJson(args)) {
    printJson(doc)
    return
  }

  console.log(`\n${doc.title}\n`)
  console.log(doc.body)
  console.log("")
}
