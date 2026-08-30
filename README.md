# Default File UI

[![CI](https://github.com/default-file/ui/actions/workflows/ci.yml/badge.svg)](https://github.com/default-file/ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@default-file/ui.svg)](https://www.npmjs.com/package/@default-file/ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Owned design system for Default File: color scales, tokens, components, and motion. Use it in your own projects.

Components, tokens, and CSS ship together. Install the whole package, or copy
individual components into your app as source you own. Docs and live examples:
[defaultfile.com/ui](https://defaultfile.com/ui).

## Quick start (CLI)

Scaffold a new app with Default File UI already wired:

```bash
npx --yes -p @default-file/ui df-ui init -t next
```

Templates: `next`, `vite`, `react-router`, `tanstack-start`, `astro`, `react`.

Configure an existing React app (also writes `df.json`, the project map):

```bash
npx --yes -p @default-file/ui df-ui init
```

Add components (copy source) into your app, resolving dependencies:

```bash
npx --yes -p @default-file/ui df-ui add button
```

Existing local files stay in your project. Kit releases do not replace them
unless you choose to upgrade:

```bash
df-ui add button --force
```

Inspect the kit version and `df.json` (init records `version`):

```bash
npx --yes -p @default-file/ui df-ui version
npx --yes -p @default-file/ui df-ui info
```

Discover the kit (human or agent):

```bash
df-ui list --json
df-ui show button --json
df-ui search "toast select" --json
df-ui cover "settings form with select, switch, and toast" --json
df-ui tokens --group radius --json
df-ui docs colors
df-ui docs overview
df-ui skills list --json
df-ui skills install design-file-ui
```

Agent skill (skills.sh-compatible):

```bash
npx skills add default-file/ui --skill design-file-ui
```

`show` returns full prop tables from `docs/api` (name, type, default, description).

Commands honor the active package manager. With pnpm, yarn, or bun use the
matching runner (`pnpm dlx`, `yarn dlx`, `bunx`). Pass `--color-scale compact`
to `init` to record a compact scale in `df.json`.

## MCP for AI hosts

Stdio MCP so any host that supports MCP can inspect and install the kit:

```bash
df-ui mcp
```

Example host config:

```json
{
  "mcpServers": {
    "default-file-ui": {
      "command": "npx",
      "args": [
        "--yes",
        "-p",
        "@default-file/ui",
        "df-ui",
        "mcp"
      ]
    }
  }
}
```

Tools: `list_components`, `get_component`, `list_tokens`, `search_kit`, `check_coverage`, `get_docs`, `list_skills`, `get_skill`, `install_skill`, `init_project`, `add_components`.

Agent brief: [docs/agents.md](./docs/agents.md).

## Color system

Install color scales, semantic tokens, and utilities without components.

Package entry:

```bash
npm install @default-file/ui
```

```css
@import "@default-file/ui/css/df-color-system.css";
```

Copy source:

```bash
df-ui add color-system
```

```css
@import "@/default-file-ui/css/df-color-system.css";
```

Component peer packages are optional when you only import the color system CSS. See `df-ui docs colors` and `df-ui tokens --group color-scale`.

## Install (full kit)

```bash
npm install @default-file/ui
```

Component peers: `react`, `react-dom`, `lucide-react` (and `rough-notation` for TextMark).

```css
@import "@default-file/ui/css/df-index.css";
```

```ts
import { Button } from "@default-file/ui/components/df-button"
```

`df-index.css` includes the color system, plus reset, animations, and component styles.

## Ownership and upgrades

- **Copy source (`df-ui add`):** files land in your app. Edit them as product code. New kit releases do not overwrite those files unless you run `df-ui add <item> --force`.
- **Package imports (`@default-file/ui/...`):** components come from the dependency. Your app files are not rewritten on install. You receive kit changes only when you upgrade that dependency.
- **Versioning:** the design system uses semver in `package.json`. `df-ui init` writes that version into `df.json`. Use `df-ui version` and `df-ui info` to compare the release with your project.

## Registry (copy source)

Root `registry.json` lists installable items. Built payloads live under `public/r/` after `npm run df:registry`.

`df-ui add` reads the catalogue and file contents from the installed kit, so copied files match `df-ui version` and the command needs no network. The pinned release tag is read only when the kit ships neither the source nor its payload.

GitHub registry path: `default-file/ui/<item>`

| Item | Purpose |
|---|---|
| `color-system` | Scales, tokens, utilities |
| `foundation` | Kit CSS entry, component styles, hooks, `cn` (depends on `color-system`) |
| component names | UI primitives (each depends on `foundation`) |

Machine-readable prop docs: `docs/api/`. Catalogue metadata: `docs/catalog.json`.

## Color scale modes

Primitive scales always define both palettes with an infix density marker:

- `--df-neutral-detailed-500`
- `--df-neutral-compact-500`

Unscoped aliases (`--df-neutral-500`) follow the mode on `<html>`:

- `data-df-color-scale="detailed"` (default): aliases point at detailed
- `data-df-color-scale="compact"`: aliases point at compact

Utility classes (`bg-neutral-500`, etc.) use the unscoped aliases, so they
follow the host mode. Use the infix tokens when you need a specific palette
regardless of mode.

## Token layers

Primitives live under `--df-*` (scales for color, type, space, radius, shadow, motion, opacity, z-index, control sizes, breakpoints, touch targets). Semantic tokens (`--background`, `--border`, `--overlay-*`, `--brand-ink`, `--z-overlay`, ...) name intent and point at primitives. Kit CSS and components resolve chrome through these vars only.

Responsive tokens and utilities:

- Breakpoints: `--df-breakpoint-sm` to `--df-breakpoint-3xl` (from `BREAKPOINTS` in `scripts/df-theme.mjs`).
- Utility variants: `sm:` to `3xl:` (min-width), `max-sm:` to `max-3xl:` (max-width), `@sm:` to `@3xl:` and `@container`.
- Touch targets: `--df-touch-target-min`, `--df-touch-target-comfortable`.
- Density: host `data-df-density` (`cozy`, `comfortable`, or `compact`) sets `--df-control-height-*`. Related sizes use `--df-affordance-size-*`, `--df-slider-track-height`, `--df-tabs-segment-min-height-*`, and `--df-switch-track-*`. Authors use semantic `size` props (`default` or `md` for mid-size by family). Color-scale `compact` is palette-only.
- Safe-area: `--df-safe-area-inset-*`. Hosts compose `--df-overlay-inset-top` and `--df-overlay-inset-bottom` with sticky chrome.

## Package imports and local development

Published consumers import compiled modules from `dist/` through the package
`exports` map (for example `@default-file/ui/components/df-button`). CSS still
ships from `src/css/` via the same map. A git install runs `prepare` to build
`dist/` before the package is linked into the consumer.

In the UX Tools monorepo, edit the kit under `./default-file-ui` only. From the
app root, run `npm run df:sync` so `node_modules/@default-file/ui` picks up
local sources and the kit version. Do not edit the copy under `node_modules`.

## Peer dependencies

Required for component usage: `react` and `react-dom` (`>=18`).

Optional peers (install when you use the matching surface):

| Peer | Used by |
|---|---|
| `lucide-react` | Icon props across many components |
| `rough-notation` | `TextMark` |
| `@tanstack/react-virtual` | Virtualized lists and grids |

Color-system CSS alone does not require component peers.

## CSS import order

Prefer the kit entry when you want the full stack:

```css
@import "@default-file/ui/css/df-index.css";
```

`df-index.css` loads, in order: color system, reset, animations, component
styles, then utilities.

Color system only:

```css
@import "@default-file/ui/css/df-color-system.css";
```

If you compose layers yourself, keep that same order so utilities can override
component chrome.

## Browser support

Target current evergreen browsers (latest Chrome, Firefox, Safari, and Edge).
The kit uses modern CSS (including `oklch` color tokens) and ES modules. Node
for the CLI is `>=18` (`engines`); maintainers use Node `>=22.6` (`devEngines`).

## Server Components and `"use client"`

Most interactive kit components declare `"use client"` at the top of the source
file. These candidates were scanned and do **not** declare `"use client"`, so
they can render as Server Components when their imports stay server-safe:

- `badge`
- `button`
- `choice-chip`
- `empty-state`
- `featured-icon`
- `overlay-hint`
- `panel-section`
- `skeleton`
- `spectrum-text`
- `status-dot`

Among the same candidate set, these **do** declare `"use client"` and are not
server-safe entry points: `chart`, `kbd`, `progress`, `spinner`.

## Contributing

Setup, architecture, the token rules, and the release process are in
[CONTRIBUTING.md](./CONTRIBUTING.md). Participation is covered by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

To report a vulnerability, follow [SECURITY.md](./SECURITY.md) rather than
opening a public issue.

## License

Licensed under the MIT license.
