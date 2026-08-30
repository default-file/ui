import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  resolveTokenLengths,
  resolveComposedScope,
  checkWholePixelTokens,
  checkCenteredPairs,
  checkZeroSlack,
  checkBannedTokenNames,
  findHardcodedGeometry,
} from "./df-geometry.mjs"

describe("resolveTokenLengths", () => {
  it("evaluates calc with a multiplier", () => {
    const css = `
      :root {
        --spacing-unit: 0.25rem;
        --size: calc(4 * var(--spacing-unit));
      }
    `
    const resolved = resolveTokenLengths(css)
    const entry = resolved.entries.find((e) => e.name === "--size")
    assert.equal(entry?.px, 16)
    assert.equal(entry?.skipReason, null)
  })

  it("resolves a var chain", () => {
    const css = `
      :root {
        --base: 8px;
        --mid: var(--base);
        --end: var(--mid);
      }
    `
    const resolved = resolveTokenLengths(css)
    assert.equal(
      resolved.entries.find((e) => e.name === "--end")?.px,
      8
    )
  })

  it("converts rem at a 16px root", () => {
    const css = `
      :root {
        --pad: 0.5rem;
      }
    `
    const resolved = resolveTokenLengths(css)
    assert.equal(resolved.entries.find((e) => e.name === "--pad")?.px, 8)
  })

  it("resolves density redeclarations independently", () => {
    const css = `
      :root {
        --spacing-unit: 0.25rem;
        --control: calc(8 * var(--spacing-unit));
      }
      [data-df-density="compact"] {
        --control: calc(6 * var(--spacing-unit));
      }
    `
    const resolved = resolveTokenLengths(css)
    const root = resolved.bySelector
      .get(":root")
      ?.get("--control")
    const compact = resolved.bySelector
      .get('[data-df-density="compact"]')
      ?.get("--control")
    assert.equal(root?.px, 32)
    assert.equal(compact?.px, 24)
  })

  it("reports a reference cycle instead of hanging", () => {
    const css = `
      :root {
        --a: var(--b);
        --b: var(--a);
      }
    `
    const resolved = resolveTokenLengths(css)
    const a = resolved.entries.find((e) => e.name === "--a")
    assert.equal(a?.px, null)
    assert.match(a?.skipReason ?? "", /cycle/i)
  })

  it("skips non-length values", () => {
    const css = `
      :root {
        --mix: color-mix(in oklch, black 50%, white);
        --pct: 50%;
        --unitless: 1.5;
      }
    `
    const resolved = resolveTokenLengths(css)
    for (const name of ["--mix", "--pct", "--unitless"]) {
      const entry = resolved.entries.find((e) => e.name === name)
      assert.equal(entry?.px, null)
      assert.ok(entry?.skipReason)
    }
  })
})

describe("checkCenteredPairs tiers", () => {
  const baseCss = `
    :root {
      --outer-zero: 16px;
      --inner-zero: 16px;
      --outer-strict-ok: 24px;
      --inner-strict-ok: 16px;
      --outer-strict-bad: 20px;
      --inner-strict-bad: 16px;
      --outer-even-ok: 18px;
      --inner-even-ok: 16px;
      --outer-even-bad: 19px;
      --inner-even-bad: 16px;
    }
  `

  it("zero tier: pass and fail", () => {
    const resolved = resolveTokenLengths(baseCss)
    const pass = checkCenteredPairs(resolved, [
      { outer: "--outer-zero", inner: "--inner-zero", tier: "zero" },
    ])
    assert.equal(pass.violations.length, 0)
    assert.equal(pass.stale.length, 0)

    const fail = checkCenteredPairs(resolved, [
      {
        outer: "--outer-strict-ok",
        inner: "--inner-strict-ok",
        tier: "zero",
      },
    ])
    assert.equal(fail.violations.length, 1)
    assert.equal(fail.violations[0].slack, 8)
  })

  it("strict tier: pass and fail", () => {
    const resolved = resolveTokenLengths(baseCss)
    const pass = checkCenteredPairs(resolved, [
      {
        outer: "--outer-strict-ok",
        inner: "--inner-strict-ok",
        tier: "strict",
      },
    ])
    assert.equal(pass.violations.length, 0)

    const fail = checkCenteredPairs(resolved, [
      {
        outer: "--outer-strict-bad",
        inner: "--inner-strict-bad",
        tier: "strict",
      },
    ])
    assert.equal(fail.violations.length, 1)
    assert.equal(fail.violations[0].slack, 4)
  })

  it("even tier: pass and fail", () => {
    const resolved = resolveTokenLengths(baseCss)
    const pass = checkCenteredPairs(resolved, [
      {
        outer: "--outer-even-ok",
        inner: "--inner-even-ok",
        tier: "even",
      },
    ])
    assert.equal(pass.violations.length, 0)

    const fail = checkCenteredPairs(resolved, [
      {
        outer: "--outer-even-bad",
        inner: "--inner-even-bad",
        tier: "even",
      },
    ])
    assert.equal(fail.violations.length, 1)
    assert.equal(fail.violations[0].slack, 3)
  })

  it("reports stale pairs missing from every block", () => {
    const resolved = resolveTokenLengths(baseCss)
    const result = checkCenteredPairs(resolved, [
      {
        outer: "--missing-outer",
        inner: "--missing-inner",
        tier: "strict",
      },
    ])
    assert.equal(result.violations.length, 0)
    assert.equal(result.stale.length, 1)
    assert.equal(result.stale[0].outer, "--missing-outer")
  })
})

