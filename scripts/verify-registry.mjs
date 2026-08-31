#!/usr/bin/env node
/**
 * Registry gate for publish and CI.
 * 1. Every path in registry.json exists on disk.
 * 2. public/r/*.json matches a fresh build from the same builder.
 * 3. Each public df-*.tsx maps to registry:ui + docs/api, with an explicit allowlist.
 * 4. Every relative import in an item resolves inside that item's install closure.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { buildRegistryPayloads } from "./build-df-registry.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const REGISTRY_PATH = path.join(ROOT, "registry.json")
const PUBLIC_R = path.join(ROOT, "public", "r")
const COMPONENTS_DIR = path.join(ROOT, "src", "components")
const API_DIR = path.join(ROOT, "docs", "api")

/** Meta registry items that are not components and need no docs/api JSON. */
const META_REGISTRY_NAMES = new Set(["color-system", "foundation"])

/**
 * Public component files that are intentionally not registry:ui items.
 * list-item-nest is chrome used by list-item, not a standalone installable.
 */
const INTERNAL_COMPONENT_ALLOWLIST = new Set(["list-item-nest"])

function fail(messages) {
  for (const message of messages) {
    console.error(`verify-registry: ${message}`)
  }
  process.exitCode = 1
}

function readCatalog() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"))
}

function assertDeclaredPathsExist(catalog) {
  const errors = []
  for (const item of catalog.items ?? []) {
    for (const file of item.files ?? []) {
      const abs = path.join(ROOT, file.path)
      if (!fs.existsSync(abs)) {
        errors.push(
          `registry item "${item.name}" declares missing path: ${file.path}`
        )
      }
    }
  }
  return errors
}

function assertPublicPayloadsFresh(catalog) {
  const errors = []
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "df-registry-verify-"))
  const tmpOut = path.join(tmpRoot, "r")

  try {
    const { written } = buildRegistryPayloads({
      root: ROOT,
      registryPath: REGISTRY_PATH,
      outDir: tmpOut,
    })

    const expectedNames = new Set(written.map((entry) => entry.name))
    const committedNames = fs.existsSync(PUBLIC_R)
      ? fs
          .readdirSync(PUBLIC_R)
          .filter((name) => name.endsWith(".json"))
          .map((name) => name.slice(0, -".json".length))
      : []

    for (const name of committedNames) {
      if (!expectedNames.has(name)) {
        errors.push(
          `public/r/${name}.json is not produced by registry.json (stale or orphan)`
        )
      }
    }

    for (const entry of written) {
      const committedPath = path.join(PUBLIC_R, `${entry.name}.json`)
      if (!fs.existsSync(committedPath)) {
        errors.push(
          `public/r/${entry.name}.json is missing; run npm run df:registry`
        )
        continue
      }
      const committed = fs.readFileSync(committedPath, "utf8")
      if (committed !== entry.body) {
        errors.push(
          `public/r/${entry.name}.json is stale; run npm run df:registry`
        )
      }
    }

    if (written.length !== (catalog.items ?? []).length) {
      errors.push(
        `builder wrote ${written.length} payloads but registry.json has ${(catalog.items ?? []).length} items`
      )
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }

  return errors
}

function listPublicComponentNames() {
  return fs
    .readdirSync(COMPONENTS_DIR)
    .filter(
      (name) =>
        name.startsWith("df-") &&
        name.endsWith(".tsx") &&
        !name.endsWith(".test.tsx")
    )
    .map((name) => name.slice("df-".length, -".tsx".length))
    .sort()
}

