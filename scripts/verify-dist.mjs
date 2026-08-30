#!/usr/bin/env node
/**
 * Gate checks for the compiled package shape. These catch failures that
 * test:lib cannot see because its resolver hook masks extensionless imports.
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIST = path.join(ROOT, "dist")
const SRC = path.join(ROOT, "src")
const PKG_PATH = path.join(ROOT, "package.json")

const RUNTIME_EXT = /\.(?:js|mjs|cjs|json|css|node)$/i
const SPECIFIER_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+|)\s*(["'])(\.[^"']+)\1|\bimport\s*\(\s*(["'])(\.[^"']+)\3\s*\)/g

/** @typedef {{ path: string, message: string }} DistIssue */

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(abs, predicate, out)
    else if (predicate(ent.name, abs)) out.push(abs)
  }
  return out
}

function rel(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, "/")
}

function blankComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n\r]/g, " "))
    .replace(/(^|[^:\\])\/\/.*$/gm, (line, prefix) => {
      if (prefix.length === 0) return " ".repeat(line.length)
      return prefix + " ".repeat(line.length - prefix.length)
    })
}

function extractSpecifiers(content) {
  const specs = []
  for (const match of blankComments(content).matchAll(SPECIFIER_RE)) {
    specs.push(match[2] ?? match[4])
  }
  return specs
}

function resolveExisting(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
  return null
}

function checkSpecifiers() {
  /** @type {DistIssue[]} */
  const issues = []
  const files = walk(
    DIST,
    (name) => name.endsWith(".js") || name.endsWith(".d.ts")
  )

  for (const abs of files) {
    const content = fs.readFileSync(abs, "utf8")
    for (const spec of extractSpecifiers(content)) {
      if (!spec.startsWith(".")) continue

      if (!RUNTIME_EXT.test(spec)) {
        issues.push({
          path: rel(abs),
          message: `extensionless relative specifier ${JSON.stringify(spec)}`,
        })
        continue
      }

      const resolved = resolveExisting(abs, spec)
      if (!resolved) {
        issues.push({
          path: rel(abs),
          message: `relative specifier ${JSON.stringify(spec)} does not resolve to a file`,
        })
        continue
      }

      const withoutExt = spec.replace(RUNTIME_EXT, "")
      const bare = path.resolve(path.dirname(abs), withoutExt)
      if (
        !spec.includes("/index.") &&
        fs.existsSync(bare) &&
        fs.statSync(bare).isDirectory()
      ) {
        issues.push({
          path: rel(abs),
          message: `directory specifier ${JSON.stringify(spec)} (ESM requires an explicit index path)`,
        })
      }
    }
  }

  return { issues, fileCount: files.length }
}

function sourceHasUseClient(content) {
  const head = content.replace(/^\uFEFF/, "").trimStart()
  return head.startsWith('"use client"') || head.startsWith("'use client'")
}

