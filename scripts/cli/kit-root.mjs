import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/** Absolute path to the @default-file/ui package root. */
export function kitRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
}

/** Semver from the kit package.json. */
export function kitVersion() {
  return readKitJson("package.json").version
}

/** Join path segments under the kit package root. */
export function kitPath(...segments) {
  return path.join(kitRoot(), ...segments)
}

/** Read and parse a JSON file under the kit package root. */
export function readKitJson(...segments) {
  const filePath = kitPath(...segments)
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

/** True when a file exists under the kit package root. */
export function kitFileExists(...segments) {
  try {
    fs.accessSync(kitPath(...segments))
    return true
  } catch {
    return false
  }
}
