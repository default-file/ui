import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

export function exists(filePath) {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

export function readText(filePath) {
  return fs.readFileSync(filePath, "utf8")
}

export function writeText(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents, "utf8")
}

export function findFirst(dir, names) {
  for (const name of names) {
    const full = path.join(dir, name)
    if (exists(full)) return full
  }
  return null
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}`)
  }
}

export function packageManager() {
  const agent = process.env.npm_config_user_agent ?? ""
  if (agent.includes("pnpm")) return "pnpm"
  if (agent.includes("yarn")) return "yarn"
  if (agent.includes("bun")) return "bun"
  return "npm"
}

export function installPackages(pm, packages, cwd) {
  if (packages.length === 0) return
  if (pm === "pnpm") runCommand("pnpm", ["add", ...packages], { cwd })
  else if (pm === "yarn") runCommand("yarn", ["add", ...packages], { cwd })
  else if (pm === "bun") runCommand("bun", ["add", ...packages], { cwd })
  else runCommand("npm", ["install", ...packages], { cwd })
}

export function ensureCssImport(filePath, importLine) {
  const current = exists(filePath) ? readText(filePath) : ""
  if (current.includes("@default-file/ui/css/df-index.css")) {
    return { path: filePath, changed: false }
  }
  const next =
    current.trim().length === 0
      ? `${importLine}\n`
      : `${importLine}\n\n${current.replace(/^\uFEFF/, "")}`
  writeText(filePath, next)
  return { path: filePath, changed: true }
}
