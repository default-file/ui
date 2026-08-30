import path from "node:path"

import { applyKit } from "./apply.mjs"
import {
  COLOR_SCALES,
  CORNER_SHAPES,
  DEFAULT_CORNER_SHAPE,
  DEFAULT_HOVER_BORDER,
  DEFAULT_RADIUS,
  FRAMEWORKS,
  HOVER_BORDERS,
  INSTALL_MODES,
  frameworkLabel,
  isColorScale,
  isCornerShape,
  isFramework,
  isHoverBorder,
  isInstallMode,
  isRadius,
} from "./constants.mjs"
import { detectFramework } from "./detect.mjs"
import { buildDfConfig, writeDfConfig } from "./df-config.mjs"
import { exists } from "./fs-utils.mjs"
import { assertProjectName, scaffoldProject } from "./scaffold.mjs"

export async function initCommand(args) {
  const options = parseInitArgs(args)

  if (options.help) {
    printInitHelp()
    return
  }

  if (options.colorScale && !isColorScale(options.colorScale)) {
    throw new Error(
      `Unknown --color-scale "${options.colorScale}". Use one of: ${COLOR_SCALES.join(", ")}`
    )
  }
  if (options.installMode && !isInstallMode(options.installMode)) {
    throw new Error(
      `Unknown --install-mode "${options.installMode}". Use one of: ${INSTALL_MODES.join(", ")}`
    )
  }
  if (options.radius && !isRadius(options.radius)) {
    throw new Error(
      `Invalid --radius "${options.radius}". Use a CSS length like 0, 0.375rem, or 12px.`
    )
  }
  if (options.cornerShape && !isCornerShape(options.cornerShape)) {
    throw new Error(
      `Unknown --corner-shape "${options.cornerShape}". Use one of: ${CORNER_SHAPES.join(", ")}`
    )
  }
  if (options.hoverBorder && !isHoverBorder(options.hoverBorder)) {
    throw new Error(
      `Unknown --hover-border "${options.hoverBorder}". Use one of: ${HOVER_BORDERS.join(", ")}`
    )
  }

  if (options.template) {
    if (!isFramework(options.template)) {
      throw new Error(
        `Unknown template "${options.template}". Use one of: ${FRAMEWORKS.join(", ")}`
      )
    }
    if (options.template === "laravel") {
      throw new Error(
        "Use `laravel new` + Inertia React, then run `df-ui init` inside that app."
      )
    }

    const name = options.name ?? `df-${options.template}-app`
    assertProjectName(name)
    const parent = path.resolve(options.cwd)
    const projectDir = scaffoldProject(options.template, name, parent)
    const result = applyKit(projectDir, options.template, {
      radius: options.radius,
      cornerShape: options.cornerShape,
      hoverBorder: options.hoverBorder,
    })
    finalizeConfig(projectDir, options.template, options, result)
    console.log(`\nNext:\n  cd ${name}\n  npm run dev\n`)
    return
  }

  const cwd = path.resolve(options.cwd)
  if (!exists(path.join(cwd, "package.json"))) {
    throw new Error(
      `No package.json in ${cwd}. Create an app first, or pass -t <framework> to scaffold.`
    )
  }

  const framework =
    options.framework && isFramework(options.framework)
      ? options.framework
      : detectFramework(cwd)

  if (!framework) {
    throw new Error(
      `Could not detect the framework. Pass --framework <${FRAMEWORKS.join("|")}>`
    )
  }

  console.log(`Detected ${frameworkLabel(framework)} in ${cwd}`)
  const result = applyKit(cwd, framework, {
    radius: options.radius,
    cornerShape: options.cornerShape,
    hoverBorder: options.hoverBorder,
  })
  finalizeConfig(cwd, framework, options, result)
}

function finalizeConfig(cwd, framework, options, result) {
  const colorScale = options.colorScale ?? "detailed"
  const hoverBorder = options.hoverBorder ?? DEFAULT_HOVER_BORDER
  const config = buildDfConfig(cwd, framework, {
    installMode: options.installMode ?? "package",
    colorScale,
    radius: options.radius ?? DEFAULT_RADIUS,
    cornerShape: options.cornerShape ?? DEFAULT_CORNER_SHAPE,
    hoverBorder,
    css: result?.css?.path ? path.relative(cwd, result.css.path) : null,
  })
  const file = writeDfConfig(cwd, config)
  console.log(`Wrote ${path.relative(cwd, file)} (project map for \`df-ui add\`).`)
  if (colorScale !== "detailed") {
    console.log(
      `Set data-df-color-scale="${colorScale}" on <html> so unscoped --df-*-{step} aliases follow compact.`
    )
    console.log(
      `Both --df-*-detailed-* and --df-*-compact-* remain defined.`
    )
  }
  if (hoverBorder !== DEFAULT_HOVER_BORDER) {
    console.log(
      `Set data-df-hover-border="${hoverBorder}" on <html> so field hover borders follow the theme.`
    )
  }
}

function parseInitArgs(args) {
  const options = {
    template: null,
    framework: null,
    name: null,
    colorScale: null,
    installMode: null,
    radius: null,
    cornerShape: null,
    hoverBorder: null,
    cwd: process.cwd(),
    help: false,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "-h" || arg === "--help") options.help = true
    else if (arg === "-t" || arg === "--template") {
      options.template = args[++i] ?? null
    } else if (arg === "-f" || arg === "--framework") {
      options.framework = args[++i] ?? null
    } else if (arg === "-n" || arg === "--name") {
      options.name = args[++i] ?? null
    } else if (arg === "--color-scale") {
      options.colorScale = args[++i] ?? null
    } else if (arg === "--install-mode") {
      options.installMode = args[++i] ?? null
    } else if (arg === "--radius") {
      options.radius = args[++i] ?? null
    } else if (arg === "--corner-shape") {
      options.cornerShape = args[++i] ?? null
    } else if (arg === "--hover-border") {
      options.hoverBorder = args[++i] ?? null
    } else if (arg === "--cwd") {
      options.cwd = args[++i] ?? process.cwd()
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    } else if (!options.name) {
      options.name = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  return options
}

function printInitHelp() {
  console.log(`
Usage:
  df-ui init
  df-ui init -t <framework> [--name <dir>]
  df-ui init --framework <framework>

Scaffold a new app (-t), or configure Default File UI in the current project.
Writes df.json (project map) so \`df-ui add\` knows where to copy items.

Templates:
  ${FRAMEWORKS.filter((f) => f !== "laravel").join(", ")}

Options:
  -t, --template <fw>       Scaffold a new app for <fw>
  -f, --framework <fw>      Force framework when configuring in place
  -n, --name <dir>          Project directory name (with -t)
      --color-scale <s>     ${COLOR_SCALES.join(" | ")} (default: detailed)
      --install-mode <m>    ${INSTALL_MODES.join(" | ")} (default: package)
      --radius <len>        Corner radius token, e.g. 0, 0.375rem, 1rem (default: ${DEFAULT_RADIUS})
      --corner-shape <s>    ${CORNER_SHAPES.join(" | ")} (default: ${DEFAULT_CORNER_SHAPE})
      --hover-border <s>    ${HOVER_BORDERS.join(" | ")} (default: ${DEFAULT_HOVER_BORDER})

Laravel: create the Inertia + React app first, then run init in that folder.

Examples:
  df-ui init -t next --name my-app
  df-ui init -t vite --color-scale compact
  df-ui init -t next --radius 1rem
  df-ui init -t next --corner-shape smooth
  df-ui init -t next --hover-border off
  df-ui init --framework astro
`)
}
