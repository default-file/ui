import fs from "node:fs"
import path from "node:path"

import { kitPath } from "./kit-root.mjs"

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Absolute path to the kit skills directory. */
export function skillsRoot() {
  return kitPath("skills")
}

function parseFrontmatter(text) {
  const match = text.match(FRONTMATTER_RE)
  if (!match) return { meta: {}, body: text }
  const meta = {}
  const lines = match[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    // Support folded/literal YAML scalars (>-, |-, >, |).
    if (value === ">-" || value === "|" || value === ">|" || value === "|-" || value === ">") {
      const parts = []
      while (i + 1 < lines.length) {
        const next = lines[i + 1]
        if (/^\S/.test(next) && next.includes(":")) break
        if (next.trim() === "" && parts.length === 0) {
          i += 1
          continue
        }
        if (!/^\s/.test(next) && next.trim() !== "") break
        parts.push(next.trim())
        i += 1
      }
      value = parts.filter(Boolean).join(" ")
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }
  return { meta, body: text.slice(match[0].length) }
}

function listSkillDirs() {
  const root = skillsRoot()
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(root, name, "SKILL.md")))
    .sort()
}

/** Inventory of bundled Agent Skills. */
export function listSkills() {
  return listSkillDirs().map((name) => {
    const skillPath = path.join(skillsRoot(), name, "SKILL.md")
    const text = fs.readFileSync(skillPath, "utf8")
    const { meta } = parseFrontmatter(text)
    return {
      name: meta.name || name,
      directory: name,
      description: meta.description || "",
      path: `skills/${name}`,
    }
  })
}

/** Full skill payload including markdown and reference file names. */
export function showSkill(name) {
  const skills = listSkills()
  const match =
    skills.find((skill) => skill.name === name || skill.directory === name) ??
    null
  if (!match) {
    const available = skills.map((skill) => skill.name).join(", ") || "(none)"
    throw new Error(`Unknown skill "${name}". Available: ${available}`)
  }

  const dir = path.join(skillsRoot(), match.directory)
  const skillMd = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8")
  const referencesDir = path.join(dir, "references")
  const references = fs.existsSync(referencesDir)
    ? fs
        .readdirSync(referencesDir)
        .filter((file) => file.endsWith(".md"))
        .sort()
        .map((file) => ({
          name: file,
          path: `skills/${match.directory}/references/${file}`,
          content: fs.readFileSync(path.join(referencesDir, file), "utf8"),
        }))
    : []

  return {
    ...match,
    skillMarkdown: skillMd,
    references: references.map(({ name: refName, path: refPath }) => ({
      name: refName,
      path: refPath,
    })),
    referenceContents: references,
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(from, to)
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to)
    }
  }
}

/**
 * Copy a skill into project agent directories.
 * Targets: .agents/skills/<name> and .cursor/skills/<name>
 */
export function installSkill(name, { cwd = process.cwd() } = {}) {
  const detail = showSkill(name)
  const src = path.join(skillsRoot(), detail.directory)
  const targets = [
    path.join(cwd, ".agents", "skills", detail.directory),
    path.join(cwd, ".cursor", "skills", detail.directory),
  ]

  const written = []
  for (const dest of targets) {
    fs.rmSync(dest, { recursive: true, force: true })
    copyDir(src, dest)
    written.push(path.relative(cwd, dest).split(path.sep).join("/"))
  }

  return {
    name: detail.name,
    directory: detail.directory,
    cwd,
    written,
  }
}

function wantsJson(args) {
  return args.includes("--json")
}

function takeFlagValue(args, flag) {
  const index = args.indexOf(flag)
  if (index === -1) return null
  return args[index + 1] ?? null
}

function positional(args) {
  return args.filter((arg, i, all) => {
    if (arg.startsWith("-")) return false
    if (i > 0 && all[i - 1].startsWith("--") && !all[i - 1].includes("=")) {
      const prev = all[i - 1]
      if (prev === "--cwd") return false
    }
    return true
  })
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2))
}

/** CLI entry: df-ui skills <list|show|install> ... */
export function skillsCommand(args) {
  const [sub, ...rest] = args

  if (!sub || sub === "-h" || sub === "--help") {
    printSkillsHelp()
    return
  }

  if (sub === "list") {
    if (rest.includes("-h") || rest.includes("--help")) {
      console.log(`
Usage: df-ui skills list [--json]

List Agent Skills bundled with the kit.
`)
      return
    }
    const skills = listSkills()
    if (wantsJson(rest)) {
      printJson({ skills })
      return
    }
    console.log(`\nDefault File UI skills (${skills.length})\n`)
    for (const skill of skills) {
      console.log(`  ${skill.name}`)
      if (skill.description) {
        console.log(`    ${skill.description}`)
      }
      console.log("")
    }
    return
  }

  if (sub === "show") {
    if (rest.includes("-h") || rest.includes("--help") || positional(rest).length === 0) {
      console.log(`
Usage: df-ui skills show <name> [--json]

Print one bundled skill (SKILL.md and reference file list).
`)
      return
    }
    const name = positional(rest)[0]
    const detail = showSkill(name)
    if (wantsJson(rest)) {
      printJson({
        name: detail.name,
        directory: detail.directory,
        description: detail.description,
        path: detail.path,
        skillMarkdown: detail.skillMarkdown,
        references: detail.references,
      })
      return
    }
    console.log(`\n${detail.name}\n`)
    console.log(detail.skillMarkdown)
    if (detail.references.length) {
      console.log("\nReferences:")
      for (const ref of detail.references) {
        console.log(`  - ${ref.path}`)
      }
      console.log("")
    }
    return
  }

  if (sub === "install") {
    if (rest.includes("-h") || rest.includes("--help") || positional(rest).length === 0) {
      console.log(`
Usage: df-ui skills install <name> [--cwd <dir>] [--json]

Copy a bundled skill into .agents/skills and .cursor/skills.
`)
      return
    }
    const name = positional(rest)[0]
    const cwd = takeFlagValue(rest, "--cwd") || process.cwd()
    const result = installSkill(name, { cwd })
    if (wantsJson(rest)) {
      printJson(result)
      return
    }
    console.log(`\nInstalled ${result.name}\n`)
    for (const dest of result.written) {
      console.log(`  -> ${dest}`)
    }
    console.log("")
    return
  }

  throw new Error(`Unknown skills command "${sub}". Use list, show, or install.`)
}

function printSkillsHelp() {
  console.log(`
Usage: df-ui skills <command>

Commands:
  list              List bundled Agent Skills
  show <name>       Show SKILL.md and references
  install <name>    Copy into .agents/skills and .cursor/skills

Examples:
  df-ui skills list --json
  df-ui skills show design-file-ui
  df-ui skills install design-file-ui
`)
}
