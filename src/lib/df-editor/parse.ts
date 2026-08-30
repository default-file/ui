import {
  createCodeBlock,
  createDivider,
  createHeading,
  createParagraph,
  createRawBlock,
  createText,
  emptyDoc,
  marksEqual,
  type BlockNode,
  type BulletListBlock,
  type EditorDoc,
  type InlineNode,
  type ListItemNode,
  type OrderedListBlock,
  type TaskItemNode,
  type TaskListBlock,
  type TextInline,
} from "./ast"
import { sanitizeHref } from "./url"

const HEADING_RE = /^(#{1,3})[ \t]+(.*)$/
const BULLET_RE = /^([ \t]*)([-*+])[ \t]+(.*)$/
const ORDERED_RE = /^([ \t]*)(\d+)\.[ \t]+(.*)$/
const TASK_RE = /^([ \t]*)([-*+])[ \t]+\[([ xX])\][ \t]+(.*)$/
const BLOCKQUOTE_RE = /^>[ \t]?(.*)$/
/** Opening fence: 3 or more backticks, optional info string. */
const FENCE_OPEN_RE = /^(`{3,})([\w-]*)[ \t]*$/
/** Closing fence candidate: 3 or more backticks, no info string. */
const FENCE_CLOSE_RE = /^(`{3,})[ \t]*$/
const DIVIDER_RE = /^(?:-{3,}|\*{3,}|_{3,})[ \t]*$/
const TABLE_LINE_RE = /^\s*\|.*\|\s*$/
const TABLE_ALIGN_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/
const HTML_BLOCK_RE = /^\s*<\/?[a-zA-Z][\w:-]*[\s>]/
const FOOTNOTE_DEF_RE = /^\[\^[^\]]+\]:/
const LINK_DEF_RE = /^\[[^\]]+\]:\s+\S+/

function unescapeText(value: string): string {
  return value.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1")
}

function mergeInlines(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = []
  for (const node of nodes) {
    if (node.type === "link") {
      out.push({
        type: "link",
        href: node.href,
        children: mergeInlines(node.children) as TextInline[],
      })
      continue
    }
    const last = out[out.length - 1]
    if (last && last.type === "text" && marksEqual(last, node)) {
      last.text += node.text
    } else {
      out.push({ ...node })
    }
  }
  return out.length ? out : [createText("")]
}

function applyMarks(nodes: InlineNode[], marks: Partial<TextInline>): InlineNode[] {
  return nodes.map((node) => {
    if (node.type === "link") {
      return {
        type: "link" as const,
        href: node.href,
        children: applyMarks(node.children, marks) as TextInline[],
      }
    }
    return createText(node.text, {
      bold: marks.bold || node.bold,
      italic: marks.italic || node.italic,
      code: marks.code || node.code,
      strikethrough: marks.strikethrough || node.strikethrough,
    })
  })
}

/**
 * Parse an inline code span starting at `start`.
 * Opening run of N backticks closes at the next run of exactly N backticks.
 * Content is preserved verbatim; a single leading and trailing space is trimmed
 * when content both starts and ends with a space and is not all spaces.
 */
function parseInlineCodeSpan(
  input: string,
  start: number
): { text: string; end: number } | null {
  if (input[start] !== "`") return null
  let openLen = 0
  while (start + openLen < input.length && input[start + openLen] === "`") {
    openLen += 1
  }
  if (openLen === 0) return null

  let i = start + openLen
  while (i < input.length) {
    if (input[i] !== "`") {
      i += 1
      continue
    }
    let closeLen = 0
    while (i + closeLen < input.length && input[i + closeLen] === "`") {
      closeLen += 1
    }
    if (closeLen === openLen) {
      let content = input.slice(start + openLen, i)
      if (
        content.length >= 2 &&
        content.startsWith(" ") &&
        content.endsWith(" ") &&
        content.trim() !== ""
      ) {
        content = content.slice(1, -1)
      }
      return { text: content, end: i + closeLen }
    }
    i += closeLen
  }
  return null
}

function parseFenceOpen(
  line: string
): { length: number; language: string } | null {
  const match = FENCE_OPEN_RE.exec(line)
  if (!match) return null
  return { length: match[1]!.length, language: match[2] ?? "" }
}

function isFenceClose(line: string, openLength: number): boolean {
  const match = FENCE_CLOSE_RE.exec(line)
  if (!match) return false
  return match[1]!.length >= openLength
}

