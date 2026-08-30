#!/usr/bin/env node
/**
 * Smoke tests for discovery CLI helpers and MCP tool wiring.
 * Run: npm run test:discovery
 */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

import { resolveItems } from "./add.mjs"
import {
  checkCoverage,
  getDocs,
  kitSummary,
  listComponents,
  listTokens,
  searchKit,
  showComponent,
} from "./discover.mjs"
import { listSkills, showSkill } from "./skills.mjs"
import { readKitJson } from "./kit-root.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const BIN = path.join(ROOT, "bin/default-file-ui.mjs")

function section(title) {
  console.log(`\n== ${title} ==`)
}

async function testHelpers() {
  section("helpers")
  const summary = kitSummary()
  assert.ok(summary.uiCount >= 20, "expected many UI items")
  assert.ok(summary.totalProps >= 500, `expected rich props, got ${summary.totalProps}`)
  console.log(`summary: ${summary.uiCount} ui, ${summary.totalProps} props`)

  const items = listComponents()
  assert.ok(items.some((i) => i.name === "button"))
  assert.ok(items.some((i) => i.name === "foundation"))
  assert.ok(
    items.some((i) => i.name === "color-system"),
    "expected color-system style item"
  )
  const colorSystem = showComponent("color-system")
  assert.equal(colorSystem.type, "registry:style")
  assert.equal(colorSystem.chapter, "color-system")
  assert.ok(
    (colorSystem.files ?? []).some((f) =>
      String(f.path).includes("df-color-system.css")
    ),
    "color-system must ship df-color-system.css"
  )
  const foundation = showComponent("foundation")
  assert.ok(
    (foundation.registryDependencies ?? []).includes("color-system"),
    "foundation must depend on color-system"
  )
  assert.equal(foundation.chapter, "foundation")
  const colorsDoc = getDocs("colors")
  assert.ok(
    /df-color-system\.css/i.test(colorsDoc.body) &&
      /color scales/i.test(colorsDoc.body) &&
      /semantic tokens/i.test(colorsDoc.body),
    "docs colors topic must describe the color system entry"
  )

  const registry = readKitJson("registry.json")
  const colorOnly = resolveItems(registry, ["color-system"]).map((i) => i.name)
  assert.deepEqual(colorOnly, ["color-system"])
  const buttonChain = resolveItems(registry, ["button"]).map((i) => i.name)
  assert.ok(buttonChain.includes("color-system"))
  assert.ok(buttonChain.includes("foundation"))
  assert.ok(buttonChain.includes("button"))
  for (const item of registry.items ?? []) {
    if (item.type !== "registry:ui") continue
    const chain = resolveItems(registry, [item.name]).map((i) => i.name)
    assert.ok(
      chain.includes("foundation"),
      `${item.name} must resolve foundation`
    )
    assert.ok(
      chain.includes("color-system"),
      `${item.name} must resolve color-system`
    )
  }

  const button = showComponent("button")
  assert.ok(button, "button detail")
  assert.ok(button.api?.groups?.length > 0, "button api groups")
  const propNames = button.api.groups.flatMap((g) => g.props.map((p) => p.name))
  for (const required of ["variant", "size", "leading", "trailing", "disabled"]) {
    assert.ok(propNames.includes(required), `button missing prop ${required}`)
  }
  console.log(`button props: ${propNames.length}`)

  const select = showComponent("select")
  const selectProps = select.api.groups.flatMap((g) => g.props)
  assert.ok(selectProps.length >= 20, `select props too thin: ${selectProps.length}`)
  console.log(`select props: ${selectProps.length}`)

  const search = searchKit("toast")
  assert.ok(search.some((r) => r.name === "toast"))

  const ticSearch = searchKit("tic slider")
  assert.ok(
    ticSearch.some((r) => r.name === "tick-slider" && r.exactAlias),
    "tic slider must exact-match tick-slider"
  )
  assert.ok(
    (ticSearch.find((r) => r.name === "tick-slider")?.score ?? 0) >= 100,
    "exact alias should score like a registry name"
  )

  const sideDrawerShow = showComponent("side drawer")
  assert.equal(
    sideDrawerShow?.name,
    "dock-panel",
    "side drawer alias resolves to dock-panel"
  )

  const optionsSheetShow = showComponent("options sheet")
  assert.equal(
    optionsSheetShow?.name,
    "options-panel",
    "options sheet alias resolves to options-panel"
  )

  const bareToggle = searchKit("toggle")
  assert.ok(
    !bareToggle.some((r) => r.name === "switch" && r.exactAlias),
    "bare toggle must not exact-match switch"
  )

  const tickDetail = showComponent("tick-slider")
  assert.ok(
    (tickDetail.aliases ?? []).includes("tic slider"),
    "show must expose authored aliases"
  )

  const chromeChapter = listComponents({ chapter: "chrome" }).map((i) => i.name)
  assert.ok(
    chromeChapter.includes("floating-controls"),
    "chrome chapter filter must resolve to toolbars"
  )

  const formPopover = searchKit("form popover")
  assert.ok(
    formPopover.some((r) => r.name === "options-panel" && r.exactAlias),
    "form popover must exact-match options-panel"
  )

  const popoverControlsCover = checkCoverage(
    "popover with input fields and buttons"
  )
  assert.ok(
    popoverControlsCover.matched.some((m) => m.name === "options-panel"),
    "popover plus controls must cover options-panel"
  )
  assert.ok(
    popoverControlsCover.matched.some((m) => m.name === "popover"),
    "popover plus controls must still list popover"
  )

  const sliderFamilyCover = checkCoverage("settings slider scrubber")
  assert.ok(
    ["slider", "number-slider", "tick-slider"].every((name) =>
      sliderFamilyCover.matched.some((m) => m.name === name)
    ),
    "slider language must cover the full slider family"
  )

  const cover = checkCoverage("settings form with select, switch, and toast")
  assert.equal(cover.status, "covered")
  assert.ok(cover.matched.some((m) => m.name === "select"))
  assert.ok(cover.matched.some((m) => m.name === "switch"))
  assert.ok(cover.matched.some((m) => m.name === "toast"))
  assert.ok(cover.matched.some((m) => m.name === "input"))
  assert.ok(
    cover.matched.length <= 12,
    `cover matched too many items: ${cover.matched.length}`
  )
  console.log(`cover: ${cover.status} (${cover.matched.length} matches)`)

  const gap = checkCoverage("data table with pagination")
  assert.ok(gap.status === "partial" || gap.status === "gap")
  assert.ok(
    gap.matched.some((row) => row.name === "data-grid"),
    "data table need should match the registered data-grid"
  )
  assert.ok(
    !gap.gaps.some((entry) => /table|data-grid/i.test(entry.need)),
    "registered data-grid must close the table/data-grid gap"
  )
  assert.ok(
    gap.gaps.some((entry) => /pagination/i.test(entry.need)),
    "pagination need must report its own gap when no pagination item exists"
  )
  assert.ok(
    !gap.matched.some((row) => row.name === "contents-nav"),
    "contents-nav must not satisfy a data table need"
  )
  console.log(`gap cover: ${gap.status}, gaps=${gap.gaps.length}`)

  const tocCover = checkCoverage("table of contents")
  assert.ok(
    tocCover.matched.some((row) => row.name === "contents-nav"),
    "table of contents should match contents-nav"
  )
  assert.ok(
    !tocCover.gaps.some((entry) => /table|data-grid/i.test(entry.need)),
    "TOC query must not open a false data-table gap from the word table"
  )

  const skeletonCover = checkCoverage("skeleton placeholder")
  assert.ok(
    !skeletonCover.gaps.some((entry) => /skeleton/i.test(entry.need)),
    "registered skeleton must close the skeleton gap"
  )
  const avatarCover = checkCoverage("user avatar")
  assert.ok(
    !avatarCover.gaps.some((entry) => /avatar/i.test(entry.need)),
    "registered avatar must close the avatar gap"
  )
  assert.ok(
    avatarCover.matched.some((row) => row.name === "avatar"),
    "avatar need should match the registered avatar"
  )

  const tokens = listTokens()
  assert.ok(tokens.tokenCount > 50)
  console.log(`tokens: ${tokens.tokenCount} across ${tokens.groupCount} groups`)

  const skills = listSkills()
  assert.ok(
    skills.some((skill) => skill.name === "design-file-ui"),
    "expected design-file-ui skill"
  )
  const designSkill = showSkill("design-file-ui")
  assert.ok(designSkill.skillMarkdown.includes("name: design-file-ui"))
  assert.ok(
    !/award|awwward|awards-ui/i.test(designSkill.skillMarkdown),
    "skill markdown must stay agnostic"
  )
  assert.ok(
    /Professional findings voice/i.test(designSkill.skillMarkdown),
    "skill markdown must require professional findings voice"
  )
  assert.ok(
    /frontend focused/i.test(designSkill.skillMarkdown),
    "skill markdown must stay frontend focused"
  )
  assert.ok(
    /usage agnostic/i.test(designSkill.skillMarkdown),
    "skill markdown must stay usage agnostic"
  )
  assert.ok(
    /Design thinking freedom/i.test(designSkill.skillMarkdown),
    "skill markdown must preserve design thinking freedom"
  )
  assert.ok(
    /Industry craft bar/i.test(designSkill.skillMarkdown),
    "skill markdown must define an industry craft bar"
  )
  assert.ok(
    /Accessibility baseline/i.test(designSkill.skillMarkdown) &&
      /Structure before paint/i.test(designSkill.skillMarkdown) &&
      /Ship ready decisions/i.test(designSkill.skillMarkdown),
    "skill markdown craft bar must include accessibility, structure, and ship ready decisions"
  )
  assert.ok(
    /must not flatten invention/i.test(designSkill.skillMarkdown) ||
      /Think structure differently/i.test(designSkill.skillMarkdown),
    "skill markdown must keep ability to invent different UI"
  )
  assert.ok(
    /routing labels/i.test(designSkill.skillMarkdown) ||
      /not usage locks/i.test(designSkill.skillMarkdown),
    "skill markdown must treat modes as routing, not usage locks"
  )
  assert.ok(
    /Do not force a dashboard, mobile app, or marketing page/i.test(
      designSkill.skillMarkdown
    ) ||
      /Do not invent a dashboard or mobile shell/i.test(
        designSkill.skillMarkdown
      ),
    "skill markdown must not force mobile/dashboard/marketing usage"
  )
  assert.ok(
    /observation/i.test(designSkill.skillMarkdown) &&
      /impact/i.test(designSkill.skillMarkdown) &&
      /recommendation/i.test(designSkill.skillMarkdown),
    "skill markdown must define observation, impact, recommendation"
  )
  assert.ok(designSkill.references.length >= 3)
  const critiqueRef = designSkill.referenceContents.find(
    (ref) => ref.name === "critique.md"
  )
  assert.ok(critiqueRef, "expected critique.md reference")
  assert.ok(
    /Professional findings/i.test(critiqueRef.content),
    "critique.md must require professional findings"
  )
  assert.ok(
    /usage agnostic/i.test(critiqueRef.content),
    "critique.md must stay usage agnostic"
  )
  console.log(`skills: ${skills.map((s) => s.name).join(", ")}`)
}

