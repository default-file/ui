import fs from "node:fs"

import { PACKAGE_SPEC, REPO_SLUG } from "./constants.mjs"
import { kitFileExists, kitPath, readKitJson } from "./kit-root.mjs"

/** Capability tags used by search and coverage matching. */
const CHAPTER_TAGS = {
  "color-system": ["color", "token", "utility", "scale", "palette", "theme"],
  foundation: ["foundation", "css", "hook", "token"],
  actions: ["action", "button", "cta", "submit", "click"],
  inputs: [
    "form",
    "input",
    "field",
    "control",
    "select",
    "toggle",
    "switch",
    "slider",
    "checkbox",
    "radio",
    "search",
    "filter",
  ],
  feedback: ["toast", "message", "alert", "status", "badge", "tooltip", "hint"],
  overlays: ["popover", "menu", "dropdown", "panel", "modal", "dialog", "overlay"],
  structure: ["layout", "section", "tabs", "separator", "scroll", "card", "text"],
  text: ["text", "typography", "headline", "mark", "gradient"],
  toolbars: ["toolbar", "dock", "floating", "tool", "controls", "bar"],
  chrome: ["toolbar", "dock", "floating", "tool", "controls", "bar"],
}

/**
 * Capability gaps the registry does not cover yet. `tokens` are whole labels
 * that mean the need asks for the capability. `satisfiedBy` names the registry
 * items that provide it, so a rule stops reporting a gap as soon as one of
 * those items ships and the registry stays the single source of coverage.
 */
const CAPABILITY_GAPS = [
  {
    tokens: ["breadcrumb", "breadcrumbs", "breadcrumb trail"],
    satisfiedBy: ["breadcrumb"],
    gap: "Breadcrumb primitive",
    suggestion:
      "Compose a trail with List Item, Separator, and kit text tokens.",
    related: ["list-item", "separator", "contents-nav"],
  },
  {
    tokens: ["pagination", "pager", "page controls"],
    satisfiedBy: ["pagination"],
    gap: "Pagination primitive",
    suggestion: "Compose page controls with Button, Select, and kit tokens.",
    related: ["button", "select", "option-list"],
  },
]

/** Capability gap rules, for coverage reporting and registry drift checks. */
export function capabilityGapRules() {
  return CAPABILITY_GAPS.map((rule) => ({
    tokens: [...rule.tokens],
    satisfiedBy: [...rule.satisfiedBy],
    gap: rule.gap,
  }))
}

/** Coverage family hints. Optional alsoRequires narrows when the pattern alone is too broad. */
const COMPOSE_HINTS = [
  {
    patterns: /\bpopover\b/i,
    alsoRequires: /\b(input|inputs|button|buttons|form|control|controls|field|fields)\b/i,
    include: ["options-panel", "popover"],
    reason: "Anchored panel family: Popover or Options Panel",
  },
  {
    patterns: /\b(slider|scrubber)\b/i,
    include: ["slider", "number-slider", "tick-slider"],
    reason: "Slider family",
  },
  {
    patterns: /\b(segmented|segment control|view mode|mode switcher)\b/i,
    include: ["content-switcher", "toggle-group", "tabs"],
    reason: "Segment and mode selection family",
  },
  {
    patterns: /\b(drawer|side panel|inspector)\b/i,
    include: ["dock-panel", "options-panel", "dialog"],
    reason: "Overlay and inspector shell family",
  },
]

/** Lowercase label with punctuation folded to spaces for exact matching. */
function normalizeLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Closed-up spelling of a multi-word label, for example "data grid" to
 * "datagrid". Returns null for labels that are already a single word.
 */
function collapseLabel(normalized) {
  if (!normalized || !normalized.includes(" ")) return null
  return normalized.replace(/ /g, "")
}

/**
 * Every whole label that identifies an item: its name, title, and aliases, each
 * with its closed-up spelling. Callers match against these, never substrings.
 */
function buildMatchLabels(name, title, aliases) {
  const labels = new Set()
  for (const raw of [name, title, ...aliases]) {
    const normalized = normalizeLabel(raw)
    if (!normalized) continue
    labels.add(normalized)
    const collapsed = collapseLabel(normalized)
    if (collapsed) labels.add(collapsed)
  }
  return [...labels]
}

