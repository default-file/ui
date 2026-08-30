import path from "node:path"

import {
  DEFAULT_CORNER_SHAPE,
  DEFAULT_HOVER_BORDER,
  DEFAULT_RADIUS,
  DF_JSON,
} from "./constants.mjs"
import { exists, readText, writeText } from "./fs-utils.mjs"
import { kitVersion } from "./kit-root.mjs"

export function defaultBaseDir(cwd) {
  return exists(path.join(cwd, "src")) ? "src" : "."
}

export function readDfConfig(cwd) {
  const file = path.join(cwd, DF_JSON)
  if (!exists(file)) return null
  try {
    return JSON.parse(readText(file))
  } catch {
    return null
  }
}

export function writeDfConfig(cwd, config) {
  const file = path.join(cwd, DF_JSON)
  writeText(file, `${JSON.stringify(config, null, 2)}\n`)
  return file
}

export function buildDfConfig(cwd, framework, options = {}) {
  const baseDir = defaultBaseDir(cwd)
  return {
    version: options.version ?? kitVersion(),
    framework,
    installMode: options.installMode ?? "package",
    colorScale: options.colorScale ?? "detailed",
    radius: options.radius ?? DEFAULT_RADIUS,
    cornerShape: options.cornerShape ?? DEFAULT_CORNER_SHAPE,
    hoverBorder: options.hoverBorder ?? DEFAULT_HOVER_BORDER,
    baseDir,
    aliases: {
      ui: "@/default-file-ui",
      lib: "@/lib",
    },
    css: options.css ?? null,
  }
}
