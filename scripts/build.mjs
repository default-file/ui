#!/usr/bin/env node
/**
 * Emit compiled JS and declarations, then rewrite relative specifiers for
 * Node ESM. Clears dist first so deleted sources cannot leave stale outputs.
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIST = path.join(ROOT, "dist")
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc")
const REWRITE = path.join(ROOT, "scripts", "rewrite-dist-specifiers.mjs")

function run(command, args) {
  try {
    execFileSync(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    })
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? error.status
        : "unknown"
    throw new Error(`${path.basename(command)} failed with exit code ${status}`)
  }
}

fs.rmSync(DIST, { recursive: true, force: true })

if (!fs.existsSync(TSC)) {
  console.error(`[build] Missing TypeScript binary at ${path.relative(ROOT, TSC)}`)
  process.exit(1)
}

run(process.execPath, [TSC, "-p", "tsconfig.build.json"])
run(process.execPath, [REWRITE])