describe("checkZeroSlack", () => {
  const css = `
    :root {
      --track: 24px;
      --gap: 4px;
      --thumb: 16px;
      --track-bad: 25px;
    }
  `

  it("passes when outer minus subtract terms is zero", () => {
    const resolved = resolveTokenLengths(css)
    const violations = checkZeroSlack(resolved, [
      {
        label: "switch default",
        outer: "--track",
        subtract: [
          { token: "--gap", times: 2 },
          { token: "--thumb", times: 1 },
        ],
      },
    ])
    assert.equal(violations.length, 0)
  })

  it("fails with the computed residual", () => {
    const resolved = resolveTokenLengths(css)
    const violations = checkZeroSlack(resolved, [
      {
        label: "switch default",
        outer: "--track-bad",
        subtract: [
          { token: "--gap", times: 2 },
          { token: "--thumb", times: 1 },
        ],
      },
    ])
    assert.equal(violations.length, 1)
    assert.equal(violations[0].residual, 1)
    assert.match(violations[0].reason, /residual 1px/)
  })

  it("reports a missing token", () => {
    const resolved = resolveTokenLengths(css)
    const violations = checkZeroSlack(resolved, [
      {
        label: "switch default",
        outer: "--track",
        subtract: [
          { token: "--gap", times: 2 },
          { token: "--missing-thumb", times: 1 },
        ],
      },
    ])
    assert.equal(violations.length, 1)
    assert.equal(violations[0].residual, null)
    assert.match(violations[0].reason, /missing token --missing-thumb/)
  })
})

