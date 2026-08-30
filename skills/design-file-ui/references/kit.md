# Default File UI kit usage

Use this playbook when the project includes Default File UI. Discover live registry data; do not paste a stale catalog from memory or recreate covered controls by hand.

## Detect the kit

Treat Default File UI as present when any of these are true:

- `@default-file/ui` appears in `package.json` dependencies or the app imports from `@default-file/ui/...`
- The app imports kit CSS (`df-color-system.css` or `df-index.css`)
- `df.json` exists (copy source or CLI project config)
- `df-ui` CLI or the Default File UI MCP server is available

If none apply, skip this file and use the agnostic implementation path in `SKILL.md`.

## Color system

Use without components when the surface only needs kit styling:

- Package: `@import "@default-file/ui/css/df-color-system.css";`
- Copy source: `df-ui add color-system`
- Docs: `df-ui docs colors` or MCP `get_docs` topic `colors`

Contents: color scales, semantic tokens, and utilities. Full kit CSS (`df-index.css`) and components resolve this through foundation.

## Discover before you invent

Preferred order (CLI or matching MCP tools):

1. **Coverage:** `df-ui cover "<UI need>"` / MCP `check_coverage`
2. **Search:** `df-ui search <keyword>` / `search_kit`
3. **Component detail:** `df-ui show <name>` / `get_component` (props, defaults, import path, files, deps)
4. **Tokens:** `df-ui tokens` / `list_tokens` for chrome values (color, space, type, radius, motion)
5. **Docs:** `df-ui docs colors` or `foundation` (or `install` / `tokens`) / MCP `get_docs` when CSS entry or packaging is unclear

Optional inventory: `df-ui list` / `list_components`.

Map each section of the UI to registry items before writing new chrome. Prefer `covered` or `partial` matches from `cover` over custom controls.

Catalogue `aliases` are prepared with the docs (curated labels plus title, slug, and registry name forms). Prefer exact alias or registry-name matches from `search` / `search_kit`. Read prefer-language in descriptions: for example Popover vs Options Panel, Slider vs Number Slider vs Tick Slider, Switch vs Toggle Group. When several components share an alias or a family hint, present every option.

## Compose rules

- Prefer registry components for interactive chrome (buttons, inputs, selects, dialogs, menus, toasts, and similar).
- Theme UI chrome with semantic utilities and `var(--...)` tokens from the kit. Do not hardcode design literals for surfaces, type sizes, radii, borders, or shadows.
- Color and space with the kit color system (`df-color-system.css` or full `df-index.css`) and kit tokens only.
- In package mode, import from `@default-file/ui/components/df-*` and ensure kit CSS is loaded (`df-index.css`, or `df-color-system.css` when components are not used).
- In copy source mode, install missing items with `df-ui add <items>` or MCP `add_components` before recreating them by hand. Existing local files are kept unless the user asks to upgrade with `--force` or `force: true`.
- Keep composition and hierarchy decisions from `SKILL.md` for the classified surface mode. The kit supplies parts; it does not replace mode routing, marketing hero rules, workspace shell rules, or critique contracts.
- For workspace needs, discover tables, inputs, selects, dialogs, menus, sheets, and related registry items before inventing data or form chrome.

## Import pattern

```ts
import { Button } from "@default-file/ui/components/df-button"
```

Use the `importPath` from `df-ui show <name>` when unsure. Respect registry dependencies returned by `show` / `get_component`.

## Anti goals

- Hardcoded hex, px, rem, or raw shadows for kit chrome
- Styling kit surfaces with an external utility palette instead of the kit color system
- Hand-rolling controls that already exist in the registry
- Skipping discovery and guessing prop names or variants from memory