function compiledStartsWithUseClient(content) {
  const head = content.replace(/^\uFEFF/, "").trimStart()
  return /^["']use client["']\s*;?/.test(head)
}

function checkUseClient() {
  /** @type {DistIssue[]} */
  const issues = []
  const sources = walk(
    SRC,
    (name, abs) =>
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.includes(".test.") &&
      sourceHasUseClient(fs.readFileSync(abs, "utf8"))
  )

  for (const srcAbs of sources) {
    const relative = path.relative(SRC, srcAbs)
    const distJs = path.join(
      DIST,
      relative.replace(/\.tsx?$/, ".js")
    )
    if (!fs.existsSync(distJs)) {
      issues.push({
        path: rel(srcAbs),
        message: `missing compiled counterpart ${rel(distJs)}`,
      })
      continue
    }
    const compiled = fs.readFileSync(distJs, "utf8")
    if (!compiledStartsWithUseClient(compiled)) {
      issues.push({
        path: rel(distJs),
        message: `"use client" is not the first statement (source: ${rel(srcAbs)})`,
      })
    }
  }

  return { issues, sourceCount: sources.length }
}

function exportTargets(entry) {
  if (typeof entry === "string") return [entry]
  if (entry && typeof entry === "object") {
    const out = []
    for (const value of Object.values(entry)) {
      if (typeof value === "string") out.push(value)
    }
    return out
  }
  return []
}

function checkExports(pkg) {
  /** @type {DistIssue[]} */
  const issues = []
  const exportsMap = pkg.exports
  if (!exportsMap || typeof exportsMap !== "object") {
    return [{ path: "package.json", message: "missing exports map" }]
  }

  for (const [key, entry] of Object.entries(exportsMap)) {
    for (const target of exportTargets(entry)) {
      if (target.includes("*")) {
        if (key === "./components/*") {
          const componentsDir = path.join(SRC, "components")
          const names = fs
            .readdirSync(componentsDir)
            .filter(
              (name) =>
                name.startsWith("df-") &&
                name.endsWith(".tsx") &&
                !name.includes(".test.")
            )
            .map((name) => name.replace(/\.tsx$/, ""))
          for (const name of names) {
            for (const pattern of exportTargets(entry)) {
              const concrete = pattern.replace("*", name)
              const abs = path.join(ROOT, concrete)
              if (!fs.existsSync(abs)) {
                issues.push({
                  path: "package.json",
                  message: `export ${JSON.stringify(key)} target missing: ${concrete}`,
                })
              }
            }
          }
        } else if (key === "./css/*") {
          const cssDir = path.join(SRC, "css")
          for (const name of fs.readdirSync(cssDir)) {
            if (!name.endsWith(".css")) continue
            const concrete = target.replace("*", name)
            const abs = path.join(ROOT, concrete)
            if (!fs.existsSync(abs)) {
              issues.push({
                path: "package.json",
                message: `export ${JSON.stringify(key)} target missing: ${concrete}`,
              })
            }
          }
        } else {
          const parent = path.join(ROOT, path.dirname(target.replace("*", "_")))
          if (!fs.existsSync(parent)) {
            issues.push({
              path: "package.json",
              message: `export ${JSON.stringify(key)} wildcard parent missing for ${target}`,
            })
          }
        }
        continue
      }

      const abs = path.join(ROOT, target)
      if (!fs.existsSync(abs)) {
        issues.push({
          path: "package.json",
          message: `export ${JSON.stringify(key)} target missing: ${target}`,
        })
      }
    }
  }

  return issues
}

async function checkNativeImports(pkg) {
  /** @type {DistIssue[]} */
  const issues = []
  const candidates = ["./df-url", "./df-css-value"]
  for (const key of candidates) {
    const entry = pkg.exports?.[key]
    const targets = exportTargets(entry)
    const jsTarget = targets.find((t) => t.endsWith(".js"))
    if (!jsTarget) {
      issues.push({
        path: "package.json",
        message: `native import probe: export ${JSON.stringify(key)} has no .js target`,
      })
      continue
    }
    const abs = path.join(ROOT, jsTarget)
    try {
      const mod = await import(pathToFileURL(abs).href)
      if (mod == null || typeof mod !== "object") {
        issues.push({
          path: jsTarget,
          message: "native import returned a non-object module namespace",
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      issues.push({
        path: jsTarget,
        message: `native import failed: ${message.split("\n")[0]}`,
      })
    }
  }
  return issues
}

async function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`[verify-dist] Missing ${rel(DIST)}. Run npm run build first.`)
    process.exit(1)
  }

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"))
  /** @type {DistIssue[]} */
  const issues = []

  const spec = checkSpecifiers()
  issues.push(...spec.issues)

  const client = checkUseClient()
  issues.push(...client.issues)

  issues.push(...checkExports(pkg))
  issues.push(...(await checkNativeImports(pkg)))

  if (issues.length > 0) {
    console.error(`[verify-dist] ${issues.length} issue(s):`)
    for (const issue of issues) {
      console.error(`  - ${issue.path}: ${issue.message}`)
    }
    process.exit(1)
  }

  console.log(
    `[verify-dist] OK: ${spec.fileCount} compiled module file(s), ${client.sourceCount} use-client source(s), exports on disk, native import probes passed.`
  )
}

main().catch((error) => {
  console.error("[verify-dist]", error instanceof Error ? error.message : error)
  process.exit(1)
})
