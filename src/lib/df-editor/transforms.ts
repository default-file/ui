import {
  collapsedSelection,
  createBulletList,
  createCodeBlock,
  createDivider,
  createHeading,
  createOrderedList,
  createParagraph,
  createTaskList,
  createText,
  emptyDoc,
  hasMark,
  isInlineBlock,
  isListBlock,
  marksEqual,
  normalizeSelection,
  pathEquals,
  plainTextFromInlines,
  selectionIsCollapsed,
  withMark,
  type BlockNode,
  type EditorDoc,
  type EditorPath,
  type EditorPoint,
  type EditorSelection,
  type EditorState,
  type InlineNode,
  type ListItemNode,
  type MarkType,
  type TaskItemNode,
  type TextInline,
} from "./ast"
import { sanitizeHref } from "./url"

export type BlockTypeName =
  | "paragraph"
  | "heading"
  | "blockquote"
  | "bullet_list"
  | "ordered_list"
  | "task_list"
  | "code_block"
  | "divider"

export type SetBlockTypeAttrs = {
  level?: 1 | 2 | 3 | undefined
}

function cloneDoc(doc: EditorDoc): EditorDoc {
  return structuredClone(doc)
}

function mergeTextNodes(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = []
  for (const node of nodes) {
    if (node.type === "link") {
      out.push({
        type: "link",
        href: node.href,
        children: mergeTextNodes(node.children) as TextInline[],
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

function flattenInlineSegments(
  nodes: readonly InlineNode[]
): Array<{ text: string; marks: TextInline; linkHref?: string | undefined }> {
  const segs: Array<{
    text: string
    marks: TextInline
    linkHref?: string | undefined
  }> = []
  for (const node of nodes) {
    if (node.type === "link") {
      for (const child of node.children) {
        segs.push({ text: child.text, marks: child, linkHref: node.href })
      }
    } else {
      segs.push({ text: node.text, marks: node })
    }
  }
  return segs
}

function rebuildInlines(
  segs: Array<{
    text: string
    marks: TextInline
    linkHref?: string | undefined
  }>
): InlineNode[] {
  const nodes: InlineNode[] = []
  for (const seg of segs) {
    if (!seg.text && segs.length > 1) continue
    const text = createText(seg.text, {
      bold: seg.marks.bold,
      italic: seg.marks.italic,
      code: seg.marks.code,
      strikethrough: seg.marks.strikethrough,
    })
    if (seg.linkHref) {
      const last = nodes[nodes.length - 1]
      if (last && last.type === "link" && last.href === seg.linkHref) {
        last.children = mergeTextNodes([...last.children, text]) as TextInline[]
      } else {
        nodes.push({ type: "link", href: seg.linkHref, children: [text] })
      }
    } else {
      nodes.push(text)
    }
  }
  return mergeTextNodes(nodes)
}

function getBlock(doc: EditorDoc, path: EditorPath): BlockNode | null {
  const index = path[0]
  if (index === undefined || index < 0 || index >= doc.blocks.length) return null
  return doc.blocks[index]!
}

function getInlineChildren(
  doc: EditorDoc,
  path: EditorPath
): InlineNode[] | null {
  const block = getBlock(doc, path)
  if (!block) return null
  if (isInlineBlock(block)) return block.children
  if (isListBlock(block)) {
    const itemIndex = path[1]
    if (itemIndex === undefined) return null
    const item = block.items[itemIndex]
    if (!item) return null
    return item.children
  }
  return null
}

function setInlineChildren(
  doc: EditorDoc,
  path: EditorPath,
  children: InlineNode[]
): EditorDoc {
  const next = cloneDoc(doc)
  const block = getBlock(next, path)
  if (!block) return doc
  const merged = mergeTextNodes(children)
  if (isInlineBlock(block)) {
    block.children = merged
    return next
  }
  if (isListBlock(block)) {
    const itemIndex = path[1]
    if (itemIndex === undefined) return doc
    const item = block.items[itemIndex]
    if (!item) return doc
    item.children = merged
    return next
  }
  return doc
}

function contentLength(doc: EditorDoc, path: EditorPath): number {
  const block = getBlock(doc, path)
  if (!block) return 0
  if (block.type === "code_block") return block.value.length
  const children = getInlineChildren(doc, path)
  return children ? plainTextFromInlines(children).length : 0
}

function defaultPathForBlock(doc: EditorDoc, blockIndex: number): EditorPath {
  const block = doc.blocks[blockIndex]
  if (!block) return [0]
  if (isListBlock(block)) return [blockIndex, 0]
  return [blockIndex]
}

function sameEditableContainer(a: EditorPath, b: EditorPath): boolean {
  if (a[0] !== b[0]) return false
  const blockPathLen = a.length
  // List items require matching item index.
  if (blockPathLen >= 2 || b.length >= 2) {
    return a[1] === b[1] && a.length === b.length
  }
  return true
}

/**
 * Toggle an inline mark over the current selection.
 * Contract: when the selection spans more than one editable container
 * (different blocks or list items), this returns the input state unchanged.
 */
export function toggleMark(
  state: EditorState,
  mark: MarkType
): EditorState {
  const { start, end, isCollapsed } = normalizeSelection(state.selection)
  if (!sameEditableContainer(start.path, end.path)) return state
  if (getBlock(state.doc, start.path)?.type === "code_block") return state
  if (getBlock(state.doc, start.path)?.type === "raw") return state
  if (getBlock(state.doc, start.path)?.type === "divider") return state

  const children = getInlineChildren(state.doc, start.path)
  if (!children) return state

  const segs = flattenInlineSegments(children)
  const plain = segs.map((s) => s.text).join("")
  const from = Math.max(0, Math.min(start.offset, plain.length))
  const to = Math.max(from, Math.min(end.offset, plain.length))

  if (isCollapsed) {
    // Caret mark toggle requires a range; a collapsed caret leaves state unchanged.
    return state
  }

  let allHave = true
  let offset = 0
  for (const seg of segs) {
    const segEnd = offset + seg.text.length
    const overlapFrom = Math.max(from, offset)
    const overlapTo = Math.min(to, segEnd)
    if (overlapFrom < overlapTo) {
      if (!hasMark(seg.marks, mark)) allHave = false
    }
    offset = segEnd
  }
  const nextOn = !allHave

  const nextSegs: typeof segs = []
  offset = 0
  for (const seg of segs) {
    const segEnd = offset + seg.text.length
    const overlapFrom = Math.max(from, offset)
    const overlapTo = Math.min(to, segEnd)
    if (overlapFrom >= overlapTo) {
      nextSegs.push(seg)
    } else {
      const localFrom = overlapFrom - offset
      const localTo = overlapTo - offset
      if (localFrom > 0) {
        nextSegs.push({
          text: seg.text.slice(0, localFrom),
          marks: seg.marks,
          linkHref: seg.linkHref,
        })
      }
      nextSegs.push({
        text: seg.text.slice(localFrom, localTo),
        marks: withMark(seg.marks, mark, nextOn),
        linkHref: seg.linkHref,
      })
      if (localTo < seg.text.length) {
        nextSegs.push({
          text: seg.text.slice(localTo),
          marks: seg.marks,
          linkHref: seg.linkHref,
        })
      }
    }
    offset = segEnd
  }

  const doc = setInlineChildren(state.doc, start.path, rebuildInlines(nextSegs))
  return {
    doc,
    selection: {
      anchor: { path: [...start.path], offset: from },
      focus: { path: [...end.path], offset: to },
    },
  }
}

export function setLink(state: EditorState, href: string): EditorState {
  const safe = sanitizeHref(href)
  if (!safe) return state
  const { start, end, isCollapsed } = normalizeSelection(state.selection)
  if (!sameEditableContainer(start.path, end.path) || isCollapsed) return state
  const children = getInlineChildren(state.doc, start.path)
  if (!children) return state

  const segs = flattenInlineSegments(children)
  const plain = segs.map((s) => s.text).join("")
  const from = Math.max(0, Math.min(start.offset, plain.length))
  const to = Math.max(from, Math.min(end.offset, plain.length))
  if (from === to) return state

  const nextSegs: typeof segs = []
  let offset = 0
  for (const seg of segs) {
    const segEnd = offset + seg.text.length
    const overlapFrom = Math.max(from, offset)
    const overlapTo = Math.min(to, segEnd)
    if (overlapFrom >= overlapTo) {
      nextSegs.push(seg)
    } else {
      const localFrom = overlapFrom - offset
      const localTo = overlapTo - offset
      if (localFrom > 0) {
        nextSegs.push({
          text: seg.text.slice(0, localFrom),
          marks: seg.marks,
          linkHref: seg.linkHref,
        })
      }
      nextSegs.push({
        text: seg.text.slice(localFrom, localTo),
        marks: seg.marks,
        linkHref: safe,
      })
      if (localTo < seg.text.length) {
        nextSegs.push({
          text: seg.text.slice(localTo),
          marks: seg.marks,
          linkHref: seg.linkHref,
        })
      }
    }
    offset = segEnd
  }

  return {
    doc: setInlineChildren(state.doc, start.path, rebuildInlines(nextSegs)),
    selection: {
      anchor: { path: [...start.path], offset: from },
      focus: { path: [...end.path], offset: to },
    },
  }
}

export function unsetLink(state: EditorState): EditorState {
  const { start, end, isCollapsed } = normalizeSelection(state.selection)
  if (!sameEditableContainer(start.path, end.path) || isCollapsed) return state
  const children = getInlineChildren(state.doc, start.path)
  if (!children) return state
  const segs = flattenInlineSegments(children)
  const plain = segs.map((s) => s.text).join("")
  const from = Math.max(0, Math.min(start.offset, plain.length))
  const to = Math.max(from, Math.min(end.offset, plain.length))
  const nextSegs = segs.map((seg, index, arr) => {
    void index
    void arr
    return seg
  })
  let offset = 0
  const rebuilt: typeof segs = []
  for (const seg of nextSegs) {
    const segEnd = offset + seg.text.length
    const overlapFrom = Math.max(from, offset)
    const overlapTo = Math.min(to, segEnd)
    if (overlapFrom >= overlapTo) {
      rebuilt.push(seg)
    } else {
      const localFrom = overlapFrom - offset
      const localTo = overlapTo - offset
      if (localFrom > 0) {
        rebuilt.push({
          text: seg.text.slice(0, localFrom),
          marks: seg.marks,
          linkHref: seg.linkHref,
        })
      }
      rebuilt.push({
        text: seg.text.slice(localFrom, localTo),
        marks: seg.marks,
      })
      if (localTo < seg.text.length) {
        rebuilt.push({
          text: seg.text.slice(localTo),
          marks: seg.marks,
          linkHref: seg.linkHref,
        })
      }
    }
    offset = segEnd
  }
  return {
    doc: setInlineChildren(state.doc, start.path, rebuildInlines(rebuilt)),
    selection: state.selection,
  }
}

function inlinesFromBlock(block: BlockNode): InlineNode[] {
  if (isInlineBlock(block)) return block.children
  if (isListBlock(block)) {
    return block.items[0]?.children.slice() ?? [createText("")]
  }
  if (block.type === "code_block") return [createText(block.value)]
  return [createText("")]
}

export function setBlockType(
  state: EditorState,
  type: BlockTypeName,
  attrs: SetBlockTypeAttrs = {}
): EditorState {
  const { start } = normalizeSelection(state.selection)
  const blockIndex = start.path[0]
  if (blockIndex === undefined) return state
  const block = state.doc.blocks[blockIndex]
  if (!block || block.type === "raw") return state

  const children = inlinesFromBlock(block)
  let nextBlock: BlockNode
  switch (type) {
    case "paragraph":
      nextBlock = createParagraph(children)
      break
    case "heading":
      nextBlock = createHeading(attrs.level ?? 1, children)
      break
    case "blockquote":
      nextBlock = { type: "blockquote", children }
      break
    case "bullet_list":
      nextBlock = createBulletList([
        { type: "list_item", children },
      ])
      break
    case "ordered_list":
      nextBlock = createOrderedList([
        { type: "list_item", children },
      ])
      break
    case "task_list":
      nextBlock = createTaskList([
        { type: "task_item", checked: false, children },
      ])
      break
    case "code_block":
      nextBlock = createCodeBlock(plainTextFromInlines(children))
      break
    case "divider":
      nextBlock = createDivider()
      break
  }

  const doc = cloneDoc(state.doc)
  doc.blocks[blockIndex] = nextBlock
  const path = defaultPathForBlock(doc, blockIndex)
  const offset = Math.min(start.offset, contentLength(doc, path))
  return { doc, selection: collapsedSelection(path, offset) }
}

export function insertBlock(
  state: EditorState,
  block: BlockNode,
  position: "before" | "after" = "after"
): EditorState {
  const { start } = normalizeSelection(state.selection)
  const index = start.path[0] ?? 0
  const doc = cloneDoc(state.doc)
  const at = position === "before" ? index : index + 1
  doc.blocks.splice(at, 0, structuredClone(block))
  const path = defaultPathForBlock(doc, at)
  return { doc, selection: collapsedSelection(path, 0) }
}

export function insertText(state: EditorState, text: string): EditorState {
  if (!text) return state
  let next = state
  if (!selectionIsCollapsed(state.selection)) {
    next = deleteSelection(state)
  }
  const { start } = normalizeSelection(next.selection)
  const block = getBlock(next.doc, start.path)
  if (!block || block.type === "raw" || block.type === "divider") return next

  if (block.type === "code_block") {
    const doc = cloneDoc(next.doc)
    const code = doc.blocks[start.path[0]!] as typeof block
    const offset = Math.max(0, Math.min(start.offset, code.value.length))
    code.value = code.value.slice(0, offset) + text + code.value.slice(offset)
    return {
      doc,
      selection: collapsedSelection(start.path, offset + text.length),
    }
  }

  const children = getInlineChildren(next.doc, start.path)
  if (!children) return next
  const segs = flattenInlineSegments(children)
  const plain = segs.map((s) => s.text).join("")
  const offset = Math.max(0, Math.min(start.offset, plain.length))

  // Inherit marks from the left neighbor.
  let inherit: TextInline = createText("")
  let linkHref: string | undefined
  let seen = 0
  for (const seg of segs) {
    if (seen + seg.text.length >= offset && offset > seen) {
      inherit = seg.marks
      linkHref = seg.linkHref
      break
    }
    if (seen + seg.text.length === offset) {
      inherit = seg.marks
      linkHref = seg.linkHref
    }
    seen += seg.text.length
  }

  const nextSegs: typeof segs = []
  seen = 0
  let inserted = false
  if (segs.length === 0 || plain.length === 0) {
    nextSegs.push({ text, marks: inherit, linkHref })
    inserted = true
  } else {
    for (const seg of segs) {
      const segEnd = seen + seg.text.length
      if (!inserted && offset <= segEnd) {
        const local = offset - seen
        if (local > 0) {
          nextSegs.push({
            text: seg.text.slice(0, local),
            marks: seg.marks,
            linkHref: seg.linkHref,
          })
        }
        nextSegs.push({ text, marks: inherit, linkHref })
        if (local < seg.text.length) {
          nextSegs.push({
            text: seg.text.slice(local),
            marks: seg.marks,
            linkHref: seg.linkHref,
          })
        }
        inserted = true
      } else {
        nextSegs.push(seg)
      }
      seen = segEnd
    }
    if (!inserted) nextSegs.push({ text, marks: inherit, linkHref })
  }

  return {
    doc: setInlineChildren(next.doc, start.path, rebuildInlines(nextSegs)),
    selection: collapsedSelection(start.path, offset + text.length),
  }
}

export function deleteSelection(state: EditorState): EditorState {
  const { start, end, isCollapsed } = normalizeSelection(state.selection)
  if (isCollapsed) return state
  if (!sameEditableContainer(start.path, end.path)) {
    // Ranges that span containers are not deleted; state stays unchanged.
    return state
  }

  const block = getBlock(state.doc, start.path)
  if (!block || block.type === "raw" || block.type === "divider") return state

  if (block.type === "code_block") {
    const doc = cloneDoc(state.doc)
    const code = doc.blocks[start.path[0]!] as typeof block
    const from = Math.max(0, Math.min(start.offset, code.value.length))
    const to = Math.max(from, Math.min(end.offset, code.value.length))
    code.value = code.value.slice(0, from) + code.value.slice(to)
    return { doc, selection: collapsedSelection(start.path, from) }
  }

  const children = getInlineChildren(state.doc, start.path)
  if (!children) return state
  const segs = flattenInlineSegments(children)
  const from = start.offset
  const to = end.offset
  const nextSegs: typeof segs = []
  let offset = 0
  for (const seg of segs) {
    const segEnd = offset + seg.text.length
    const keepStart = Math.min(segEnd, Math.max(offset, from))
    const keepEnd = Math.max(offset, Math.min(segEnd, to))
    // Keep text outside [from, to)
    if (offset < from) {
      nextSegs.push({
        text: seg.text.slice(0, Math.min(seg.text.length, from - offset)),
        marks: seg.marks,
        linkHref: seg.linkHref,
      })
    }
    if (segEnd > to) {
      nextSegs.push({
        text: seg.text.slice(Math.max(0, to - offset)),
        marks: seg.marks,
        linkHref: seg.linkHref,
      })
    }
    void keepStart
    void keepEnd
    offset = segEnd
  }

  return {
    doc: setInlineChildren(state.doc, start.path, rebuildInlines(nextSegs)),
    selection: collapsedSelection(start.path, from),
  }
}

export function deleteBackward(state: EditorState): EditorState {
  if (!selectionIsCollapsed(state.selection)) return deleteSelection(state)
  const { start } = normalizeSelection(state.selection)
  if (start.offset > 0) {
    return deleteSelection({
      doc: state.doc,
      selection: {
        anchor: { path: [...start.path], offset: start.offset - 1 },
        focus: { path: [...start.path], offset: start.offset },
      },
    })
  }
  return mergeBlocks(state)
}

/**
 * Split the current block at the caret (Enter).
 */
export function splitBlock(state: EditorState): EditorState {
  let next = state
  if (!selectionIsCollapsed(state.selection)) next = deleteSelection(state)
  const { start } = normalizeSelection(next.selection)
  const blockIndex = start.path[0]
  if (blockIndex === undefined) return next
  const block = next.doc.blocks[blockIndex]
  if (!block || block.type === "raw" || block.type === "divider") return next

  if (block.type === "code_block") {
    return insertText(next, "\n")
  }

  if (isListBlock(block)) {
    const itemIndex = start.path[1] ?? 0
    const item = block.items[itemIndex]
    if (!item) return next
    const text = plainTextFromInlines(item.children)
    if (text === "" && block.items.length > 1) {
      // Empty item exits the list into a paragraph after.
      const doc = cloneDoc(next.doc)
      const list = doc.blocks[blockIndex] as typeof block
      list.items.splice(itemIndex, 1)
      if (list.items.length === 0) {
        doc.blocks[blockIndex] = createParagraph()
        return {
          doc,
          selection: collapsedSelection([blockIndex], 0),
        }
      }
      const insertAt = blockIndex + 1
      doc.blocks.splice(insertAt, 0, createParagraph())
      return {
        doc,
        selection: collapsedSelection([insertAt], 0),
      }
    }

    const left = sliceInlines(item.children, 0, start.offset)
    const right = sliceInlines(item.children, start.offset, text.length)
    const doc = cloneDoc(next.doc)
    const list = doc.blocks[blockIndex] as typeof block
    if (list.type === "task_list") {
      const task = list.items[itemIndex] as TaskItemNode
      task.children = left
      list.items.splice(itemIndex + 1, 0, {
        type: "task_item",
        checked: false,
        children: right,
      })
    } else {
      const li = list.items[itemIndex] as ListItemNode
      li.children = left
      list.items.splice(itemIndex + 1, 0, {
        type: "list_item",
        children: right,
      })
    }
    return {
      doc,
      selection: collapsedSelection([blockIndex, itemIndex + 1], 0),
    }
  }

  if (!isInlineBlock(block)) return next
  const text = plainTextFromInlines(block.children)
  const left = sliceInlines(block.children, 0, start.offset)
  const right = sliceInlines(block.children, start.offset, text.length)
  const doc = cloneDoc(next.doc)
  const current = doc.blocks[blockIndex]!
  if (current.type === "heading") {
    current.children = left
    doc.blocks.splice(blockIndex + 1, 0, createParagraph(right))
  } else if (current.type === "blockquote") {
    current.children = left
    doc.blocks.splice(blockIndex + 1, 0, {
      type: "blockquote",
      children: right,
    })
  } else if (current.type === "paragraph") {
    current.children = left
    doc.blocks.splice(blockIndex + 1, 0, createParagraph(right))
  } else {
    return next
  }
  return {
    doc,
    selection: collapsedSelection([blockIndex + 1], 0),
  }
}

function sliceInlines(
  nodes: readonly InlineNode[],
  from: number,
  to: number
): InlineNode[] {
  const segs = flattenInlineSegments(nodes)
  const next: typeof segs = []
  let offset = 0
  for (const seg of segs) {
    const segEnd = offset + seg.text.length
    const a = Math.max(from, offset)
    const b = Math.min(to, segEnd)
    if (a < b) {
      next.push({
        text: seg.text.slice(a - offset, b - offset),
        marks: seg.marks,
        linkHref: seg.linkHref,
      })
    }
    offset = segEnd
  }
  return rebuildInlines(next)
}

/**
 * Merge the current block into the previous block when the caret is at offset 0.
 */
export function mergeBlocks(state: EditorState): EditorState {
  if (!selectionIsCollapsed(state.selection)) return state
  const { start } = normalizeSelection(state.selection)
  if (start.offset !== 0) return state

  const blockIndex = start.path[0]
  if (blockIndex === undefined || blockIndex === 0) return state
  const doc = cloneDoc(state.doc)
  const current = doc.blocks[blockIndex]!
  const previous = doc.blocks[blockIndex - 1]!

  if (isListBlock(current) && start.path[1] !== undefined && start.path[1] > 0) {
    const itemIndex = start.path[1]
    const list = current
    const item = list.items[itemIndex]!
    const prevItem = list.items[itemIndex - 1]!
    const prevLen = plainTextFromInlines(prevItem.children).length
    prevItem.children = mergeTextNodes([
      ...prevItem.children,
      ...item.children,
    ])
    list.items.splice(itemIndex, 1)
    return {
      doc,
      selection: collapsedSelection([blockIndex, itemIndex - 1], prevLen),
    }
  }

  if (previous.type === "raw" || current.type === "raw") return state
  if (previous.type === "divider") {
    doc.blocks.splice(blockIndex - 1, 1)
    return {
      doc,
      selection: collapsedSelection(defaultPathForBlock(doc, blockIndex - 1), 0),
    }
  }

  if (previous.type === "code_block" && current.type === "code_block") {
    const prevLen = previous.value.length
    previous.value = previous.value + (previous.value && current.value ? "\n" : "") + current.value
    doc.blocks.splice(blockIndex, 1)
    return { doc, selection: collapsedSelection([blockIndex - 1], prevLen) }
  }

  if (isListBlock(previous) && isInlineBlock(current)) {
    const lastIndex = previous.items.length - 1
    const last = previous.items[lastIndex]!
    const prevLen = plainTextFromInlines(last.children).length
    last.children = mergeTextNodes([...last.children, ...current.children])
    doc.blocks.splice(blockIndex, 1)
    return {
      doc,
      selection: collapsedSelection([blockIndex - 1, lastIndex], prevLen),
    }
  }

  if (isInlineBlock(previous) && isInlineBlock(current)) {
    const prevLen = plainTextFromInlines(previous.children).length
    previous.children = mergeTextNodes([
      ...previous.children,
      ...current.children,
    ])
    doc.blocks.splice(blockIndex, 1)
    return {
      doc,
      selection: collapsedSelection([blockIndex - 1], prevLen),
    }
  }

  if (isInlineBlock(previous) && isListBlock(current) && (start.path[1] ?? 0) === 0) {
    const first = current.items[0]!
    const prevLen = plainTextFromInlines(previous.children).length
    previous.children = mergeTextNodes([
      ...previous.children,
      ...first.children,
    ])
    current.items.shift()
    if (current.items.length === 0) doc.blocks.splice(blockIndex, 1)
    return {
      doc,
      selection: collapsedSelection([blockIndex - 1], prevLen),
    }
  }

  return state
}

export function indentListItem(state: EditorState): EditorState {
  // Flat lists only; indent does not change nesting.
  return state
}

export function outdentListItem(state: EditorState): EditorState {
  const { start } = normalizeSelection(state.selection)
  const blockIndex = start.path[0]
  if (blockIndex === undefined) return state
  const block = state.doc.blocks[blockIndex]
  if (!block || !isListBlock(block)) return state
  const itemIndex = start.path[1] ?? 0
  const item = block.items[itemIndex]
  if (!item) return state

  const doc = cloneDoc(state.doc)
  const list = doc.blocks[blockIndex] as typeof block
  list.items.splice(itemIndex, 1)
  const paragraph = createParagraph(item.children)
  if (list.items.length === 0) {
    doc.blocks[blockIndex] = paragraph
    return { doc, selection: collapsedSelection([blockIndex], start.offset) }
  }
  doc.blocks.splice(blockIndex + 1, 0, paragraph)
  return {
    doc,
    selection: collapsedSelection([blockIndex + 1], start.offset),
  }
}

export function toggleTaskChecked(
  state: EditorState,
  path?: EditorPath
): EditorState {
  const target = path ?? normalizeSelection(state.selection).start.path
  const blockIndex = target[0]
  const itemIndex = target[1]
  if (blockIndex === undefined || itemIndex === undefined) return state
  const doc = cloneDoc(state.doc)
  const block = doc.blocks[blockIndex]
  if (!block || block.type !== "task_list") return state
  const item = block.items[itemIndex]
  if (!item) return state
  item.checked = !item.checked
  return { doc, selection: state.selection }
}

export function insertDivider(state: EditorState): EditorState {
  const split = splitBlock(state)
  const { start } = normalizeSelection(split.selection)
  const index = start.path[0] ?? 0
  const doc = cloneDoc(split.doc)
  doc.blocks.splice(index, 0, createDivider())
  return {
    doc,
    selection: collapsedSelection([index + 1], 0),
  }
}

export function pasteMarkdownBlocks(
  state: EditorState,
  blocks: BlockNode[]
): EditorState {
  let next = state
  if (!selectionIsCollapsed(state.selection)) next = deleteSelection(state)
  if (blocks.length === 0) return next
  if (blocks.length === 1 && isInlineBlock(blocks[0]!)) {
    return insertText(next, plainTextFromInlines(blocks[0]!.children))
  }

  const { start } = normalizeSelection(next.selection)
  const blockIndex = start.path[0] ?? 0
  const doc = cloneDoc(next.doc)
  const current = doc.blocks[blockIndex]
  const atStart =
    start.offset === 0 &&
    current &&
    isInlineBlock(current) &&
    plainTextFromInlines(current.children) === ""

  if (atStart) {
    doc.blocks.splice(blockIndex, 1, ...blocks.map((b) => structuredClone(b)))
  } else {
    doc.blocks.splice(
      blockIndex + 1,
      0,
      ...blocks.map((b) => structuredClone(b))
    )
  }
  const focusIndex = atStart
    ? blockIndex + blocks.length - 1
    : blockIndex + blocks.length
  const path = defaultPathForBlock(doc, focusIndex)
  return {
    doc,
    selection: collapsedSelection(path, contentLength(doc, path)),
  }
}

export function replaceDoc(markdownDoc: EditorDoc, selection?: EditorSelection): EditorState {
  const doc = markdownDoc.blocks.length ? markdownDoc : emptyDoc()
  return {
    doc,
    selection:
      selection ??
      collapsedSelection(defaultPathForBlock(doc, 0), 0),
  }
}

export function pointAt(
  path: EditorPath,
  offset: number
): EditorPoint {
  return { path: [...path], offset }
}

export function selectionAround(
  path: EditorPath,
  from: number,
  to: number
): EditorSelection {
  return {
    anchor: pointAt(path, from),
    focus: pointAt(path, to),
  }
}

export function isMarkActive(
  state: EditorState,
  mark: MarkType
): boolean {
  const { start, end, isCollapsed } = normalizeSelection(state.selection)
  if (!sameEditableContainer(start.path, end.path)) return false
  const children = getInlineChildren(state.doc, start.path)
  if (!children) return false
  const segs = flattenInlineSegments(children)
  const plain = segs.map((s) => s.text).join("")
  const from = isCollapsed
    ? Math.max(0, start.offset - 1)
    : start.offset
  const to = isCollapsed ? start.offset : end.offset
  if (plain.length === 0) return false
  let offset = 0
  let saw = false
  for (const seg of segs) {
    const segEnd = offset + seg.text.length
    const a = Math.max(from, offset)
    const b = Math.min(to === from ? to + 1 : to, segEnd)
    if (a < b) {
      saw = true
      if (!hasMark(seg.marks, mark)) return false
    }
    offset = segEnd
  }
  return saw
}

export function activeBlockType(
  state: EditorState
): { type: BlockTypeName; level?: 1 | 2 | 3 } | null {
  const { start } = normalizeSelection(state.selection)
  const block = getBlock(state.doc, start.path)
  if (!block || block.type === "raw") return null
  if (block.type === "heading") return { type: "heading", level: block.level }
  return { type: block.type as BlockTypeName }
}

export function pathsEqual(a: EditorPath, b: EditorPath): boolean {
  return pathEquals(a, b)
}
