import {
  plainTextFromInlines,
  type BlockNode,
  type EditorDoc,
  type InlineNode,
  type MarkType,
  type TextInline,
} from "./ast"

function escapeText(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1")
}

/** Longest consecutive backtick run in `value`. */
export function maxBacktickRun(value: string): number {
  let max = 0
  let run = 0
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "`") {
      run += 1
      if (run > max) max = run
    } else {
      run = 0
    }
  }
  return max
}

/**
 * Fence length for a code block: at least 3, and longer than any backtick run in the body.
 */
export function codeBlockFenceLength(body: string): number {
  return Math.max(3, maxBacktickRun(body) + 1)
}

/**
 * Fence length for an inline code span: longer than any backtick run in the content (min 1).
 */
export function inlineCodeFenceLength(content: string): number {
  return Math.max(1, maxBacktickRun(content) + 1)
}

function serializeInlineCode(content: string): string {
  const fence = "`".repeat(inlineCodeFenceLength(content))
  // Pad with one space when content would confuse the fence or needs space preservation.
  const needsPad =
    content.length === 0 ||
    content.startsWith("`") ||
    content.endsWith("`") ||
    content.startsWith(" ") ||
    content.endsWith(" ")
  const body = needsPad ? ` ${content} ` : content
  return `${fence}${body}${fence}`
}

type FlatSeg = {
  text: string
  bold: boolean
  italic: boolean
  code: boolean
  strikethrough: boolean
  linkHref?: string | undefined
}

function flatten(nodes: readonly InlineNode[]): FlatSeg[] {
  const segs: FlatSeg[] = []
  for (const node of nodes) {
    if (node.type === "link") {
      for (const child of node.children) {
        segs.push({
          text: child.text,
          bold: child.bold === true,
          italic: child.italic === true,
          code: child.code === true,
          strikethrough: child.strikethrough === true,
          linkHref: node.href,
        })
      }
      continue
    }
    segs.push({
      text: node.text,
      bold: node.bold === true,
      italic: node.italic === true,
      code: node.code === true,
      strikethrough: node.strikethrough === true,
    })
  }
  return segs
}

/** Outer to inner mark order for delimiter emission. Italic uses `_` to avoid `*`/`**` collisions. */
const MARK_ORDER: MarkType[] = ["strikethrough", "bold", "italic"]

function openMark(mark: MarkType): string {
  if (mark === "strikethrough") return "~~"
  if (mark === "bold") return "**"
  return "_"
}

function closeMark(mark: MarkType): string {
  return openMark(mark)
}

/**
 * Serialize inline nodes with a mark delimiter state machine so adjacent runs
 * sharing bold/italic do not emit colliding `**`/`*` sequences.
 */
function serializeInlines(nodes: readonly InlineNode[]): string {
  const segs = flatten(nodes)
  if (segs.length === 0) return ""

  let out = ""
  let i = 0
  const active: Partial<Record<MarkType, boolean>> = {}

  const closeDownTo = (keep: Partial<Record<MarkType, boolean>>) => {
    for (let m = MARK_ORDER.length - 1; m >= 0; m -= 1) {
      const mark = MARK_ORDER[m]!
      if (active[mark] && !keep[mark]) {
        out += closeMark(mark)
        active[mark] = false
      }
    }
  }

  const openUpTo = (target: Partial<Record<MarkType, boolean>>) => {
    for (const mark of MARK_ORDER) {
      if (target[mark] && !active[mark]) {
        out += openMark(mark)
        active[mark] = true
      }
    }
  }

  while (i < segs.length) {
    const seg = segs[i]!

    if (seg.linkHref) {
      closeDownTo({})
      const labelParts: TextInline[] = []
      const href = seg.linkHref
      while (i < segs.length && segs[i]!.linkHref === href) {
        const s = segs[i]!
        labelParts.push({
          type: "text",
          text: s.text,
          bold: s.bold || undefined,
          italic: s.italic || undefined,
          code: s.code || undefined,
          strikethrough: s.strikethrough || undefined,
        })
        i += 1
      }
      const label = plainTextFromInlines(labelParts)
      out += `[${escapeText(label)}](${href})`
      continue
    }

    if (seg.code) {
      closeDownTo({
        strikethrough: seg.strikethrough,
        bold: seg.bold,
        italic: seg.italic,
      })
      openUpTo({
        strikethrough: seg.strikethrough,
        bold: seg.bold,
        italic: seg.italic,
      })
      out += serializeInlineCode(seg.text)
      i += 1
      continue
    }

    const target = {
      strikethrough: seg.strikethrough,
      bold: seg.bold,
      italic: seg.italic,
    }
    closeDownTo(target)
    openUpTo(target)
    out += escapeText(seg.text)
    i += 1
  }

  closeDownTo({})
  return out
}

function serializeBlock(block: BlockNode): string {
  switch (block.type) {
    case "paragraph":
      return serializeInlines(block.children)
    case "heading":
      return `${"#".repeat(block.level)} ${serializeInlines(block.children)}`
    case "blockquote":
      return `> ${serializeInlines(block.children)}`
    case "code_block": {
      const lang = block.language ?? ""
      const fence = "`".repeat(codeBlockFenceLength(block.value))
      return `${fence}${lang}\n${block.value}\n${fence}`
    }
    case "divider":
      return "---"
    case "bullet_list":
      return block.items
        .map((item) => `- ${serializeInlines(item.children)}`)
        .join("\n")
    case "ordered_list":
      return block.items
        .map((item, index) => `${index + 1}. ${serializeInlines(item.children)}`)
        .join("\n")
    case "task_list":
      return block.items
        .map((item) => {
          const box = item.checked ? "[x]" : "[ ]"
          return `- ${box} ${serializeInlines(item.children)}`
        })
        .join("\n")
    case "raw":
      return block.markdown
  }
}

/**
 * Serialize an editor AST to canonical markdown.
 * Blocks are separated by one blank line. Bullets use `-`. Ordered lists use `1.` style renumbered from 1.
 */
export function serializeMarkdown(doc: EditorDoc): string {
  if (!doc.blocks.length) return "\n"
  const parts = doc.blocks.map(serializeBlock)
  const body = parts.join("\n\n")
  return body.endsWith("\n") ? body : `${body}\n`
}