function parseInlines(input: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let i = 0

  const pushPlain = (text: string) => {
    if (!text) return
    nodes.push(createText(text))
  }

  while (i < input.length) {
    if (input[i] === "\\" && i + 1 < input.length) {
      pushPlain(input[i + 1]!)
      i += 2
      continue
    }

    if (input[i] === "`") {
      const span = parseInlineCodeSpan(input, i)
      if (span) {
        nodes.push(createText(span.text, { code: true }))
        i = span.end
        continue
      }
    }

    if (input.startsWith("~~", i)) {
      const end = input.indexOf("~~", i + 2)
      if (end !== -1) {
        nodes.push(
          ...applyMarks(parseInlines(input.slice(i + 2, end)), {
            strikethrough: true,
          })
        )
        i = end + 2
        continue
      }
    }

    if (input.startsWith("***", i)) {
      const end = input.indexOf("***", i + 3)
      if (end !== -1) {
        nodes.push(
          ...applyMarks(parseInlines(input.slice(i + 3, end)), {
            bold: true,
            italic: true,
          })
        )
        i = end + 3
        continue
      }
    }

    if (input.startsWith("**", i)) {
      const end = input.indexOf("**", i + 2)
      if (end !== -1) {
        nodes.push(
          ...applyMarks(parseInlines(input.slice(i + 2, end)), { bold: true })
        )
        i = end + 2
        continue
      }
    }

    if (input[i] === "*" && input[i + 1] !== "*") {
      let end = -1
      for (let j = i + 1; j < input.length; j += 1) {
        if (input[j] === "\\") {
          j += 1
          continue
        }
        if (input[j] === "*" && input[j + 1] !== "*") {
          end = j
          break
        }
      }
      if (end !== -1) {
        nodes.push(
          ...applyMarks(parseInlines(input.slice(i + 1, end)), { italic: true })
        )
        i = end + 1
        continue
      }
    }

    if (input[i] === "_" && input[i + 1] !== "_") {
      let end = -1
      for (let j = i + 1; j < input.length; j += 1) {
        if (input[j] === "\\") {
          j += 1
          continue
        }
        if (input[j] === "_" && input[j + 1] !== "_") {
          end = j
          break
        }
      }
      if (end !== -1) {
        nodes.push(
          ...applyMarks(parseInlines(input.slice(i + 1, end)), { italic: true })
        )
        i = end + 1
        continue
      }
    }

    if (input[i] === "[") {
      const labelEnd = input.indexOf("]", i + 1)
      if (labelEnd !== -1 && input[labelEnd + 1] === "(") {
        const hrefEnd = findClosingParen(input, labelEnd + 2)
        if (hrefEnd !== -1) {
          const label = unescapeText(input.slice(i + 1, labelEnd))
          const hrefRaw = input.slice(labelEnd + 2, hrefEnd).trim()
          const hrefOnly =
            hrefRaw.replace(/^<([^>]+)>$/, "$1").split(/\s+/)[0] ?? ""
          const href = sanitizeHref(hrefOnly)
          if (href) {
            nodes.push({
              type: "link",
              href,
              children: [createText(label)],
            })
          } else {
            pushPlain(input.slice(i, hrefEnd + 1))
          }
          i = hrefEnd + 1
          continue
        }
      }
    }

    pushPlain(input[i]!)
    i += 1
  }

  return mergeInlines(nodes)
}

