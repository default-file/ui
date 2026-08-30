import path from "node:path"

import { exists, findFirst, readText } from "./fs-utils.mjs"

export function detectFramework(cwd) {
  if (findFirst(cwd, ["next.config.ts", "next.config.mjs", "next.config.js", "next.config.cjs"])) {
    return "next"
  }
  if (findFirst(cwd, ["astro.config.mjs", "astro.config.ts", "astro.config.js"])) {
    return "astro"
  }
  if (
    findFirst(cwd, ["react-router.config.ts", "react-router.config.js"]) ||
    packageDependsOn(cwd, "@react-router/dev")
  ) {
    return "react-router"
  }
  if (
    packageDependsOn(cwd, "@tanstack/react-start") ||
    packageDependsOn(cwd, "@tanstack/start")
  ) {
    return "tanstack-start"
  }
  if (exists(path.join(cwd, "artisan")) && exists(path.join(cwd, "resources/js"))) {
    return "laravel"
  }
  if (findFirst(cwd, ["vite.config.ts", "vite.config.mjs", "vite.config.js"])) {
    return "vite"
  }
  if (packageDependsOn(cwd, "react")) {
    return "react"
  }
  return null
}

function packageDependsOn(cwd, name) {
  const pkgPath = path.join(cwd, "package.json")
  if (!exists(pkgPath)) return false
  try {
    const pkg = JSON.parse(readText(pkgPath))
    return Boolean(
      pkg.dependencies?.[name] ||
        pkg.devDependencies?.[name] ||
        pkg.peerDependencies?.[name]
    )
  } catch {
    return false
  }
}

export function readPackageJson(cwd) {
  const pkgPath = path.join(cwd, "package.json")
  if (!exists(pkgPath)) return null
  return JSON.parse(readText(pkgPath))
}
