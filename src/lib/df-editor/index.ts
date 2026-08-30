export {
  collapsedSelection,
  comparePoints,
  createBlockquote,
  createBulletList,
  createCodeBlock,
  createDivider,
  createHeading,
  createLink,
  createOrderedList,
  createParagraph,
  createRawBlock,
  createTaskList,
  createText,
  emptyDoc,
  hasMark,
  isInlineBlock,
  isLinkInline,
  isListBlock,
  isTextInline,
  normalizeSelection,
  pathEquals,
  plainTextFromInlines,
  selectionIsCollapsed,
  withMark,
  type BlockNode,
  type BlockquoteBlock,
  type BulletListBlock,
  type CodeBlock,
  type DividerBlock,
  type EditorDoc,
  type EditorPath,
  type EditorPoint,
  type EditorSelection,
  type EditorState,
  type HeadingBlock,
  type InlineNode,
  type LinkInline,
  type ListItemNode,
  type MarkType,
  type OrderedListBlock,
  type ParagraphBlock,
  type RawBlock,
  type TaskItemNode,
  type TaskListBlock,
  type TextInline,
  type TextMarks,
} from "./ast"

export { parseMarkdown } from "./parse"
export {
  codeBlockFenceLength,
  inlineCodeFenceLength,
  maxBacktickRun,
  serializeMarkdown,
} from "./serialize"
export { isSafeHref, sanitizeHref } from "./url"
export { applyInputRule, matchInputRule, type InputRuleResult } from "./input-rules"

export {
  activeBlockType,
  deleteBackward,
  deleteSelection,
  indentListItem,
  insertBlock,
  insertDivider,
  insertText,
  isMarkActive,
  mergeBlocks,
  outdentListItem,
  pasteMarkdownBlocks,
  pointAt,
  replaceDoc,
  selectionAround,
  setBlockType,
  setLink,
  splitBlock,
  toggleMark,
  toggleTaskChecked,
  unsetLink,
  type BlockTypeName,
  type SetBlockTypeAttrs,
} from "./transforms"

import { selectionIsCollapsed, type EditorState } from "./ast"
import { parseMarkdown } from "./parse"
import {
  deleteSelection,
  insertText,
  pasteMarkdownBlocks,
} from "./transforms"

/** Paste markdown or plain text into the editor model. */
export function pasteMarkdown(state: EditorState, markdown: string): EditorState {
  let next = state
  if (!selectionIsCollapsed(state.selection)) next = deleteSelection(state)
  const pasted = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (!pasted.includes("\n")) {
    return insertText(next, pasted)
  }
  const doc = parseMarkdown(pasted)
  return pasteMarkdownBlocks(next, doc.blocks)
}
