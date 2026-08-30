import { createElement, type SVGProps } from "react"
import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"
import "vitest-axe/extend-expect"

function MockIcon(props: SVGProps<SVGSVGElement>) {
  return createElement("svg", { "data-df": "lucide-mock", ...props })
}

vi.mock("lucide-react", () => {
  const target = { __esModule: true as const }
  return new Proxy(target, {
    get(_obj, prop) {
      // Keep `then` undefined so the mock namespace is not treated as a Promise.
      if (prop === "then" || typeof prop === "symbol") return undefined
      if (prop === "__esModule") return true
      return MockIcon
    },
    has(_obj, prop) {
      return typeof prop === "string" && prop !== "then"
    },
    getOwnPropertyDescriptor(_obj, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: prop === "__esModule" ? true : MockIcon,
      }
    },
  })
})
