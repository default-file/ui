import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  buildRegistryPayloads,
  normalizeRegistryFileContent,
} from "./build-df-registry.mjs"

describe("normalizeRegistryFileContent", () => {
  it("stores CRLF and lone CR as LF", () => {
    assert.equal(normalizeRegistryFileContent("a\r\nb\rc\n"), "a\nb\nc\n")
  })
})

describe("buildRegistryPayloads", () => {
  it("embeds source files with LF even when the disk file uses CRLF", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "df-registry-crlf-"))
    try {
      const srcDir = path.join(tmpRoot, "src")
      fs.mkdirSync(srcDir)
      const sourcePath = path.join(srcDir, "sample.tsx")
      fs.writeFileSync(sourcePath, "export const x = 1\r\n")

      const registryPath = path.join(tmpRoot, "registry.json")
      fs.writeFileSync(
        registryPath,
        JSON.stringify({
          items: [
            {
              name: "sample",
              type: "registry:ui",
              title: "Sample",
              files: [{ path: "src/sample.tsx", type: "registry:file" }],
            },
          ],
        })
      )

      const outDir = path.join(tmpRoot, "r")
      const { written } = buildRegistryPayloads({
        root: tmpRoot,
        registryPath,
        outDir,
      })

      assert.equal(written.length, 1)
      const payload = JSON.parse(written[0].body)
      assert.equal(payload.files[0].content.includes("\r"), false)
      assert.equal(payload.files[0].content, "export const x = 1\n")
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
