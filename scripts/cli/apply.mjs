import path from "node:path"

import {
  CSS_IMPORT,
  CSS_IMPORT_JS,
  DEFAULT_CORNER_SHAPE,
  DEFAULT_HOVER_BORDER,
  DEFAULT_RADIUS,
  PACKAGE_SPEC,
  cornerShapeCssValue,
  frameworkLabel,
} from "./constants.mjs"
import { readPackageJson } from "./detect.mjs"
import {
  ensureCssImport,
  findFirst,
  installPackages,
  packageManager,
  readText,
  writeText,
} from "./fs-utils.mjs"

export function applyKit(cwd, framework, options = {}) {
  const pm = packageManager()
  const pkg = readPackageJson(cwd)
  if (!pkg) {
    throw new Error(`No package.json found in ${cwd}`)
  }

  const toInstall = []
  if (!hasDep(pkg, "@default-file/ui")) toInstall.push(PACKAGE_SPEC)
  if (!hasDep(pkg, "lucide-react")) toInstall.push("lucide-react")
  if (!hasDep(pkg, "react")) toInstall.push("react")
  if (!hasDep(pkg, "react-dom")) toInstall.push("react-dom")

  if (!options.skipInstall && toInstall.length > 0) {
    console.log(`Installing: ${toInstall.join(", ")}`)
    installPackages(pm, toInstall, cwd)
  } else if (toInstall.length === 0) {
    console.log("Dependencies already present.")
  }

  const css = ensureStylesheet(cwd, framework)
  const configNotes = []

  if (options.radius && options.radius !== DEFAULT_RADIUS && css.path) {
    const radiusResult = ensureRadiusOverride(css.path, options.radius)
    if (radiusResult.changed) {
      console.log(
        `Radius: set --radius to ${options.radius} in ${path.relative(cwd, css.path)}`
      )
    }
  }

  if (
    options.cornerShape &&
    options.cornerShape !== DEFAULT_CORNER_SHAPE &&
    css.path
  ) {
    const cornerResult = ensureCornerShapeOverride(css.path, options.cornerShape)
    if (cornerResult.changed) {
      console.log(
        `Corner shape: set --df-corner-shape to ${options.cornerShape} in ${path.relative(cwd, css.path)}`
      )
    }
  }

  if (
    options.hoverBorder &&
    options.hoverBorder !== DEFAULT_HOVER_BORDER &&
    css.path
  ) {
    const hoverResult = ensureHoverBorderOverride(css.path, options.hoverBorder)
    if (hoverResult.changed) {
      console.log(
        `Hover border: set --df-hover-border to ${options.hoverBorder} in ${path.relative(cwd, css.path)}`
      )
    }
  }

  if (framework === "next") {
    const patched = ensureNextTranspile(cwd)
    if (patched.changed) {
      console.log(`Updated ${path.relative(cwd, patched.path)} (transpilePackages).`)
    } else if (patched.path) {
      console.log(`Next transpile already configured (${path.relative(cwd, patched.path)}).`)
    } else {
      configNotes.push(
        'Add transpilePackages: ["@default-file/ui"] to next.config.'
      )
    }
  }

  if (framework === "astro") {
    configNotes.push(
      "Interactive components need a client directive (client:load or client:visible)."
    )
    if (!hasDep(pkg, "@astrojs/react") && !hasDep(readPackageJson(cwd) ?? {}, "@astrojs/react")) {
      configNotes.push("Run `npx astro add react` if the React integration is not installed.")
    }
  }

  if (framework === "laravel") {
    configNotes.push(
      "Laravel support expects an Inertia + React front end (not Blade/Livewire alone)."
    )
  }

  console.log(`\nDefault File UI is ready for ${frameworkLabel(framework)}.`)
  if (css.path) {
    console.log(
      css.changed
        ? `Stylesheet: added import in ${path.relative(cwd, css.path)}`
        : `Stylesheet: already imported in ${path.relative(cwd, css.path)}`
    )
  }
  for (const note of configNotes) console.log(note)
  console.log(`\nTry:\n  import { Button } from "@default-file/ui/components/df-button"\n`)

  return { css, configNotes }
}

function hasDep(pkg, name) {
  const deps = pkg.dependencies
  const dev = pkg.devDependencies
  return Boolean(deps?.[name] || dev?.[name])
}

function ensureStylesheet(cwd, framework) {
  const candidates = stylesheetCandidates(framework)
  const existing = findFirst(cwd, candidates)
  if (existing) {
    return ensureCssImport(existing, CSS_IMPORT)
  }

  if (framework === "astro") {
    const layout = findFirst(cwd, [
      "src/layouts/Layout.astro",
      "src/layouts/layout.astro",
      "src/layouts/BaseLayout.astro",
      "src/layouts/main.astro",
    ])
    if (layout) {
      return ensureAstroLayoutImport(layout)
    }
  }

  const fallback = path.join(cwd, "src/styles/default-file-ui.css")
  writeText(fallback, `${CSS_IMPORT}\n`)
  console.log(
    `Created ${path.relative(cwd, fallback)}. Import it once from your app entry if it is not already loaded.`
  )
  return { path: fallback, changed: true }
}