function readAliases(meta) {
  if (!Array.isArray(meta?.aliases)) return []
  return meta.aliases
    .map((alias) => String(alias ?? "").trim())
    .filter(Boolean)
}

/** Phrase match, or whole-word match for single-token labels. */
function needIncludesLabel(normalizedNeed, label) {
  if (!label) return false
  if (label.includes(" ")) return normalizedNeed.includes(label)
  return new RegExp(`(?:^| )${label}(?: |$)`).test(` ${normalizedNeed} `)
}

let cached = null

function loadBundle() {
  if (cached) return cached

  const registry = readKitJson("registry.json")
  const catalog = kitFileExists("docs", "catalog.json")
    ? readKitJson("docs", "catalog.json")
    : null
  const apiIndex = kitFileExists("docs", "api", "index.json")
    ? readKitJson("docs", "api", "index.json")
    : null

  const catalogByName = new Map(
    (catalog?.components ?? []).map((item) => [item.name, item])
  )
  for (const styleMeta of [catalog?.colorSystem, catalog?.foundation]) {
    if (styleMeta?.registryName) {
      catalogByName.set(styleMeta.registryName, {
        ...styleMeta,
        name: styleMeta.registryName,
      })
    }
  }

  const items = (registry.items ?? []).map((item) => {
    const meta = catalogByName.get(item.name)
    const chapter =
      meta?.chapter ??
      (item.name === "color-system"
        ? "color-system"
        : item.type === "registry:style"
          ? "foundation"
          : null)
    const title = meta?.title ?? item.title ?? item.name
    const description = meta?.description ?? item.description ?? ""
    const aliases = readAliases(meta)
    const matchLabels = buildMatchLabels(item.name, title, aliases)
    const tags = buildTags(item, meta, chapter, title, description, aliases)
    const coverTerms = buildCoverTerms(item.name, title, chapter, aliases)
    return {
      name: item.name,
      type: item.type,
      title,
      description,
      aliases,
      chapter,
      registryDependencies: item.registryDependencies ?? meta?.registryDependencies ?? [],
      dependencies: item.dependencies ?? meta?.dependencies ?? [],
      files: (item.files ?? []).map((file) => ({
        path: file.path,
        target: file.target,
        type: file.type,
      })),
      importPath: meta?.importPath ?? null,
      propCount: meta?.propCount ?? 0,
      matchLabels,
      tags,
      coverTerms,
    }
  })

  cached = { registry, catalog, apiIndex, items, byName: new Map(items.map((i) => [i.name, i])) }
  return cached
}

