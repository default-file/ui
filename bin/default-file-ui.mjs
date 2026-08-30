#!/usr/bin/env node
import { run } from "../scripts/cli/main.mjs"

run(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nError: ${message}\n`)
  process.exit(1)
})
