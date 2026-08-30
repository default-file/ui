import path from "node:path"

import { frameworkLabel } from "./constants.mjs"
import { exists, packageManager, runCommand } from "./fs-utils.mjs"

export function scaffoldProject(framework, name, parentDir) {
  if (framework === "laravel") {
    throw new Error(
      "Laravel apps must be created with the Laravel installer first, then run `df-ui init` inside the app (Inertia + React)."
    )
  }

  const target = path.resolve(parentDir, name)
  if (exists(target)) {
    throw new Error(`Target already exists: ${target}`)
  }

  console.log(`\nScaffolding ${frameworkLabel(framework)} → ${target}\n`)
  const pm = packageManager()

  switch (framework) {
    case "next":
      runCommand(
        "npx",
        [
          "--yes",
          "create-next-app@latest",
          name,
          "--ts",
          "--eslint",
          "--app",
          "--src-dir",
          "--import-alias",
          "@/*",
          "--use-npm",
          "--yes",
          "--disable-git",
        ],
        { cwd: parentDir }
      )
      break
    case "vite":
    case "react":
      runCommand(
        "npm",
        ["create", "vite@latest", name, "--", "--template", "react-ts"],
        { cwd: parentDir }
      )
      installRoot(pm, target)
      break
    case "react-router":
      runCommand(
        "npx",
        ["--yes", "create-react-router@latest", name, "--yes", "--no-git-init"],
        { cwd: parentDir }
      )
      break
    case "tanstack-start":
      runCommand(
        "npx",
        ["--yes", "@tanstack/cli", "create", name, "-y"],
        { cwd: parentDir }
      )
      break
    case "astro":
      runCommand(
        "npm",
        [
          "create",
          "astro@latest",
          name,
          "--",
          "--template",
          "minimal",
          "--install",
          "--no-git",
          "--typescript",
          "strict",
          "--yes",
        ],
        { cwd: parentDir }
      )
      runCommand("npx", ["--yes", "astro", "add", "react", "--yes"], {
        cwd: target,
      })
      break
    default:
      throw new Error(`Unsupported template: ${framework}`)
  }

  if (!exists(path.join(target, "package.json"))) {
    throw new Error(`Scaffold finished but package.json is missing in ${target}`)
  }

  return target
}

function installRoot(pm, cwd) {
  if (!exists(path.join(cwd, "package.json"))) return
  if (pm === "pnpm") runCommand("pnpm", ["install"], { cwd })
  else if (pm === "yarn") runCommand("yarn", ["install"], { cwd })
  else if (pm === "bun") runCommand("bun", ["install"], { cwd })
  else runCommand("npm", ["install"], { cwd })
}

export function assertProjectName(name) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(
      `Invalid project name "${name}". Use letters, numbers, dots, underscores, or hyphens.`
    )
  }
  if (name === "." || name === "..") {
    throw new Error("Project name cannot be . or ..")
  }
}
