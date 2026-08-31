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

/**
 * Config keys that a package runner exports to describe its own invocation.
 * `npm_config_package` and `npm_config_call` name the package and command the
 * runner was asked to execute, so a nested runner inherits them and resolves
 * the requested binary inside this kit instead of installing it.
 */
const RUNNER_INVOCATION_ENV = new Set(["npm_config_package", "npm_config_call"])

/**
 * Environment for a spawned package manager, without the parent runner's own
 * invocation config. Registry, cache, and proxy settings are preserved.
 */
export function childEnv(base) {
  const source = base ?? process.env
  const env = {}
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    if (RUNNER_INVOCATION_ENV.has(key.toLowerCase())) continue
    env[key] = value
  }
  return env
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: childEnv(options.env),
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
  if (current.includes(importLine.trim()) || current.includes("df-index.css")) {
    return { path: filePath, changed: false }
  }
  const next =
    current.trim().length === 0
      ? `${importLine}\n`
      : `${importLine}\n\n${current.replace(/^\uFEFF/, "")}`
  writeText(filePath, next)
  return { path: filePath, changed: true }
}
