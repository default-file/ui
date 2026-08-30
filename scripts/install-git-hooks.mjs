/**
 * Points this checkout at the tracked hooks in `.githooks` so every clone gets
 * the same push guard. No-op when there is no git work tree.
 */

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function installHooks() {
  if (!fs.existsSync(path.join(ROOT, ".githooks"))) return
  if (!fs.existsSync(path.join(ROOT, ".git"))) return

  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: ROOT,
    stdio: "ignore",
  })
}

try {
  installHooks()
} catch (error) {
  console.warn(`[df] Could not wire git hooks: ${error.message}`)
}
