import path from "node:path"

import { addCommand } from "./add.mjs"
import { readDfConfig } from "./df-config.mjs"

export async function upgradeCommand(args) {
  const options = parseUpgradeArgs(args)
  if (options.help) {
    printUpgradeHelp()
    return
  }

  const cwd = path.resolve(options.cwd)
  const config = readDfConfig(cwd)
  const copied = config?.copied && typeof config.copied === "object" ? config.copied : {}
  const names = Object.keys(copied)
  if (names.length === 0) {
    throw new Error("No copied items in df.json. Run df-ui add first.")
  }

  const argv = [...names, "--force", "--cwd", cwd]
  if (options.dir) argv.push("--dir", options.dir)
  await addCommand(argv)
}

function parseUpgradeArgs(args) {
  const options = {
    cwd: process.cwd(),
    dir: null,
    help: false,
  }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "-h" || arg === "--help") options.help = true
    else if (arg === "--cwd") options.cwd = args[++i] ?? process.cwd()
    else if (arg === "--dir") options.dir = args[++i] ?? null
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function printUpgradeHelp() {
  console.log(`
Usage:
  df-ui upgrade

Replace copied kit files with the current CLI release. Reads item names from
df.json \`copied\`. Local files that were never added stay untouched.

Examples:
  df-ui upgrade
`)
}