function findClosingParen(input: string, from: number): number {
  let depth = 1
  for (let i = from; i < input.length; i += 1) {
    if (input[i] === "\\") {
      i += 1
      continue
    }
    if (input[i] === "(") depth += 1
    else if (input[i] === ")") {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function isBlank(line: string): boolean {
  return line.trim() === ""
}

function looksUnsupported(line: string): boolean {
  return (
    TABLE_LINE_RE.test(line) ||
    TABLE_ALIGN_RE.test(line) ||
    HTML_BLOCK_RE.test(line) ||
    FOOTNOTE_DEF_RE.test(line) ||
    LINK_DEF_RE.test(line)
  )
}

function collectRaw(
  lines: string[],
  start: number
): { block: BlockNode; next: number } {
  const chunk: string[] = [lines[start]!]
  let i = start + 1
  if (TABLE_LINE_RE.test(lines[start]!) || TABLE_ALIGN_RE.test(lines[start]!)) {
    while (
      i < lines.length &&
      (TABLE_LINE_RE.test(lines[i]!) || TABLE_ALIGN_RE.test(lines[i]!))
    ) {
      chunk.push(lines[i]!)
      i += 1
    }
  } else if (HTML_BLOCK_RE.test(lines[start]!)) {
    while (i < lines.length && !isBlank(lines[i]!)) {
      chunk.push(lines[i]!)
      i += 1
    }
  } else {
    while (i < lines.length && !isBlank(lines[i]!)) {
      chunk.push(lines[i]!)
      i += 1
    }
  }
  return { block: createRawBlock(chunk.join("\n")), next: i }
}

function lineStartsFence(line: string): boolean {
  return parseFenceOpen(line) !== null
}

/**
 * Parse a markdown string into the editor AST.
 * Supported constructs become typed blocks; tables, HTML, and footnotes become raw blocks.
 */
export function parseMarkdown(source: string): EditorDoc {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (normalized.trim() === "") return emptyDoc()

  const lines = normalized.split("\n")
  // Drop a single trailing empty line from split of trailing newline.
  if (lines.length && lines[lines.length - 1] === "") lines.pop()

  const blocks: BlockNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    if (isBlank(line)) {
      i += 1
      continue
    }

    const fenceOpen = parseFenceOpen(line)
    if (fenceOpen) {
      const body: string[] = []
      i += 1
      while (i < lines.length) {
        if (isFenceClose(lines[i]!, fenceOpen.length)) {
          i += 1
          break
        }
        body.push(lines[i]!)
        i += 1
      }
      // Unterminated fence consumes remaining lines into the body; no phantom blocks.
      blocks.push(createCodeBlock(body.join("\n"), fenceOpen.language))
      continue
    }

    if (looksUnsupported(line)) {
      const raw = collectRaw(lines, i)
      blocks.push(raw.block)
      i = raw.next
      continue
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push(createDivider())
      i += 1
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      const level = heading[1]!.length as 1 | 2 | 3
      blocks.push(createHeading(level, parseInlines(heading[2] ?? "")))
      i += 1
      continue
    }

    const quote = BLOCKQUOTE_RE.exec(line)
    if (quote) {
      const parts: string[] = [quote[1] ?? ""]
      i += 1
      while (i < lines.length) {
        const next = BLOCKQUOTE_RE.exec(lines[i]!)
        if (!next) break
        parts.push(next[1] ?? "")
        i += 1
      }
      blocks.push({
        type: "blockquote",
        children: parseInlines(parts.join(" ")),
      })
      continue
    }

    const task = TASK_RE.exec(line)
    if (task) {
      const items: TaskItemNode[] = [
        {
          type: "task_item",
          checked: task[3]!.toLowerCase() === "x",
          children: parseInlines(task[4] ?? ""),
        },
      ]
      i += 1
      while (i < lines.length) {
        const next = TASK_RE.exec(lines[i]!)
        if (!next) break
        items.push({
          type: "task_item",
          checked: next[3]!.toLowerCase() === "x",
          children: parseInlines(next[4] ?? ""),
        })
        i += 1
      }
      const list: TaskListBlock = { type: "task_list", items }
      blocks.push(list)
      continue
    }

    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      const items: ListItemNode[] = [
        { type: "list_item", children: parseInlines(bullet[3] ?? "") },
      ]
      i += 1
      while (i < lines.length) {
        if (TASK_RE.test(lines[i]!)) break
        const next = BULLET_RE.exec(lines[i]!)
        if (!next) break
        items.push({
          type: "list_item",
          children: parseInlines(next[3] ?? ""),
        })
        i += 1
      }
      const list: BulletListBlock = { type: "bullet_list", items }
      blocks.push(list)
      continue
    }

    const ordered = ORDERED_RE.exec(line)
    if (ordered) {
      const items: ListItemNode[] = [
        { type: "list_item", children: parseInlines(ordered[3] ?? "") },
      ]
      i += 1
      while (i < lines.length) {
        const next = ORDERED_RE.exec(lines[i]!)
        if (!next) break
        items.push({
          type: "list_item",
          children: parseInlines(next[3] ?? ""),
        })
        i += 1
      }
      const list: OrderedListBlock = { type: "ordered_list", items }
      blocks.push(list)
      continue
    }

    const paraLines: string[] = [line]
    i += 1
    while (i < lines.length) {
      const next = lines[i]!
      if (isBlank(next)) break
      if (
        lineStartsFence(next) ||
        DIVIDER_RE.test(next) ||
        HEADING_RE.test(next) ||
        BLOCKQUOTE_RE.test(next) ||
        TASK_RE.test(next) ||
        BULLET_RE.test(next) ||
        ORDERED_RE.test(next) ||
        looksUnsupported(next)
      ) {
        break
      }
      paraLines.push(next)
      i += 1
    }
    blocks.push(createParagraph(parseInlines(paraLines.join(" "))))
  }

  if (blocks.length === 0) return emptyDoc()
  return { type: "doc", blocks }
}
