#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(import.meta.dirname, "..")
const REGISTRY_PATH = path.join(ROOT, "registry.json")
const DEFAULT_OUT_DIR = path.join(ROOT, "public", "r")

/** Registry payloads store file contents with LF newlines. */
export function normalizeRegistryFileContent(content) {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

/**
 * Build registry item payloads from registry.json into outDir.
 * Shared by df:registry and verify:registry so drift checks use the same builder.
 */
export function buildRegistryPayloads({
  root = ROOT,
  registryPath = path.join(root, "registry.json"),
  outDir,
} = {}) {
  const catalog = JSON.parse(fs.readFileSync(registryPath, "utf8"))
  fs.mkdirSync(outDir, { recursive: true })

  const written = []

  for (const item of catalog.items) {
    const files = (item.files ?? []).map((f) => {
      const abs = path.join(root, f.path)
      const content = normalizeRegistryFileContent(fs.readFileSync(abs, "utf8"))
      return {
        path: f.path,
        type: f.type ?? "registry:file",
        content,
        target: f.target,
      }
    })

    const payload = {
      name: item.name,
      type: item.type,
      title: item.title ?? item.name,
      description: item.description ?? "",
      dependencies: item.dependencies ?? [],
      registryDependencies: item.registryDependencies ?? [],
      files,
    }

    const out = path.join(outDir, `${item.name}.json`)
    const body = JSON.stringify(payload, null, 2) + "\n"
    fs.writeFileSync(out, body)
    written.push({ name: item.name, path: out, body })
  }

  return { catalog, written }
}

function main() {
  const outDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_OUT_DIR

  const { catalog, written } = buildRegistryPayloads({
    root: ROOT,
    registryPath: REGISTRY_PATH,
    outDir,
  })

  for (const entry of written) {
    console.log("wrote", path.relative(ROOT, entry.path))
  }
  console.log(`Built ${catalog.items.length} registry items`)
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main()
}
