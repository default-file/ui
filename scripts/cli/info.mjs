import path from "node:path"

import { frameworkLabel } from "./constants.mjs"
import { detectFramework, readPackageJson } from "./detect.mjs"
import { readDfConfig } from "./df-config.mjs"
import { kitVersion } from "./kit-root.mjs"

export function infoCommand(args) {
  const cwd = path.resolve(parseCwd(args))

  const pkg = readPackageJson(cwd)
  const detected = detectFramework(cwd)
  const config = readDfConfig(cwd)
  const release = kitVersion()

  console.log(`\nDefault File UI: project info\n`)
  console.log(`  Directory:  ${cwd}`)
  console.log(`  Kit release: ${release}`)
  console.log(`  package.json: ${pkg ? "found" : "not found"}`)
  console.log(
    `  Detected framework: ${detected ? frameworkLabel(detected) : "unknown"}`
  )

  if (config) {
    console.log(`\n  df.json:`)
    console.log(`    version:     ${config.version ?? "n/a"}`)
    console.log(`    framework:   ${config.framework}`)
    console.log(`    installMode: ${config.installMode}`)
    console.log(`    colorScale:  ${config.colorScale}`)
    console.log(`    radius:      ${config.radius ?? "n/a"}`)
    console.log(`    cornerShape: ${config.cornerShape ?? "n/a"}`)
    console.log(`    hoverBorder: ${config.hoverBorder ?? "n/a"}`)
    console.log(`    baseDir:     ${config.baseDir}`)
    console.log(`    css:         ${config.css ?? "n/a"}`)
    if (config.version && config.version !== release) {
      console.log(
        `\n  Note: project was configured on ${config.version}; CLI kit is ${release}.`
      )
      console.log(
        "  Local copy source files are unchanged until you run df-ui add <item> --force."
      )
    }
  } else {
    console.log(`\n  df.json: not found. Run \`df-ui init\` to create it.`)
  }
  console.log("")
}

function parseCwd(args) {
  const index = args.indexOf("--cwd")
  if (index !== -1 && args[index + 1]) return args[index + 1]
  return process.cwd()
}
