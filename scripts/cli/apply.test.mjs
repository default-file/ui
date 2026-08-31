import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { applyKit } from "./apply.mjs"

/** Template stylesheet whose custom properties shadow kit semantic tokens. */
const TEMPLATE_CSS = ":root {\n  --background: #ffffff;\n  --border: #e5e4e7;\n}\n"

function makeProject({ css = "/* host */\n", nextConfig } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "df-apply-"))
  fs.mkdirSync(path.join(cwd, "src"))
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "df-apply-test", version: "0.0.0", private: true }, null, 2)}\n`
  )
  fs.writeFileSync(path.join(cwd, "src", "index.css"), css)
  if (nextConfig !== undefined) {
    fs.writeFileSync(path.join(cwd, "next.config.ts"), nextConfig)
  }
  return cwd
}

/** Run applyKit without leaking its progress output into test results. */
function applyQuietly(cwd, framework, options) {
  const logs = []
  const realLog = console.log
  console.log = (...args) => logs.push(args.join(" "))
  try {
    applyKit(cwd, framework, options)
  } finally {
    console.log = realLog
  }
  return logs
}

test("scaffold mode replaces template styles that shadow kit tokens", () => {
  const cwd = makeProject({ css: TEMPLATE_CSS })
  applyQuietly(cwd, "react", { skipInstall: true, scaffolded: true })
  const css = fs.readFileSync(path.join(cwd, "src", "index.css"), "utf8")
  assert.equal(css, '@import "@default-file/ui/css/df-index.css";\n')
})

test("existing projects keep their stylesheet and gain the import", () => {
  const cwd = makeProject({ css: TEMPLATE_CSS })
  applyQuietly(cwd, "react", { skipInstall: true })
  const css = fs.readFileSync(path.join(cwd, "src", "index.css"), "utf8")
  assert.match(css, /@default-file\/ui\/css\/df-index\.css/)
  assert.match(css, /--background: #ffffff/)
  assert.match(css, /--border: #e5e4e7/)
})

test("transpilePackages is added to a Next config that carries a type annotation", () => {
  const cwd = makeProject({
    nextConfig:
      'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {\n  /* config options here */\n};\n\nexport default nextConfig;\n',
  })
  const logs = applyQuietly(cwd, "next", { skipInstall: true })
  const config = fs.readFileSync(path.join(cwd, "next.config.ts"), "utf8")
  assert.match(config, /transpilePackages: \["@default-file\/ui"\]/)
  assert.match(config, /const nextConfig: NextConfig = \{/)
  assert.ok(logs.some((line) => line.includes("transpilePackages")))
})

test("an existing transpilePackages list keeps its entries", () => {
  const cwd = makeProject({
    nextConfig:
      'const nextConfig = {\n  transpilePackages: ["other-pkg"],\n}\n\nexport default nextConfig\n',
  })
  applyQuietly(cwd, "next", { skipInstall: true })
  const config = fs.readFileSync(path.join(cwd, "next.config.ts"), "utf8")
  assert.match(config, /"@default-file\/ui"/)
  assert.match(config, /"other-pkg"/)
})

test("a Next config with no object literal is reported, not rewritten", () => {
  const source =
    "export default async function config() {\n  return { reactStrictMode: true }\n}\n"
  const cwd = makeProject({ nextConfig: source })
  const logs = applyQuietly(cwd, "next", { skipInstall: true })
  assert.equal(fs.readFileSync(path.join(cwd, "next.config.ts"), "utf8"), source)
  assert.ok(logs.some((line) => line.includes("Add transpilePackages")))
  assert.ok(!logs.some((line) => line.includes("already configured")))
})

test("registry mode leaves the Next config alone", () => {
  const source = "const nextConfig = {\n}\n\nexport default nextConfig\n"
  const cwd = makeProject({ nextConfig: source })
  applyQuietly(cwd, "next", { skipInstall: true, installMode: "registry" })
  assert.equal(fs.readFileSync(path.join(cwd, "next.config.ts"), "utf8"), source)
})