describe("resolveTokenLengths with baseCss", () => {
  const baseCss = `
    :root {
      --spacing-unit: 0.25rem;
      --border-width-hairline: 1px;
      --leading: 20px;
      --height-md: calc(9 * var(--spacing-unit));
    }
  `

  it("resolves a component token against the base scope", () => {
    const componentsCss = `
      [data-df="input"] {
        --df-input-height: var(--height-md);
        --df-input-border-width: var(--border-width-hairline);
      }
    `
    const resolved = resolveTokenLengths(componentsCss, { baseCss })
    const height = resolved.bySelector
      .get('[data-df="input"]')
      ?.get("--df-input-height")
    const border = resolved.bySelector
      .get('[data-df="input"]')
      ?.get("--df-input-border-width")
    assert.equal(height?.px, 36)
    assert.equal(border?.px, 1)
    assert.equal(resolved.baseSelector, ":root")
  })

  it("resolves control sizes from the cozy :root density scope", () => {
    const densityBase = `
      :root {
        --spacing-unit: 0.25rem;
        --border-width-hairline: 1px;
      }
      :root,
      [data-df-density="cozy"] {
        --df-control-height-md: calc(9 * var(--spacing-unit));
      }
    `
    const componentsCss = `
      [data-df="input"] {
        --df-input-height: var(--df-control-height-md);
        --df-input-border-width: var(--border-width-hairline);
        --df-input-line-height: 20px;
        --df-input-padding-block: calc(
          (
            var(--df-input-height) - 2 * var(--df-input-border-width) -
              var(--df-input-line-height)
          ) / 2
        );
      }
    `
    const resolved = resolveTokenLengths(componentsCss, {
      baseCss: densityBase,
    })
    const block = resolved.bySelector.get('[data-df="input"]')
    assert.equal(block?.get("--df-input-height")?.px, 36)
    assert.equal(block?.get("--df-input-padding-block")?.px, 7)
  })

  it("lets a component block shadow a base token", () => {
    const componentsCss = `
      [data-df="input"] {
        --spacing-unit: 0.5rem;
        --df-input-height: calc(9 * var(--spacing-unit));
      }
    `
    const resolved = resolveTokenLengths(componentsCss, { baseCss })
    const height = resolved.bySelector
      .get('[data-df="input"]')
      ?.get("--df-input-height")
    assert.equal(height?.px, 72)
    const baseUnit = resolved.bySelector.get(":root")?.get("--spacing-unit")
    assert.equal(baseUnit?.px, 4)
  })

  it("checks zero-slack across component and base scopes", () => {
    const componentsCss = `
      [data-df="input"] {
        --df-input-height: var(--height-md);
        --df-input-line-height: var(--leading);
        --df-input-padding-block: calc(
          (
            var(--df-input-height) - 2 * var(--border-width-hairline) -
              var(--df-input-line-height)
          ) / 2
        );
      }
    `
    const resolved = resolveTokenLengths(componentsCss, { baseCss })
    const padding = resolved.bySelector
      .get('[data-df="input"]')
      ?.get("--df-input-padding-block")
    assert.equal(padding?.px, 7)

    const violations = checkZeroSlack(resolved, [
      {
        label: "input md",
        outer: "--df-input-height",
        subtract: [
          { token: "--border-width-hairline", times: 2 },
          { token: "--df-input-padding-block", times: 2 },
          { token: "--df-input-line-height", times: 1 },
        ],
      },
    ])
    assert.equal(violations.length, 0)

    const keyed = checkZeroSlack(resolved, [
      {
        label: "input md broken",
        outer: "--df-input-height",
        subtract: [
          { token: "--border-width-hairline", times: 2 },
          { token: "--df-input-line-height", times: 1 },
        ],
      },
    ])
    assert.equal(keyed.length, 1)
    assert.equal(keyed[0].selector, '[data-df="input"]')
    assert.equal(keyed[0].residual, 14)
  })

  it("composes size and border overlay rules before zero-slack", () => {
    const componentsCss = `
      [data-df="input"] {
        --df-input-height: var(--height-md);
        --df-input-border-width: var(--border-width-hairline);
        --df-input-line-height: var(--leading);
        --df-input-padding-block: calc(
          (
            var(--df-input-height) - 2 * var(--df-input-border-width) -
              var(--df-input-line-height)
          ) / 2
        );
      }
      [data-df="input"][data-size="sm"] {
        --df-input-height: calc(8 * var(--spacing-unit));
        --df-input-line-height: var(--leading);
      }
      [data-df="input"][data-border-width="thick"] {
        --df-input-border-width: 2px;
      }
    `
    const resolved = resolveTokenLengths(componentsCss, { baseCss })
    const violations = checkZeroSlack(resolved, [
      {
        label: "input sm thick",
        outer: "--df-input-height",
        compose: [
          { includes: ['[data-df="input"]'], excludes: ["data-size", "border-width"] },
          { includes: ['[data-size="sm"]'] },
          { includes: ['[data-border-width="thick"]'] },
        ],
        subtract: [
          { token: "--df-input-border-width", times: 2 },
          { token: "--df-input-padding-block", times: 2 },
          { token: "--df-input-line-height", times: 1 },
        ],
      },
    ])
    assert.equal(violations.length, 0)

    const composed = resolveComposedScope(resolved, [
      { includes: ['[data-df="input"]'], excludes: ["data-size", "border-width"] },
      { includes: ['[data-size="sm"]'] },
      { includes: ['[data-border-width="thick"]'] },
    ])
    assert.ok(!("error" in composed))
    assert.equal(composed.map.get("--df-input-height")?.px, 32)
    assert.equal(composed.map.get("--df-input-border-width")?.px, 2)
    assert.equal(composed.map.get("--df-input-padding-block")?.px, 4)
  })
})

describe("checkWholePixelTokens", () => {
  it("flags non-integer lengths and honors exemptions", () => {
    const css = `
      :root {
        --ok: 16px;
        --bad: 18.4px;
        --exempt: 0.5px;
      }
    `
    const resolved = resolveTokenLengths(css)
    const violations = checkWholePixelTokens(resolved, {
      "--exempt": "test exemption",
    })
    assert.equal(violations.length, 1)
    assert.equal(violations[0].name, "--bad")
    assert.equal(violations[0].px, 18.4)
  })
})

describe("checkBannedTokenNames", () => {
  it("matches banned name patterns", () => {
    const css = `
      :root {
        --df-control-optical-shift: 1px;
        --df-other: 2px;
      }
    `
    const resolved = resolveTokenLengths(css)
    const hits = checkBannedTokenNames(resolved, ["optical-shift"])
    assert.equal(hits.length, 1)
    assert.equal(hits[0].name, "--df-control-optical-shift")
  })
})

describe("findHardcodedGeometry", () => {
  it("reports hardcoded lengths and ignores var-backed values", () => {
    const css = `
.a {
  width: 16px;
  height: var(--x);
  margin: calc(2 * var(--spacing-unit));
  padding: 0;
  gap: 100%;
  transform: translateX(4px);
}
`
    const hits = findHardcodedGeometry(css)
    const literals = hits.map((h) => `${h.property}:${h.literal}`)
    assert.ok(literals.includes("width:16px"))
    assert.ok(literals.includes("transform:4px"))
    assert.ok(!literals.some((l) => l.startsWith("height:")))
    assert.ok(!literals.some((l) => l.startsWith("margin:")))
  })
})
