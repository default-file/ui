import { readKitJson } from "./kit-root.mjs"

export const FRAMEWORKS = [
  "next",
  "vite",
  "react-router",
  "tanstack-start",
  "astro",
  "laravel",
  "react",
]

/** Branch that serves source installs and raw registry payloads. */
const REPO_BRANCH = "main"

/**
 * `owner/repo` for the kit source, parsed from `repository.url`.
 * The manifest is the only place the GitHub coordinates are declared.
 */
export const REPO_SLUG = readRepoSlug()

/** Published package name on the public registry. */
export const PACKAGE_NAME = "@default-file/ui"

/** Dependency spec written into consumer manifests and printed in guidance. */
export const PACKAGE_SPEC = `github:${REPO_SLUG}#${REPO_BRANCH}`

export const CSS_IMPORT = `@import "${PACKAGE_NAME}/css/df-index.css";`
export const CSS_IMPORT_JS = `import "${PACKAGE_NAME}/css/df-index.css"`

export const DF_JSON = "df.json"

export const RAW_BASE = `https://raw.githubusercontent.com/${REPO_SLUG}/${REPO_BRANCH}`

function readRepoSlug() {
  const url = String(readKitJson("package.json").repository?.url ?? "")
  const slug = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url)?.[1]
  if (!slug) {
    throw new Error(
      `Kit package.json repository.url must be a GitHub URL. Received: ${url || "(empty)"}`,
    )
  }
  return slug
}

export const COLOR_SCALES = ["detailed", "compact"]

export const INSTALL_MODES = ["package", "registry"]

export const DEFAULT_RADIUS = "0.625rem"

/** Corner curve presets. Maps to `--df-corner-shape-*` in df-tokens.css. */
export const CORNER_SHAPES = ["round", "smooth"]

/** Classic circular arcs. Matches kit `--df-corner-shape` default. */
export const DEFAULT_CORNER_SHAPE = "round"

/** Field hover border theme. Maps to `--df-hover-border` and host `data-df-hover-border`. */
export const HOVER_BORDERS = ["on", "off"]

/** Matches kit `--df-hover-border` default. */
export const DEFAULT_HOVER_BORDER = "on"

export function isColorScale(value) {
  return COLOR_SCALES.includes( (value))
}

export function isInstallMode(value) {
  return INSTALL_MODES.includes( (value))
}

export function isRadius(value) {
  return /^(0|\d*\.?\d+(rem|em|px))$/.test(String(value).trim())
}

export function isCornerShape(value) {
  return CORNER_SHAPES.includes(String(value))
}

export function isHoverBorder(value) {
  return HOVER_BORDERS.includes(String(value))
}

/** CSS value written into the host stylesheet for `--df-corner-shape`. */
export function cornerShapeCssValue(shape) {
  return shape === "smooth"
    ? "var(--df-corner-shape-smooth)"
    : "var(--df-corner-shape-round)"
}

export function isFramework(framework) {
  return FRAMEWORKS.includes( (framework))
}

export function frameworkLabel(framework) {
  switch (framework) {
    case "next":
      return "Next.js"
    case "vite":
      return "Vite"
    case "react-router":
      return "React Router"
    case "tanstack-start":
      return "TanStack Start"
    case "astro":
      return "Astro"
    case "laravel":
      return "Laravel (Inertia + React)"
    case "react":
      return "React"
    default:
      return framework
  }
}
