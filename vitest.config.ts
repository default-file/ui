import { defineConfig } from "vitest/config"

// Component tests: Vitest + jsdom, include pattern src/**/*.test.tsx only.
// Lib unit tests stay on the app Node runner (node:test in *.test.ts).
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.tsx"],
    css: false,
  },
})
