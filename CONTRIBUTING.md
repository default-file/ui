# Contributing to Default File UI

Thanks for your interest in the kit. This guide covers the local setup, the
architecture, and the bar a change has to meet before it can merge.

## Requirements

- Node `>=22.6` for development. The published CLI supports Node `>=18`.
- npm. The repository ships an `npm` lockfile and CI runs `npm ci`.

## Local setup

```bash
git clone https://github.com/default-file/ui.git
cd ui
npm ci
```

`npm ci` runs `prepare`, which builds `dist/` from `src/` and points
`core.hooksPath` at the tracked `.githooks` directory.

That directory holds a `pre-push` guard. It compares the push target against
`repository.url` in `package.json` and rejects anything else, so a stray
remote cannot publish the kit from the wrong repository. If the repository
genuinely moves, change `repository.url` in the same commit. Every install
command, raw registry URL, and documentation link is derived from that field.

## Repository layout

| Path | Contents |
|---|---|
| `src/components/df-*.tsx` | React components. One component family per file. |
| `src/css/` | Token layers, reset, animations, component chrome, utilities. |
| `src/hooks/`, `src/lib/` | Hooks and framework free logic modules. |
| `scripts/` | Token, utility, and registry generators. |
| `scripts/cli/` | The `df-ui` CLI and the stdio MCP server. |
| `registry.json` | Source of truth for installable copy source items. |
| `docs/api/` | Generated prop tables consumed by the CLI, MCP, and docs site. |
| `public/r/` | Built registry payloads. Generated, never hand edited. |

## Design tokens are mandatory

Every color, radius, type size, spacing value, shadow, blur, border width,
opacity, z-index, and control size in kit chrome must resolve through a token.

- Prefer a semantic utility when the intent is clear, for example `bg-card`,
  `border-border`, `text-muted-foreground`, `rounded-xl`, `gap-3`.
- Use a named scale utility when you need a specific step, for example
  `bg-neutral-40`, `text-11`, `text-2xs`.
- Use `var(--...)` when no utility exists yet.
- If no token fits, add the token in `src/css/df-tokens.css` or the theme
  tables in `scripts/df-theme.mjs` first, regenerate, then consume it.

Raw values such as `text-[13px]`, `bg-[#f7f7f8]`, `rounded-[28px]`, or an
inline `box-shadow` are rejected in review. Even a hairline border is
`var(--border-width-hairline)`.

Domain data is exempt: extracted palette values, canvas and WebGL pixel work,
color picker spectrum math, and SVG illustration art.

## Generators

Run these from the repository root and commit their output with your change.

```bash
npm run df:colors        # color scales
npm run df:utilities     # utility classes
npm run df:breakpoints   # breakpoint tokens
npm run df:tokens        # all three
npm run df:registry      # public/r payloads from registry.json
```

`df:utilities` scans kit components for class names and writes
`src/css/df-utilities.css` plus `src/css/df-utilities.classes.json`, the list of
classes the kit covers.

Consuming applications reuse the same generator rather than keeping their own
copy. They pass `--app-root <dir>`, which adds a scan of that project and writes
a second stylesheet holding only the classes the kit does not already cover.
The project can declare tokens the scan cannot see, and prefixes it styles
itself, in `<app-root>/scripts/df-app-extra-classes.mjs`.

An installed package carries no component sources, so in that case the
generator reads the shipped class list and leaves the kit stylesheet alone.

## Verification

Run the full suite before opening a pull request. CI runs the same commands.

```bash
npm run verify
npm run test:discovery
```

`verify` covers the registry check, geometry audit, library tests, typecheck,
lint, component tests, script tests, the build, and a `dist` check.

To exercise a single layer:

```bash
npm run typecheck
npm run lint
npm run test:lib
npm run test:components
```

## Adding a component

1. Create `src/components/df-<name>.tsx`. Add `"use client"` only when the
   component needs browser APIs, state, or effects.
2. Put chrome in `src/css/df-components.css` using tokens.
3. Export the component from the components index.
4. Register the item and its files in `registry.json`, then run
   `npm run df:registry`.
5. Add component tests under `src/components/`. Accessibility assertions run
   through the axe matchers already wired into the test setup.
6. Run `npm run verify`.

## Versioning and changelog

The kit follows semver.

| Bump | Use when |
|---|---|
| patch | Bug fix, safe CSS or copy correction, no contract change |
| minor | New component, token, CLI flag, additive prop, safer default |
| major | Breaking change to props, tokens, CSS entry points, registry paths, or CLI contracts |

Every change that ships to consumers must, in the same pull request:

1. Set `version` in `package.json`.
2. Align the root `version` in `package-lock.json`.
3. Add a `## x.y.z` section at the top of `CHANGELOG.md` with short bullets
   describing what shipped.

## Writing style

Comments and documentation are read by other engineers and by consumers, so
treat them as product copy.

- Prefer no comment when the code is already clear.
- When a comment is needed, write one or two short sentences stating the
  contract, not the history of the change.
- Do not write fix narratives, changelog notes, or debugging stories in code.
- Do not leave `TODO`, `FIXME`, or `HACK` that defers the real fix.
- Do not name other design tools or UI stacks anywhere in the repository.

## Pull requests

- Keep one concern per pull request.
- Describe the behavior change and how you verified it.
- Include before and after screenshots for visual changes.
- Confirm `npm run verify` passes locally.

## Releases

Maintainers publish by creating a GitHub Release whose tag matches the version
in `package.json`, for example `v0.30.0`. The release workflow verifies the tag,
runs the full suite, and publishes to the public registry over OpenID Connect.
No publish token is stored in this repository.

## License

By contributing you agree that your contributions are licensed under the MIT
license in [LICENSE](./LICENSE).
