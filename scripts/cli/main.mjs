import { FRAMEWORKS, PACKAGE_SPEC } from "./constants.mjs"
import { addCommand } from "./add.mjs"
import {
  coverCommand,
  docsCommand,
  listCommand,
  searchCommand,
  showCommand,
  tokensCommand,
} from "./discovery-commands.mjs"
import { infoCommand } from "./info.mjs"
import { initCommand } from "./init.mjs"
import { kitVersion } from "./kit-root.mjs"
import { startMcpServer } from "./mcp.mjs"
import { skillsCommand } from "./skills.mjs"
import { upgradeCommand } from "./upgrade.mjs"

export async function run(argv) {
  const [command, ...rest] = argv

  if (!command || command === "-h" || command === "--help") {
    printHelp()
    return
  }

  if (command === "-V" || command === "--version" || command === "version") {
    console.log(kitVersion())
    return
  }

  if (command === "init") {
    await initCommand(rest)
    return
  }

  if (command === "add") {
    await addCommand(rest)
    return
  }

  if (command === "upgrade") {
    await upgradeCommand(rest)
    return
  }

  if (command === "info") {
    infoCommand(rest)
    return
  }

  if (command === "frameworks") {
    console.log(FRAMEWORKS.join("\n"))
    return
  }

  if (command === "list") {
    listCommand(rest)
    return
  }

  if (command === "show") {
    showCommand(rest)
    return
  }

  if (command === "tokens") {
    tokensCommand(rest)
    return
  }

  if (command === "search") {
    searchCommand(rest)
    return
  }

  if (command === "cover") {
    coverCommand(rest)
    return
  }

  if (command === "docs") {
    docsCommand(rest)
    return
  }

  if (command === "skills") {
    skillsCommand(rest)
    return
  }

  if (command === "mcp") {
    await startMcpServer()
    return
  }

  throw new Error(`Unknown command "${command}". Run with --help.`)
}

function printHelp() {
  console.log(`
Default File UI CLI (v${kitVersion()})

Usage:
  df-ui <command>

Commands:
  init         Scaffold (-t) or configure an existing React app; writes df.json
  add          Copy registry items into your app. Keeps existing files unless --force.
  upgrade      Replace copied items with the current CLI release (df.json copied).
  info         Print kit version, detected framework, and df.json
  version      Print the design system semver
  frameworks   List supported framework templates
  list         List registry items (components, color-system, foundation)
  show         Show one item with full prop API tables
  tokens       List design tokens from kit CSS
  search       Search components by keyword
  cover        Coverage check for a UI need
  docs         Install and agent guidance
  skills       List, show, or install bundled Agent Skills
  mcp          Start stdio MCP server for AI hosts

Examples:
  npx --yes -p ${PACKAGE_SPEC} df-ui init -t next
  df-ui init --framework vite --color-scale compact
  df-ui add button select
  df-ui add button --force
  df-ui upgrade
  df-ui version
  df-ui list --json
  df-ui show button --json
  df-ui cover "settings form with select and toast" --json
  df-ui skills install design-file-ui
  df-ui mcp
`)
}
