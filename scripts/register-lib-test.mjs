import { register } from "node:module"

/**
 * Kit-local loader for `node --test` over TypeScript lib suites.
 * Resolves extensionless relative imports to .ts / .tsx / index.
 * Does not set app environment variables or path aliases.
 */
register("./lib-test-resolve-hooks.mjs", import.meta.url)