async function testCliJson() {
  section("cli --json")
  const result = await runCli(["show", "button", "--json"])
  const data = JSON.parse(result.stdout)
  assert.equal(data.name, "button")
  assert.ok(data.api.groups.length > 0)
  console.log("df-ui show button --json ok")

  const list = await runCli(["list", "--json"])
  const listData = JSON.parse(list.stdout)
  assert.ok(listData.items.length >= 20)
  console.log(`df-ui list --json ok (${listData.items.length} items)`)

  const skillsList = await runCli(["skills", "list", "--json"])
  const skillsData = JSON.parse(skillsList.stdout)
  assert.ok(skillsData.skills.some((skill) => skill.name === "design-file-ui"))
  console.log("df-ui skills list --json ok")
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: ROOT,
      env: process.env,
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`CLI failed (${code}): ${stderr || stdout}`))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

async function testMcp() {
  section("mcp tools")
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BIN, "mcp"],
    cwd: ROOT,
    stderr: "pipe",
  })
  const client = new Client({ name: "df-ui-test", version: "0.0.0" })
  await client.connect(transport)

  try {
    const tools = await client.listTools()
    const names = tools.tools.map((t) => t.name).sort()
    for (const required of [
      "list_components",
      "get_component",
      "list_tokens",
      "search_kit",
      "check_coverage",
      "get_docs",
      "list_skills",
      "get_skill",
      "install_skill",
      "init_project",
      "add_components",
    ]) {
      assert.ok(names.includes(required), `missing tool ${required}`)
    }
    console.log(`tools: ${names.join(", ")}`)

    const skillList = await client.callTool({
      name: "list_skills",
      arguments: {},
    })
    const skillPayload = JSON.parse(skillList.content[0].text)
    assert.ok(skillPayload.skills.some((skill) => skill.name === "design-file-ui"))
    console.log("mcp list_skills ok")

    const listed = await client.callTool({
      name: "list_components",
      arguments: {},
    })
    const listPayload = JSON.parse(listed.content[0].text)
    assert.ok(listPayload.items.length >= 20)

    const component = await client.callTool({
      name: "get_component",
      arguments: { name: "button" },
    })
    const detail = JSON.parse(component.content[0].text)
    const props = detail.api.groups.flatMap((g) => g.props)
    assert.ok(props.some((p) => p.name === "variant"))
    assert.ok(props.every((p) => p.name && p.type && p.description != null))
    console.log(`mcp get_component button: ${props.length} props with types`)

    // Every UI component with API metadata must return props
    const uiNames = listPayload.items
      .filter((i) => i.type === "registry:ui")
      .map((i) => i.name)
    let withProps = 0
    let totalProps = 0
    for (const name of uiNames) {
      const res = await client.callTool({
        name: "get_component",
        arguments: { name },
      })
      const body = JSON.parse(res.content[0].text)
      const count = (body.api?.groups ?? []).reduce(
        (n, g) => n + (g.props?.length ?? 0),
        0
      )
      if (count > 0) {
        withProps += 1
        totalProps += count
      }
    }
    assert.equal(withProps, uiNames.length, "every UI item should expose props")
    console.log(
      `mcp prop sweep: ${withProps}/${uiNames.length} components, ${totalProps} props total`
    )

    const coverage = await client.callTool({
      name: "check_coverage",
      arguments: { need: "settings form with select and toast" },
    })
    const cover = JSON.parse(coverage.content[0].text)
    assert.ok(["covered", "partial"].includes(cover.status))
    console.log(`mcp check_coverage: ${cover.status}`)
  } finally {
    await client.close()
  }
}

async function main() {
  await testHelpers()
  await testCliJson()
  await testMcp()
  console.log("\nAll discovery/MCP smoke tests passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