function assertComponentConsistency(catalog) {
  const errors = []
  const uiNames = new Set(
    (catalog.items ?? [])
      .filter((item) => item.type === "registry:ui")
      .map((item) => item.name)
  )

  for (const name of META_REGISTRY_NAMES) {
    const item = (catalog.items ?? []).find((entry) => entry.name === name)
    if (!item) {
      errors.push(`meta registry item "${name}" is missing from registry.json`)
      continue
    }
    if (item.type === "registry:ui") {
      errors.push(
        `meta registry item "${name}" must not be type registry:ui`
      )
    }
  }

  const components = listPublicComponentNames()

  for (const name of components) {
    if (INTERNAL_COMPONENT_ALLOWLIST.has(name)) {
      if (uiNames.has(name)) {
        errors.push(
          `internal allowlist component "${name}" must not be a registry:ui item`
        )
      }
      continue
    }

    if (!uiNames.has(name)) {
      errors.push(
        `component src/components/df-${name}.tsx has no registry:ui item (add it, or add "${name}" to INTERNAL_COMPONENT_ALLOWLIST if internal-only)`
      )
      continue
    }

    const apiPath = path.join(API_DIR, `${name}.json`)
    if (!fs.existsSync(apiPath)) {
      errors.push(
        `registry:ui item "${name}" is missing docs/api/${name}.json`
      )
    }
  }

  for (const name of INTERNAL_COMPONENT_ALLOWLIST) {
    if (!components.includes(name)) {
      errors.push(
        `INTERNAL_COMPONENT_ALLOWLIST entry "${name}" has no src/components/df-${name}.tsx`
      )
    }
  }

  for (const name of uiNames) {
    if (META_REGISTRY_NAMES.has(name)) continue
    const componentPath = path.join(COMPONENTS_DIR, `df-${name}.tsx`)
    if (!fs.existsSync(componentPath)) {
      errors.push(
        `registry:ui item "${name}" has no src/components/df-${name}.tsx`
      )
    }
  }

  return errors
}

/** Source extensions a relative import may resolve to, in resolution order. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".css"]

/** Strip comments and strings so only real import specifiers are scanned. */
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``")
}

function isFile(relPath) {
  try {
    return fs.statSync(path.join(ROOT, relPath)).isFile()
  } catch {
    return false
  }
}

function resolveRelativeImport(fromPath, specifier) {
  const base = path.posix.join(path.posix.dirname(fromPath), specifier)
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ]
  return candidates.find((candidate) => isFile(candidate)) ?? null
}

/** Names of an item plus every item it depends on, transitively. */
function dependencyClosure(items, name, seen = new Set()) {
  if (seen.has(name)) return seen
  seen.add(name)
  for (const dep of items.get(name)?.registryDependencies ?? []) {
    const local = dep.replace(/^default-file\/ui\//, "")
    if (items.has(local)) dependencyClosure(items, local, seen)
  }
  return seen
}

/**
 * A copied item must be able to compile on its own, so every relative import in
 * its sources has to resolve to a file that the same install writes. Without
 * this gate a component can ship with a shared lib that no dependency declares.
 */
function assertImportClosure(catalog) {
  const errors = []
  const items = new Map((catalog.items ?? []).map((item) => [item.name, item]))

  for (const item of catalog.items ?? []) {
    const installed = new Set()
    for (const name of dependencyClosure(items, item.name)) {
      for (const file of items.get(name)?.files ?? []) installed.add(file.path)
    }

    for (const file of item.files ?? []) {
      if (!/\.tsx?$/.test(file.path)) continue
      const source = stripNonCode(fs.readFileSync(path.join(ROOT, file.path), "utf8"))
      const specifiers = new Set(
        [...source.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g)].map(
          (match) => match[1]
        )
      )
      for (const specifier of specifiers) {
        const resolved = resolveRelativeImport(file.path, specifier)
        if (!resolved) {
          errors.push(
            `registry item "${item.name}": ${file.path} imports "${specifier}", which does not exist on disk`
          )
          continue
        }
        if (!installed.has(resolved)) {
          errors.push(
            `registry item "${item.name}": ${file.path} imports "${specifier}" (${resolved}), which no declared file or registryDependency installs`
          )
        }
      }
    }
  }

  return errors
}

function main() {
  const catalog = readCatalog()
  const errors = [
    ...assertDeclaredPathsExist(catalog),
    ...assertPublicPayloadsFresh(catalog),
    ...assertComponentConsistency(catalog),
    ...assertImportClosure(catalog),
  ]

  if (errors.length > 0) {
    fail(errors)
    console.error(`verify-registry: ${errors.length} error(s)`)
    return
  }

  console.log("verify-registry: ok")
}

main()
