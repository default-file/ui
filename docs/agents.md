# Default File UI for AI agents

Default File UI is a design system: color system, tokens, components, owned CSS, CLI, and MCP.

## Install paths

**Color system** (no components):

- Package CSS: `@import "@default-file/ui/css/df-color-system.css";`
- Copy source: `df-ui add color-system` then import local `default-file-ui/css/df-color-system.css`
- Docs: `df-ui docs colors`

**Full kit** (components + color system):

- Package: `npm install @default-file/ui`
- CSS: `@import "@default-file/ui/css/df-index.css";`
- Components: `import { Button } from "@default-file/ui/components/df-button"`
- Copy source: `df-ui init` then `df-ui add <items>` (resolves `foundation` to `color-system`)

**Ownership:** local copy source files stay in the app. Do not re-add with `--force` unless the user chooses to upgrade those files. Package import updates apply only when the dependency is upgraded. Track versions with `df-ui version`, `df.json` `version`, and `df-ui info`.

**Reproducible adds:** `df-ui add` copies from the installed kit, so the files match `df-ui version`. Pin the CLI version when an install must be repeatable. `df.json` `copied` records each item's kit version. `df-ui upgrade` replaces those files with the current CLI release.

**Copy source init:** `df-ui init --install-mode registry` copies foundation into the app and does not add `@default-file/ui` as a project dependency.

## Discover before you invent

```bash
df-ui list --json
df-ui show button --json
df-ui search select --json
df-ui cover "settings form with select, switch, and toast" --json
df-ui tokens --group color-scale --json
df-ui docs colors
df-ui docs mcp
df-ui docs skills
df-ui skills list --json
df-ui skills install design-file-ui
```

`show` and MCP `get_component` return full prop tables (name, type, default, description) from `docs/api`.

Catalogue `aliases` ship with the kit in `docs/api`: curated labels plus title, slug, and registry name forms. Exact alias matches score like registry names. Shared aliases return every match; do not guess. `show` / `get_component` resolve a unique alias, or return `{ ambiguous, matches }` when several items share it.

The bundled `design-file-ui` skill routes marketing vs workspace vs mobileTool surfaces, and includes `references/kit.md` for discover then compose with these CLI and MCP tools.

Open skills install:

```bash
npx skills add default-file/ui --skill design-file-ui
```

## MCP (stdio)

Works with any host that supports MCP.

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

Local install:

```json
{
  "mcpServers": {
    "default-file-ui": {
      "command": "df-ui",
      "args": ["mcp"]
    }
  }
}
```

### Tools

| Tool | Purpose |
|---|---|
| `list_components` | Registry inventory + prop counts |
| `get_component` | Full props, files, deps, import path |
| `list_tokens` | Token inventory by group |
| `search_kit` | Keyword search |
| `check_coverage` | covered / partial / gap for a UI need |
| `get_docs` | overview, install, colors, mcp, tokens, foundation, skills |
| `list_skills` | Bundled Agent Skills |
| `get_skill` | Full SKILL.md + reference list |
| `install_skill` | Copy skill into `.agents/skills` and `.cursor/skills` |
| `init_project` | Scaffold or configure (writes files) |
| `add_components` | Copy source add (writes files) |
| `upgrade_copied` | Replace copied items with the current CLI release |

Prefer an explicit `cwd` for write tools.