function stylesheetCandidates(framework) {
  switch (framework) {
    case "next":
      return [
        "src/app/globals.css",
        "app/globals.css",
        "src/app/global.css",
        "app/global.css",
        "styles/globals.css",
      ]
    case "vite":
    case "react":
    case "tanstack-start":
      return [
        "src/index.css",
        "src/styles.css",
        "src/app.css",
        "src/styles/globals.css",
        "app/globals.css",
      ]
    case "react-router":
      return ["app/app.css", "app/globals.css", "src/app.css", "src/index.css"]
    case "astro":
      return [
        "src/styles/global.css",
        "src/styles/globals.css",
        "src/global.css",
        "src/index.css",
      ]
    case "laravel":
      return [
        "resources/css/app.css",
        "resources/css/app.scss",
        "resources/js/app.css",
      ]
    default:
      return ["src/index.css", "src/app/globals.css"]
  }
}

function ensureRadiusOverride(cssPath, radius) {
  const marker = "/* df-ui:radius */"
  const block = `${marker}\n:root {\n  --radius: ${radius};\n}`
  return ensureMarkedRootBlock(cssPath, marker, block)
}

function ensureCornerShapeOverride(cssPath, cornerShape) {
  const marker = "/* df-ui:corner-shape */"
  const value = cornerShapeCssValue(cornerShape)
  const block = `${marker}\n:root {\n  --df-corner-shape: ${value};\n}`
  return ensureMarkedRootBlock(cssPath, marker, block)
}

function ensureHoverBorderOverride(cssPath, hoverBorder) {
  const marker = "/* df-ui:hover-border */"
  const block = `${marker}\n:root {\n  --df-hover-border: ${hoverBorder};\n}`
  return ensureMarkedRootBlock(cssPath, marker, block)
}

function ensureMarkedRootBlock(cssPath, marker, block) {
  const current = readText(cssPath)

  if (current.includes(marker)) {
    const next = current.replace(
      new RegExp(`${escapeRegExp(marker)}\\s*:root\\s*\\{[^}]*\\}`),
      block
    )
    if (next === current) return { path: cssPath, changed: false }
    writeText(cssPath, next)
    return { path: cssPath, changed: true }
  }

  const separator = current.endsWith("\n") ? "\n" : "\n\n"
  writeText(cssPath, `${current}${separator}${block}\n`)
  return { path: cssPath, changed: true }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureAstroLayoutImport(layoutPath) {
  const current = readText(layoutPath)
  if (current.includes("@default-file/ui/css/df-index.css")) {
    return { path: layoutPath, changed: false }
  }
  if (current.trimStart().startsWith("---")) {
    const end = current.indexOf("---", 3)
    if (end !== -1) {
      const head = current.slice(0, end)
      const rest = current.slice(end)
      if (!head.includes("@default-file/ui/css/df-index.css")) {
        const next = `${head}${CSS_IMPORT_JS}\n${rest}`
        writeText(layoutPath, next)
        return { path: layoutPath, changed: true }
      }
    }
  }
  writeText(layoutPath, `---\n${CSS_IMPORT_JS}\n---\n${current}`)
  return { path: layoutPath, changed: true }
}

function ensureNextTranspile(cwd) {
  const configPath = findFirst(cwd, [
    "next.config.ts",
    "next.config.mjs",
    "next.config.js",
    "next.config.cjs",
  ])
  if (!configPath) return { path: null, changed: false }

  const source = readText(configPath)
  if (
    source.includes("@default-file/ui") &&
    /transpilePackages\s*:/.test(source)
  ) {
    return { path: configPath, changed: false }
  }

  if (/transpilePackages\s*:\s*\[/.test(source)) {
    const next = source.replace(
      /transpilePackages\s*:\s*\[/,
      'transpilePackages: ["@default-file/ui", '
    )
    writeText(configPath, next)
    return { path: configPath, changed: true }
  }

  if (/const\s+nextConfig\s*=\s*\{/.test(source)) {
    const next = source.replace(
      /const\s+nextConfig\s*=\s*\{/,
      'const nextConfig = {\n  transpilePackages: ["@default-file/ui"],'
    )
    writeText(configPath, next)
    return { path: configPath, changed: true }
  }

  if (/export\s+default\s*\{/.test(source)) {
    const next = source.replace(
      /export\s+default\s*\{/,
      'export default {\n  transpilePackages: ["@default-file/ui"],'
    )
    writeText(configPath, next)
    return { path: configPath, changed: true }
  }

  return { path: configPath, changed: false }
}
