import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { addCommand } from "./add.mjs"
import { applyKit } from "./apply.mjs"
import { readDfConfig, writeDfConfig, buildDfConfig } from "./df-config.mjs"
import { kitVersion } from "./kit-root.mjs"
import { upgradeCommand } from "./upgrade.mjs"

function makeProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "df-install-mode-"))
  fs.mkdirSync(path.join(cwd, "src"))
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "df-install-mode-test", version: "0.0.0", private: true }, null, 2)}\n`
  )
  fs.writeFileSync(path.join(cwd, "src", "index.css"), "/* host */\n")
  return cwd
}

test("registry mode does not add the kit package and imports local CSS", () => {
  const cwd = makeProject()
  applyKit(cwd, "react", { installMode: "registry", skipInstall: true })
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"))
  assert.equal(pkg.dependencies?.["@default-file/ui"], undefined)
  const css = fs.readFileSync(path.join(cwd, "src", "index.css"), "utf8")
  assert.match(css, /default-file-ui\/css\/df-index\.css/)
  assert.doesNotMatch(css, /@default-file\/ui\/css\/df-index\.css/)
})

test("package mode imports kit package CSS", () => {
  const cwd = makeProject()
  applyKit(cwd, "react", { installMode: "package", skipInstall: true })
  const css = fs.readFileSync(path.join(cwd, "src", "index.css"), "utf8")
  assert.match(css, /@default-file\/ui\/css\/df-index\.css/)
})

test("add records copied item versions and upgrade refreshes them", async () => {
  const cwd = makeProject()
  writeDfConfig(cwd, buildDfConfig(cwd, "react", { installMode: "registry" }))
  await addCommand(["button", "--cwd", cwd])
  const afterAdd = readDfConfig(cwd)
  const release = kitVersion()
  assert.equal(afterAdd.copied.button.version, release)
  assert.equal(afterAdd.copied.foundation.version, release)
  afterAdd.copied.button.version = "0.0.0"
  writeDfConfig(cwd, afterAdd)
  await upgradeCommand(["--cwd", cwd])
  const afterUpgrade = readDfConfig(cwd)
  assert.equal(afterUpgrade.copied.button.version, release)
})