function buildTags(item, meta, chapter, title, description, aliases = []) {
  const tags = new Set()
  tags.add(item.name)
  if (item.type) tags.add(item.type.replace(/^registry:/, ""))
  if (chapter) {
    tags.add(chapter)
    for (const tag of CHAPTER_TAGS[chapter] ?? []) tags.add(tag)
  }
  for (const word of `${title} ${description}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)) {
    tags.add(word)
  }
  for (const alias of aliases) {
    const normalized = normalizeLabel(alias)
    if (normalized) tags.add(normalized)
    const collapsed = collapseLabel(normalized)
    if (collapsed) tags.add(collapsed)
    for (const word of normalized.split(" ").filter((w) => w.length > 2)) {
      tags.add(word)
    }
  }
  return [...tags]
}

/** Coverage terms from whole labels, name parts, title words, and chapter. */
function buildCoverTerms(name, title, chapter, aliases = []) {
  const terms = new Set()
  terms.add(name)
  for (const label of buildMatchLabels(name, title, aliases)) terms.add(label)
  for (const part of name.split("-").filter((w) => w.length > 2)) terms.add(part)
  for (const word of title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)) {
    terms.add(word)
  }
  for (const alias of aliases) {
    const normalized = normalizeLabel(alias)
    if (normalized) terms.add(normalized)
  }
  if (chapter) terms.add(chapter)
  return [...terms]
}

function itemAliasLabels(item) {
  return (item.aliases ?? []).map(normalizeLabel).filter(Boolean)
}

function hasExactLabelMatch(item, query) {
  const q = normalizeLabel(query)
  if (!q) return false
  return (item.matchLabels ?? []).includes(q)
}

/**
 * True when the need requests this token as its own label, not only as a word
 * inside a longer alias phrase that already appears in the need (for example
 * "table" inside "table of contents").
 */
function needRequestsToken(normalizedNeed, token, items) {
  const tokenNorm = normalizeLabel(token)
  if (!tokenNorm || !needIncludesLabel(normalizedNeed, tokenNorm)) return false

  let remainder = ` ${normalizedNeed} `
  for (const item of items) {
    for (const aliasNorm of itemAliasLabels(item)) {
      if (!aliasNorm.includes(" ")) continue
      if (aliasNorm === tokenNorm) continue
      if (!needIncludesLabel(aliasNorm, tokenNorm)) continue
      if (!needIncludesLabel(normalizedNeed, aliasNorm)) continue
      remainder = remainder.split(` ${aliasNorm} `).join(" ")
    }
  }
  return needIncludesLabel(remainder.replace(/\s+/g, " ").trim(), tokenNorm)
}

/** Coverage report for a free-text UI need (covered, partial, or gap). */
export function checkCoverage(need) {
  const query = String(need ?? "").trim()
  const normalizedNeed = normalizeLabel(query)
  const { items, byName } = loadBundle()
  const matched = matchNeedToItems(query, items)
  const gaps = []

  for (const rule of CAPABILITY_GAPS) {
    const requested = rule.tokens.some((token) =>
      needRequestsToken(normalizedNeed, token, items)
    )
    if (!requested) continue
    if (rule.satisfiedBy.some((name) => byName.has(name))) continue
    gaps.push({
      need: rule.gap,
      suggestion: rule.suggestion,
      related: rule.related.filter((name) => byName.has(name)),
    })
  }

  // Form surfaces: suggest core form primitives when form-like language appears
  if (/\b(form|settings|profile|login|signup)\b/i.test(query)) {
    for (const name of ["input", "label", "button"]) {
      if (!matched.some((m) => m.name === name) && byName.has(name)) {
        matched.push({
          name,
          title: byName.get(name).title,
          reason: "Common form control",
        })
      }
    }
  }

  for (const hint of COMPOSE_HINTS) {
    if (!hint.patterns.test(query)) continue
    if (hint.alsoRequires && !hint.alsoRequires.test(query)) continue
    for (const name of hint.include) {
      if (matched.some((m) => m.name === name) || !byName.has(name)) continue
      matched.push({
        name,
        title: byName.get(name).title,
        reason: hint.reason,
      })
    }
  }

  let status = "gap"
  if (matched.length > 0 && gaps.length === 0) status = "covered"
  else if (matched.length > 0) status = "partial"

  const installNames = matched.map((m) => m.name)
  return {
    query,
    status,
    matched,
    gaps,
    installHint:
      installNames.length > 0 ? `df-ui add ${installNames.join(" ")}` : null,
    summary:
      status === "covered"
        ? `Kit covers this surface with ${matched.length} item(s).`
        : status === "partial"
          ? `Kit partially covers this surface (${matched.length} match(es), ${gaps.length} gap(s)).`
          : "No strong registry matches. Review gaps and compose with foundation tokens.",
  }
}

const CHAPTER_FILTER_ALIASES = {
  chrome: "toolbars",
}

/** List registry items, optionally filtered by type or chapter. */
export function listComponents({ type, chapter } = {}) {
  const { items } = loadBundle()
  const resolvedChapter = chapter
    ? (CHAPTER_FILTER_ALIASES[chapter] ?? chapter)
    : undefined
  return items.filter((item) => {
    if (type && item.type !== type && item.type !== `registry:${type}`) return false
    if (resolvedChapter && item.chapter !== resolvedChapter) return false
    return true
  })
}

/** Load prop API JSON for a registry item, or null when missing. */
export function loadComponentApi(name) {
  const slug = name
  if (!kitFileExists("docs", "api", `${slug}.json`)) return null
  return readKitJson("docs", "api", `${slug}.json`)
}

function enrichComponent(item) {
  const apiDoc = loadComponentApi(item.name)
  return {
    ...item,
    api: apiDoc?.api ?? null,
    docsDescription: apiDoc?.description ?? item.description,
  }
}

/** Registry item with prop API. Exact aliases resolve; shared aliases return { ambiguous, matches }. */
export function showComponent(name) {
  const { byName, items } = loadBundle()
  const direct = byName.get(name)
  if (direct) return enrichComponent(direct)

  const q = normalizeLabel(name)
  if (!q) return null
  const hits = items.filter((item) => hasExactLabelMatch(item, q))
  if (hits.length === 1) return enrichComponent(hits[0])
  if (hits.length > 1) {
    return {
      ambiguous: true,
      query: name,
      matches: hits.map((item) => ({
        name: item.name,
        title: item.title,
        description: item.description,
        aliases: item.aliases ?? [],
        chapter: item.chapter,
        importPath: item.importPath,
      })),
    }
  }
  return null
}

/** Ranked search over names, titles, aliases, descriptions, and tags. */
export function searchKit(query, { limit = 20 } = {}) {
  const raw = String(query ?? "").trim()
  const q = raw.toLowerCase()
  if (!q) return []
  const normalizedQuery = normalizeLabel(raw)
  const terms = normalizedQuery.split(" ").filter(Boolean)
  const { items } = loadBundle()

  const scored = items
    .map((item) => {
      const aliases = item.aliases ?? []
      const aliasHay = aliases.map(normalizeLabel).filter(Boolean)
      const hay = [
        item.name,
        item.title,
        item.description,
        item.chapter ?? "",
        ...aliases,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase()
      let score = 0
      if (item.name === q || normalizeLabel(item.name) === normalizedQuery) score += 100
      if (normalizeLabel(item.title) === normalizedQuery) score += 100
      if (aliasHay.includes(normalizedQuery)) score += 100
      if (item.name.includes(q)) score += 40
      if (item.title.toLowerCase().includes(q)) score += 30
      if (
        aliasHay.some(
          (alias) =>
            alias !== normalizedQuery &&
            (needIncludesLabel(alias, normalizedQuery) ||
              needIncludesLabel(normalizedQuery, alias))
        )
      ) {
        score += 50
      }
      for (const term of terms) {
        if (item.name.includes(term)) score += 12
        if (hay.includes(term)) score += 4
        if (item.tags.includes(term)) score += 6
      }
      return { item, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))

  return scored.slice(0, limit).map((row) => ({
    name: row.item.name,
    title: row.item.title,
    type: row.item.type,
    chapter: row.item.chapter,
    description: row.item.description,
    aliases: row.item.aliases ?? [],
    score: row.score,
    propCount: row.item.propCount,
    exactAlias: hasExactLabelMatch(row.item, raw),
  }))
}

function matchNeedToItems(needText, items) {
  const normalizedNeed = normalizeLabel(needText)
  const terms = new Set(normalizedNeed.split(" ").filter((t) => t.length > 2))
  const matched = []

  for (const item of items) {
    if (item.name === "foundation" || item.name === "color-system") continue
    let reason = null
    if (
      terms.has(item.name) ||
      needIncludesLabel(normalizedNeed, item.name.replace(/-/g, " "))
    ) {
      reason = `Named ${item.title}`
    } else if (hasExactLabelMatch(item, needText)) {
      reason = `Alias match for ${item.title}`
    } else {
      for (const alias of itemAliasLabels(item)) {
        if (alias.length > 2 && needIncludesLabel(normalizedNeed, alias)) {
          reason = `Alias "${alias}"`
          break
        }
      }
    }
    if (!reason) {
      for (const term of item.coverTerms ?? []) {
        if (term === item.chapter) continue
        if (term.includes(" ") ? needIncludesLabel(normalizedNeed, term) : terms.has(term)) {
          reason = `Matches ${term}`
          break
        }
      }
    }
    if (reason) matched.push({ name: item.name, title: item.title, reason })
  }

  // Stable unique by name
  const seen = new Set()
  return matched.filter((row) => {
    if (seen.has(row.name)) return false
    seen.add(row.name)
    return true
  })
}

/** Install, MCP, tokens, and foundation guidance shipped with the kit. */
export function getDocs(topic = "overview") {
  const key = String(topic || "overview").toLowerCase()
  const docs = {
    overview: {
      topic: "overview",
      title: "Default File UI",
      body: [
        "Default File UI is a design system: color system, tokens, components, CSS, CLI, and MCP.",
        "Color system (no components): @import \"@default-file/ui/css/df-color-system.css\"; or df-ui add color-system.",
        "Full kit: @import \"@default-file/ui/css/df-index.css\"; then import from @default-file/ui/components/df-*.",
        "Copy source components: df-ui init, then df-ui add <items>. Foundation depends on color-system.",
        "Ownership: local copy source files stay in your app. Kit releases do not replace them unless you run df-ui add <item> --force.",
        "Version: package.json semver. df-ui init records it in df.json. df-ui version and df-ui info print it.",
        "AI hosts: df-ui mcp (stdio) for components, props, tokens, coverage, skills, and install.",
      ].join("\n"),
    },
    install: {
      topic: "install",
      title: "Install",
      body: [
        `Scaffold: npx --yes -p ${PACKAGE_SPEC} df-ui init -t next`,
        "Existing app: df-ui init (writes df.json with kit version; supports --framework, --color-scale, --radius, --corner-shape, --hover-border, --install-mode)",
        "Copy source: df-ui init --install-mode registry copies foundation and does not add the kit package. Import the local default-file-ui CSS.",
        "Color system: df-ui add color-system, or package CSS @import \"@default-file/ui/css/df-color-system.css\"",
        "Components: df-ui add button select (resolves foundation and color-system). Existing files are kept unless --force.",
        "Copied files record their kit version in df.json copied. df-ui info lists them. df-ui upgrade replaces them with the current CLI release.",
        "Package imports: upgrade the @default-file/ui dependency when you want package updates. App files are not overwritten.",
        `Agent skill: npx skills add ${REPO_SLUG} --skill design-file-ui`,
        "Component peers (optional at package level): react, react-dom, lucide-react, rough-notation",
        "Full kit CSS: @import \"@default-file/ui/css/df-index.css\";",
        "Check versions: df-ui version (release) and df-ui info (df.json version vs release).",
      ].join("\n"),
    },
    colors: {
      topic: "colors",
      title: "Color system",
      body: [
        "Color system ships color scales, semantic tokens, and utilities without React components.",
        `Package entry: @import "@default-file/ui/css/df-color-system.css"; after npm install ${PACKAGE_SPEC}`,
        "Copy source: df-ui add color-system, then @import the local default-file-ui/css/df-color-system.css",
        "Host modes on <html>: data-df-color-scale=\"detailed\" (default) or \"compact\".",
        "Token inventory: df-ui tokens --group color-scale or --group semantic-color.",
        "Components resolve color-system through foundation automatically.",
      ].join("\n"),
    },
    mcp: {
      topic: "mcp",
      title: "MCP",
      body: [
        "Start: df-ui mcp (stdio). Works with any MCP-capable host.",
        "Tools: list_components, get_component, list_tokens, search_kit, check_coverage, get_docs, list_skills, get_skill, install_skill, init_project, add_components, upgrade_copied.",
        "get_component returns full prop tables from docs/api when available.",
        `Host config example: command df-ui, args ["mcp"] (or npx -p ${PACKAGE_SPEC} df-ui mcp).`,
      ].join("\n"),
    },
    skills: {
      topic: "skills",
      title: "Skills",
      body: [
        "Bundled Agent Skill: design-file-ui (principles for distinctive frontend UI).",
        `Open ecosystem: npx skills add ${REPO_SLUG} --skill design-file-ui`,
        "Kit CLI: df-ui skills list | show design-file-ui | install design-file-ui",
        "install copies into .agents/skills and .cursor/skills in the project.",
        "MCP: list_skills, get_skill, install_skill.",
      ].join("\n"),
    },
    tokens: {
      topic: "tokens",
      title: "Tokens",
      body: [
        "Primitives use --df-* names (color, type, space, radius, shadow, motion, opacity, z-index, control sizes).",
        "Semantic tokens (--background, --border, --brand-ink, ...) point at primitives.",
        "Color scale modes: data-df-color-scale=\"detailed\" (default) or \"compact\" on <html>.",
        "Field hover border: data-df-hover-border=\"on\" (default) or \"off\" on <html>; df-ui init --hover-border.",
        "Use df-ui tokens to list machine-readable token names from the kit CSS.",
      ].join("\n"),
    },
    foundation: {
      topic: "foundation",
      title: "Foundation",
      body: [
        "Foundation is the kit style item: df-index.css, component CSS, hooks, and cn.",
        "Depends on color-system.",
        "Install: df-ui add foundation, or add any component (resolves foundation).",
        "Package CSS: @import \"@default-file/ui/css/df-index.css\";",
        "Color system without components: df-ui docs colors.",
      ].join("\n"),
    },
  }

  if (docs[key]) return docs[key]
  return {
    topic: key,
    title: "Unknown topic",
    body: `Unknown docs topic "${key}". Use one of: ${Object.keys(docs).join(", ")}.`,
    available: Object.keys(docs),
  }
}

/** High-level kit inventory for agents (counts, chapters, prop totals). */
export function kitSummary() {
  const { items, apiIndex } = loadBundle()
  const ui = items.filter((i) => i.type === "registry:ui")
  const totalProps = (apiIndex?.components ?? []).reduce(
    (n, c) => n + (c.propCount ?? 0),
    0
  )
  return {
    name: "@default-file/ui",
    itemCount: items.length,
    uiCount: ui.length,
    componentsWithApi: apiIndex?.components?.length ?? 0,
    totalProps,
    chapters: [...new Set(ui.map((i) => i.chapter).filter(Boolean))],
  }
}

/** Parse token CSS into grouped name lists for df-ui tokens. */
export function parseTokenIndex() {
  const tokensPath = kitPath("src", "css", "df-tokens.css")
  const scalesPath = kitPath("src", "css", "df-color-scales.css")
  const files = [tokensPath, scalesPath].filter((p) => fs.existsSync(p))
  const byGroup = new Map()

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8")
    const matches = text.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)
    for (const match of matches) {
      const name = `--${match[1]}`
      const group = tokenGroup(name)
      if (!byGroup.has(group)) byGroup.set(group, new Set())
      byGroup.get(group).add(name)
    }
  }

  const groups = [...byGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, set]) => ({
      group,
      count: set.size,
      tokens: [...set].sort(),
    }))

  return {
    source: ["src/css/df-tokens.css", "src/css/df-color-scales.css"],
    groupCount: groups.length,
    tokenCount: groups.reduce((n, g) => n + g.count, 0),
    groups,
  }
}

function tokenGroup(name) {
  if (name.startsWith("--df-neutral") || name.startsWith("--df-brand")) return "color-scale"
  if (
    [
      "--background",
      "--foreground",
      "--card",
      "--popover",
      "--primary",
      "--secondary",
      "--muted",
      "--accent",
      "--destructive",
      "--border",
      "--input",
      "--ring",
      "--brand-ink",
    ].some((prefix) => name === prefix || name.startsWith(`${prefix}-`))
  ) {
    return "semantic-color"
  }
  if (name.startsWith("--radius") || name.includes("corner-shape")) return "radius"
  if (name.startsWith("--df-text") || name.startsWith("--df-font")) return "typography"
  if (name.startsWith("--df-space") || name === "--spacing-unit") return "spacing"
  if (name.includes("shadow")) return "shadow"
  if (name.includes("ease") || name.includes("duration") || name.includes("motion")) {
    return "motion"
  }
  if (name.includes("opacity") || name.startsWith("--df-opacity")) return "opacity"
  if (name.startsWith("--z-") || name.includes("z-index") || name.startsWith("--df-z")) {
    return "z-index"
  }
  if (name.includes("control") || name.includes("touch")) return "control"
  if (name.includes("border-width") || name.includes("outline")) return "border"
  if (name.startsWith("--chart")) return "chart"
  if (name.startsWith("--df-")) return "df-primitive"
  return "other"
}

/** Token inventory by group. Pass includeTokens or a group to expand names. */
export function listTokens({ group, includeTokens = false } = {}) {
  const index = parseTokenIndex()
  const filtered = group
    ? index.groups.filter((g) => g.group === group)
    : index.groups
  // Full token arrays are large (color scales). Expand when a group is selected
  // or when includeTokens is true.
  const expand = Boolean(group) || includeTokens
  return {
    source: index.source,
    groupCount: filtered.length,
    tokenCount: filtered.reduce((n, g) => n + g.count, 0),
    groups: filtered.map((entry) =>
      expand
        ? entry
        : {
            group: entry.group,
            count: entry.count,
            sample: entry.tokens.slice(0, 12),
          }
    ),
  }
}
