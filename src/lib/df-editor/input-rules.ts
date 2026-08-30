import {
  normalizeSelection,
  plainTextFromInlines,
  type EditorState,
} from "./ast"
import { setBlockType, type BlockTypeName } from "./transforms"

export type InputRuleResult = {
  state: EditorState
} | null

type Rule = {
  match: RegExp
  type: BlockTypeName
  level?: 1 | 2 | 3
}

const SPACE_RULES: Rule[] = [
  { match: /^###$/, type: "heading", level: 3 },
  { match: /^##$/, type: "heading", level: 2 },
  { match: /^#$/, type: "heading", level: 1 },
  { match: /^>$/, type: "blockquote" },
  { match: /^-$/, type: "bullet_list" },
  { match: /^\*$/, type: "bullet_list" },
  { match: /^\+$/, type: "bullet_list" },
  { match: /^1\.$/, type: "ordered_list" },
  { match: /^```$/, type: "code_block" },
  { match: /^---$/, type: "divider" },
  { match: /^\*\*\*$/, type: "divider" },
  { match: /^[-*+] \[[ xX]\]$/, type: "task_list" },
]

/**
 * Match markdown autoformat prefixes at the start of the current paragraph.
 * Invoke after inserting a trailing space (or newline for a paragraph that is only a fence).
 */
export function matchInputRule(
  state: EditorState,
  insertedText: string
): InputRuleResult {
  if (insertedText !== " " && insertedText !== "\n") return null
  const { start, isCollapsed } = normalizeSelection(state.selection)
  if (!isCollapsed) return null

  const blockIndex = start.path[0]
  if (blockIndex === undefined) return null
  const block = state.doc.blocks[blockIndex]
  if (!block || block.type !== "paragraph") return null
  if (start.path.length !== 1) return null

  const plain = plainTextFromInlines(block.children)

  if (insertedText === "\n") {
    if (plain === "```") {
      const without = deletePrefix(state, plain.length)
      return { state: setBlockType(without, "code_block") }
    }
    return null
  }

  if (start.offset < 1) return null
  const before = plain.slice(0, start.offset)
  if (!before.endsWith(" ")) return null
  const token = before.slice(0, -1)
  if (token.includes("\n")) return null

  for (const rule of SPACE_RULES) {
    if (!rule.match.test(token)) continue
    const without = deletePrefix(state, token.length + 1)
    return {
      state: setBlockType(without, rule.type, { level: rule.level }),
    }
  }

  return null
}

function deletePrefix(state: EditorState, count: number): EditorState {
  if (count <= 0) return state
  const { start } = normalizeSelection(state.selection)
  const blockIndex = start.path[0]!
  const block = state.doc.blocks[blockIndex]
  if (!block || block.type !== "paragraph") return state
  const plain = plainTextFromInlines(block.children)
  const from = Math.max(0, start.offset - count)
  const to = start.offset
  const nextText = plain.slice(0, from) + plain.slice(to)
  const doc = structuredClone(state.doc)
  const paragraph = doc.blocks[blockIndex]!
  if (paragraph.type !== "paragraph") return state
  paragraph.children = [{ type: "text", text: nextText }]
  return {
    doc,
    selection: {
      anchor: { path: [blockIndex], offset: from },
      focus: { path: [blockIndex], offset: from },
    },
  }
}

/** Apply an input rule after text insertion. Returns the transformed state or the original. */
export function applyInputRule(
  state: EditorState,
  insertedText: string
): EditorState {
  const matched = matchInputRule(state, insertedText)
  return matched ? matched.state : state
}
