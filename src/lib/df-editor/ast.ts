/** Markdown backed AST for df-editor. Public value is always a markdown string. */

export type MarkType = "bold" | "italic" | "code" | "strikethrough"

export type TextInline = {
  type: "text"
  text: string
  bold?: boolean | undefined
  italic?: boolean | undefined
  code?: boolean | undefined
  strikethrough?: boolean | undefined
}

export type LinkInline = {
  type: "link"
  href: string
  children: TextInline[]
}

export type InlineNode = TextInline | LinkInline

export type ListItemNode = {
  type: "list_item"
  children: InlineNode[]
}

export type TaskItemNode = {
  type: "task_item"
  checked: boolean
  children: InlineNode[]
}

export type ParagraphBlock = {
  type: "paragraph"
  children: InlineNode[]
}

export type HeadingBlock = {
  type: "heading"
  level: 1 | 2 | 3
  children: InlineNode[]
}

export type BlockquoteBlock = {
  type: "blockquote"
  children: InlineNode[]
}

export type CodeBlock = {
  type: "code_block"
  language: string
  value: string
}

export type DividerBlock = {
  type: "divider"
}

export type BulletListBlock = {
  type: "bullet_list"
  items: ListItemNode[]
}

export type OrderedListBlock = {
  type: "ordered_list"
  items: ListItemNode[]
}

export type TaskListBlock = {
  type: "task_list"
  items: TaskItemNode[]
}

/** Opaque markdown preserved for unsupported constructs. Never reformatted. */
export type RawBlock = {
  type: "raw"
  markdown: string
}

export type BlockNode =
  | ParagraphBlock
  | HeadingBlock
  | BlockquoteBlock
  | CodeBlock
  | DividerBlock
  | BulletListBlock
  | OrderedListBlock
  | TaskListBlock
  | RawBlock

export type EditorDoc = {
  type: "doc"
  blocks: BlockNode[]
}

/** Path into the document: [blockIndex] or [blockIndex, itemIndex] for list items. */
export type EditorPath = readonly number[]

export type EditorPoint = {
  path: EditorPath
  offset: number
}

export type EditorSelection = {
  anchor: EditorPoint
  focus: EditorPoint
}

export type EditorState = {
  doc: EditorDoc
  selection: EditorSelection
}

export function emptyDoc(): EditorDoc {
  return {
    type: "doc",
    blocks: [createParagraph()],
  }
}

export function createParagraph(children: InlineNode[] = [createText("")]): ParagraphBlock {
  return { type: "paragraph", children: children.length ? children : [createText("")] }
}

export function createHeading(
  level: 1 | 2 | 3,
  children: InlineNode[] = [createText("")]
): HeadingBlock {
  return { type: "heading", level, children: children.length ? children : [createText("")] }
}

export function createBlockquote(
  children: InlineNode[] = [createText("")]
): BlockquoteBlock {
  return { type: "blockquote", children: children.length ? children : [createText("")] }
}

export function createCodeBlock(value = "", language = ""): CodeBlock {
  return { type: "code_block", language, value }
}

export function createDivider(): DividerBlock {
  return { type: "divider" }
}

export function createBulletList(items?: ListItemNode[]): BulletListBlock {
  return {
    type: "bullet_list",
    items: items?.length ? items : [{ type: "list_item", children: [createText("")] }],
  }
}

export function createOrderedList(items?: ListItemNode[]): OrderedListBlock {
  return {
    type: "ordered_list",
    items: items?.length ? items : [{ type: "list_item", children: [createText("")] }],
  }
}

export function createTaskList(items?: TaskItemNode[]): TaskListBlock {
  return {
    type: "task_list",
    items: items?.length
      ? items
      : [{ type: "task_item", checked: false, children: [createText("")] }],
  }
}

export function createRawBlock(markdown: string): RawBlock {
  return { type: "raw", markdown }
}

export type TextMarks = {
  bold?: boolean | undefined
  italic?: boolean | undefined
  code?: boolean | undefined
  strikethrough?: boolean | undefined
}

export function createText(
  text: string,
  marks: TextMarks = {}
): TextInline {
  const node: TextInline = { type: "text", text }
  if (marks.bold) node.bold = true
  if (marks.italic) node.italic = true
  if (marks.code) node.code = true
  if (marks.strikethrough) node.strikethrough = true
  return node
}

export function createLink(href: string, text: string): LinkInline {
  return { type: "link", href, children: [createText(text)] }
}

export function isTextInline(node: InlineNode): node is TextInline {
  return node.type === "text"
}

export function isLinkInline(node: InlineNode): node is LinkInline {
  return node.type === "link"
}

export function isListBlock(
  block: BlockNode
): block is BulletListBlock | OrderedListBlock | TaskListBlock {
  return (
    block.type === "bullet_list" ||
    block.type === "ordered_list" ||
    block.type === "task_list"
  )
}

export function isInlineBlock(
  block: BlockNode
): block is ParagraphBlock | HeadingBlock | BlockquoteBlock {
  return (
    block.type === "paragraph" ||
    block.type === "heading" ||
    block.type === "blockquote"
  )
}

export function collapsedSelection(path: EditorPath, offset: number): EditorSelection {
  const point = { path: [...path], offset }
  return { anchor: point, focus: { ...point, path: [...path] } }
}

export function selectionIsCollapsed(selection: EditorSelection): boolean {
  return (
    pathEquals(selection.anchor.path, selection.focus.path) &&
    selection.anchor.offset === selection.focus.offset
  )
}

export function pathEquals(a: EditorPath, b: EditorPath): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function comparePoints(a: EditorPoint, b: EditorPoint): number {
  const len = Math.max(a.path.length, b.path.length)
  for (let i = 0; i < len; i += 1) {
    const av = a.path[i] ?? -1
    const bv = b.path[i] ?? -1
    if (av !== bv) return av < bv ? -1 : 1
  }
  if (a.offset !== b.offset) return a.offset < b.offset ? -1 : 1
  return 0
}

export function normalizeSelection(selection: EditorSelection): {
  start: EditorPoint
  end: EditorPoint
  isCollapsed: boolean
} {
  const cmp = comparePoints(selection.anchor, selection.focus)
  if (cmp <= 0) {
    return {
      start: selection.anchor,
      end: selection.focus,
      isCollapsed: cmp === 0,
    }
  }
  return {
    start: selection.focus,
    end: selection.anchor,
    isCollapsed: false,
  }
}

export function plainTextFromInlines(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "link") return plainTextFromInlines(node.children)
      return node.text
    })
    .join("")
}

export function hasMark(node: TextInline, mark: MarkType): boolean {
  if (mark === "bold") return node.bold === true
  if (mark === "italic") return node.italic === true
  if (mark === "code") return node.code === true
  return node.strikethrough === true
}

export function withMark(node: TextInline, mark: MarkType, on: boolean): TextInline {
  const next: TextInline = { type: "text", text: node.text }
  const bold = mark === "bold" ? on : node.bold === true
  const italic = mark === "italic" ? on : node.italic === true
  const code = mark === "code" ? on : node.code === true
  const strikethrough = mark === "strikethrough" ? on : node.strikethrough === true
  if (bold) next.bold = true
  if (italic) next.italic = true
  if (code) next.code = true
  if (strikethrough) next.strikethrough = true
  return next
}

export function marksEqual(a: TextInline, b: TextInline): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.code === b.code &&
    a.strikethrough === b.strikethrough
  )
}
