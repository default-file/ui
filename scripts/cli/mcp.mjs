import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { addCommand } from "./add.mjs"
import {
  checkCoverage,
  getDocs,
  kitSummary,
  listComponents,
  listTokens,
  searchKit,
  showComponent,
} from "./discover.mjs"
import { initCommand } from "./init.mjs"
import { kitVersion } from "./kit-root.mjs"
import { installSkill, listSkills, showSkill } from "./skills.mjs"

function jsonResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error)
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  }
}

async function captureCommand(fn) {
  const logs = []
  const original = console.log
  console.log = (...args) => {
    logs.push(args.map(String).join(" "))
  }
  try {
    await fn()
    return { ok: true, output: logs.join("\n").trim() }
  } catch (error) {
    return {
      ok: false,
      output: logs.join("\n").trim(),
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    console.log = original
  }
}

export async function startMcpServer() {
  const summary = kitSummary()
  const server = new McpServer({
    name: "default-file-ui",
    version: kitVersion(),
  })

  server.registerTool(
    "list_components",
    {
      title: "List components",
      description:
        "List Default File UI registry items (components, color-system, and foundation). Includes chapter, description, and documented prop counts.",
      inputSchema: {
        type: z
          .enum(["ui", "style", "registry:ui", "registry:style"])
          .optional()
          .describe("Filter by registry type"),
        chapter: z
          .enum([
            "actions",
            "inputs",
            "feedback",
            "overlays",
            "structure",
            "text",
            "toolbars",
            "chrome",
            "foundation",
            "color-system",
          ])
          .optional()
          .describe(
            "Filter by catalogue chapter. chrome resolves to toolbars."
          ),
      },
    },
    async ({ type, chapter }) => {
      try {
        const normalized = type
          ? type.startsWith("registry:")
            ? type
            : `registry:${type}`
          : undefined
        const items = listComponents({ type: normalized, chapter }).map((item) => ({
          name: item.name,
          type: item.type,
          title: item.title,
          chapter: item.chapter,
          description: item.description,
          aliases: item.aliases ?? [],
          propCount: item.propCount,
          importPath: item.importPath,
          registryDependencies: item.registryDependencies,
        }))
        return jsonResult({ summary, items })
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "get_component",
    {
      title: "Get component",
      description:
        "Get one registry item with files, dependencies, import path, aliases, and full prop API tables when available. Exact aliases resolve; shared aliases return every match.",
      inputSchema: {
        name: z
          .string()
          .describe("Registry item name or exact alias, e.g. button, tic slider, drawer"),
      },
    },
    async ({ name }) => {
      try {
        const detail = showComponent(name)
        if (!detail) {
          return errorResult(
            new Error(`Unknown registry item "${name}". Call list_components or search_kit.`)
          )
        }
        return jsonResult(detail)
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "list_tokens",
    {
      title: "List tokens",
      description:
        "List design tokens from Default File UI CSS (color scales, semantic colors, radius, type, spacing, motion, and more).",
      inputSchema: {
        group: z
          .string()
          .optional()
          .describe(
            "Optional group filter, e.g. color-scale, semantic-color, radius, typography"
          ),
        includeTokens: z
          .boolean()
          .optional()
          .describe(
            "When true, include full token name arrays for every group. Prefer setting group instead."
          ),
      },
    },
    async ({ group, includeTokens }) => {
      try {
        return jsonResult(listTokens({ group, includeTokens }))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "search_kit",
    {
      title: "Search kit",
      description:
        "Search registry names, titles, aliases, descriptions, and capability tags. Exact alias matches score like registry names.",
      inputSchema: {
        query: z.string().describe("Search query or exact alias"),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    async ({ query, limit }) => {
      try {
        return jsonResult({
          query,
          results: searchKit(query, { limit: limit ?? 20 }),
        })
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "check_coverage",
    {
      title: "Check coverage",
      description:
        "Assess whether Default File UI covers a requested UI surface. Returns status covered, partial, or gap, plus matched items and gaps.",
      inputSchema: {
        need: z
          .string()
          .describe(
            "Description of the UI need, e.g. settings form with select, switch, and toast"
          ),
      },
    },
    async ({ need }) => {
      try {
        return jsonResult(checkCoverage(need))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "get_docs",
    {
      title: "Get docs",
      description:
        "Read Default File UI guidance: overview, install, colors, mcp, tokens, foundation, or skills.",
      inputSchema: {
        topic: z
          .enum([
            "overview",
            "install",
            "colors",
            "mcp",
            "tokens",
            "foundation",
            "skills",
          ])
          .optional()
          .describe("Docs topic"),
      },
    },
    async ({ topic }) => {
      try {
        return jsonResult(getDocs(topic ?? "overview"))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "list_skills",
    {
      title: "List skills",
      description:
        "List Agent Skills bundled with Default File UI (name and description).",
      inputSchema: {},
    },
    async () => {
      try {
        return jsonResult({ skills: listSkills() })
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "get_skill",
    {
      title: "Get skill",
      description:
        "Read a bundled Agent Skill: SKILL.md markdown and reference file list.",
      inputSchema: {
        name: z.string().describe('Skill name, e.g. "design-file-ui"'),
      },
    },
    async ({ name }) => {
      try {
        const detail = showSkill(name)
        return jsonResult({
          name: detail.name,
          directory: detail.directory,
          description: detail.description,
          path: detail.path,
          skillMarkdown: detail.skillMarkdown,
          references: detail.references,
        })
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "install_skill",
    {
      title: "Install skill",
      description:
        "Copy a bundled Agent Skill into .agents/skills and .cursor/skills. Prefer an explicit cwd. This writes files.",
      inputSchema: {
        name: z.string().describe('Skill name, e.g. "design-file-ui"'),
        cwd: z
          .string()
          .optional()
          .describe("Project directory (default: process cwd)"),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ name, cwd }) => {
      try {
        return jsonResult(installSkill(name, { cwd: cwd || process.cwd() }))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "init_project",
    {
      title: "Init project",
      description:
        "Scaffold or configure a React app with Default File UI (writes df.json). Prefer an explicit cwd. This writes files.",
      inputSchema: {
        cwd: z
          .string()
          .optional()
          .describe("Project directory (default: process cwd)"),
        template: z
          .enum([
            "next",
            "vite",
            "react-router",
            "tanstack-start",
            "astro",
            "react",
          ])
          .optional()
          .describe("Scaffold template (-t)"),
        name: z.string().optional().describe("New project folder name"),
        framework: z.string().optional().describe("Framework for existing apps"),
        colorScale: z.enum(["detailed", "compact"]).optional(),
        radius: z.string().optional(),
        cornerShape: z.enum(["round", "smooth"]).optional(),
        hoverBorder: z.enum(["on", "off"]).optional(),
        installMode: z.enum(["package", "registry"]).optional(),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async (args) => {
      try {
        const argv = []
        if (args.cwd) argv.push("--cwd", args.cwd)
        if (args.template) argv.push("-t", args.template)
        if (args.name) argv.push("--name", args.name)
        if (args.framework) argv.push("--framework", args.framework)
        if (args.colorScale) argv.push("--color-scale", args.colorScale)
        if (args.radius) argv.push("--radius", args.radius)
        if (args.cornerShape) argv.push("--corner-shape", args.cornerShape)
        if (args.hoverBorder) argv.push("--hover-border", args.hoverBorder)
        if (args.installMode) argv.push("--install-mode", args.installMode)
        const result = await captureCommand(() => initCommand(argv))
        return jsonResult(result)
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.registerTool(
    "add_components",
    {
      title: "Add components",
      description:
        "Copy registry items into a project with dependency resolution (df-ui add). Existing local files are kept unless force is true. Prefer an explicit cwd.",
      inputSchema: {
        names: z
          .array(z.string())
          .min(1)
          .describe("Registry item names, e.g. [\"button\", \"select\"]"),
        cwd: z
          .string()
          .optional()
          .describe("Project directory (default: process cwd)"),
        dir: z.string().optional().describe("Base directory override"),
        force: z
          .boolean()
          .optional()
          .describe(
            "Replace existing local files. Default false so customizations stay intact."
          ),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ names, cwd, dir, force }) => {
      try {
        const argv = [...names]
        if (force) argv.push("--force")
        if (cwd) argv.push("--cwd", cwd)
        if (dir) argv.push("--dir", dir)
        const result = await captureCommand(() => addCommand(argv))
        return jsonResult(result)
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
