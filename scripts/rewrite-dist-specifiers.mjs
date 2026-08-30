#!/usr/bin/env node
/**
 * Rewrite extensionless relative specifiers in compiled JS and declaration
 * output so Node ESM can resolve them. Source stays extensionless.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIST = path.join(ROOT, "dist")

const RUNTIME_EXT = /\.(?:js|mjs|cjs|json|css|node)$/i
const SPECIFIER_RE =
  /((?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+|))(["'])(\.[^"']+)\2|(\bimport\s*\(\s*)(["'])(\.[^"']+)\5(\s*\))/g

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(abs, out)
    else if (ent.name.endsWith(".js") || ent.name.endsWith(".d.ts")) out.push(abs)
  }
  return out
}

/**
 * Replace comments with spaces so match indexes stay aligned with the original
 * source. Import examples inside JSDoc must not be rewritten.
 */
function blankComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n\r]/g, " "))
    .replace(/(^|[^:\\])\/\/.*$/gm, (line, prefix) => {
      if (prefix.length === 0) return " ".repeat(line.length)
      return prefix + " ".repeat(line.length - prefix.length)
    })
}

function resolveRewrite(fromFile, spec) {
  if (!spec.startsWith(".")) {
    throw new Error(`Expected relative specifier, got ${JSON.stringify(spec)} in ${fromFile}`)
  }
  if (RUNTIME_EXT.test(spec)) return spec

  const base = path.resolve(path.dirname(fromFile), spec)
  const fileJs = `${base}.js`
  const fileDts = `${base}.d.ts`
  const indexJs = path.join(base, "index.js")
  const indexDts = path.join(base, "index.d.ts")
  const isDts = fromFile.endsWith(".d.ts")

  if (fs.existsSync(fileJs) || (isDts && fs.existsSync(fileDts))) {
    return `${spec}.js`
  }
  if (fs.existsSync(indexJs) || (isDts && fs.existsSync(indexDts))) {
    const normalized = spec.endsWith("/") ? spec.slice(0, -1) : spec
    return `${normalized}/index.js`
  }

  throw new Error(
    `Cannot resolve relative specifier ${JSON.stringify(spec)} from ${path.relative(ROOT, fromFile)}`
  )
}

function rewriteContent(fromFile, content) {
  const searchable = blankComments(content)
  /** @type {{ start: number, end: number, next: string }[]} */
  const edits = []

  for (const match of searchable.matchAll(SPECIFIER_RE)) {
    const full = match[0]
    const index = match.index
    if (index == null) continue

    const fromSpec = match[3]
    const importSpec = match[6]
    const spec = fromSpec ?? importSpec
    if (spec == null) continue

    const rewritten = resolveRewrite(fromFile, spec)
    if (rewritten === spec) continue

    const specOffset = full.lastIndexOf(spec)
    if (specOffset < 0) {
      throw new Error(`Failed to locate specifier ${JSON.stringify(spec)} in match`)
    }
    edits.push({
      start: index + specOffset,
      end: index + specOffset + spec.length,
      next: rewritten,
    })
  }

  if (edits.length === 0) {
    return { content, changed: false, count: 0 }
  }

  let next = content
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i]
    next = next.slice(0, edit.start) + edit.next + next.slice(edit.end)
  }
  return { content: next, changed: true, count: edits.length }
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`[rewrite-dist] Missing ${path.relative(ROOT, DIST)}. Run the TypeScript emit first.`)
    process.exit(1)
  }

  const files = walk(DIST)
  if (files.length === 0) {
    console.error("[rewrite-dist] No .js or .d.ts files under dist/.")
    process.exit(1)
  }

  let rewrittenFiles = 0
  let rewrittenSpecs = 0

  for (const abs of files) {
    const before = fs.readFileSync(abs, "utf8")
    const { content, changed, count } = rewriteContent(abs, before)
    if (!changed) continue
    fs.writeFileSync(abs, content)
    rewrittenFiles += 1
    rewrittenSpecs += count
  }

  console.log(
    `[rewrite-dist] Rewrote ${rewrittenSpecs} specifier(s) across ${rewrittenFiles} file(s) (${files.length} scanned).`
  )
}

try {
  main()
} catch (error) {
  console.error("[rewrite-dist]", error instanceof Error ? error.message : error)
  process.exit(1)
}
