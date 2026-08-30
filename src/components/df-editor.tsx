"use client"

import * as React from "react"
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
  Check,
} from "lucide-react"

import { useLatestRef } from "../hooks"
import { useDfStrings } from "../lib/df-intl"
import {
  activeBlockType,
  applyInputRule,
  collapsedSelection,
  deleteBackward,
  deleteSelection,
  insertText,
  isMarkActive,
  normalizeSelection,
  parseMarkdown,
  pasteMarkdown,
  plainTextFromInlines,
  selectionIsCollapsed,
  serializeMarkdown,
  setBlockType,
  setLink,
  splitBlock,
  toggleMark,
  toggleTaskChecked,
  type BlockNode,
  type EditorDoc,
  type EditorPath,
  type EditorSelection,
  type EditorState,
  type InlineNode,
  type MarkType,
} from "../lib/df-editor"
import { cn } from "../lib/utils"
import { Button } from "./df-button"

export type EditorToolbarMode = "static" | "floating" | "both" | "none"

export type EditorProps = {
  value: string
  onChange?: (markdown: string) => void
  placeholder?: string
  readOnly?: boolean
  /** CSS value applied to `--df-editor-min-height`. */
  minHeight?: string
  toolbar?: EditorToolbarMode
  autoFocus?: boolean
  className?: string
  "aria-label"?: string
}

type FloatingPos = { top: number; left: number }

const SETTLE_MS = 160

function pathKey(path: EditorPath): string {
  return path.join(".")
}

function parsePathKey(value: string | null | undefined): EditorPath | null {
  if (!value) return null
  const parts = value.split(".").map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => !Number.isFinite(part))) return null
  return parts
}

function findEditableAncestor(node: Node | null, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.dataset.dfPath != null) {
      return current
    }
    current = current.parentNode
  }
  return null
}

function offsetInEditable(editable: HTMLElement, targetNode: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT)
  let total = 0
  let textNode = walker.nextNode()
  while (textNode) {
    const value = textNode.textContent ?? ""
    const isZwspOnly = value === "\u200b"
    if (textNode === targetNode) {
      if (isZwspOnly) return total
      return total + Math.min(targetOffset, value.length)
    }
    if (!isZwspOnly) total += value.length
    textNode = walker.nextNode()
  }
  return total
}

function readDomSelection(root: HTMLElement): EditorSelection | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null
  }
  const anchorEl = findEditableAncestor(range.startContainer, root)
  const focusEl = findEditableAncestor(range.endContainer, root)
  if (!anchorEl || !focusEl) return null
  const anchorPath = parsePathKey(anchorEl.dataset.dfPath)
  const focusPath = parsePathKey(focusEl.dataset.dfPath)
  if (!anchorPath || !focusPath) return null
  return {
    anchor: {
      path: anchorPath,
      offset: offsetInEditable(anchorEl, range.startContainer, range.startOffset),
    },
    focus: {
      path: focusPath,
      offset: offsetInEditable(focusEl, range.endContainer, range.endOffset),
    },
  }
}

function setDomSelection(root: HTMLElement, selection: EditorSelection) {
  const { start, end } = normalizeSelection(selection)
  const startEl = root.querySelector(
    `[data-df-path="${pathKey(start.path)}"]`
  ) as HTMLElement | null
  const endEl = root.querySelector(
    `[data-df-path="${pathKey(end.path)}"]`
  ) as HTMLElement | null
  if (!startEl || !endEl) return

  const place = (editable: HTMLElement, offset: number): { node: Node; offset: number } | null => {
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT)
    let remaining = offset
    let textNode = walker.nextNode() as Text | null
    let last: Text | null = null
    while (textNode) {
      last = textNode
      const value = textNode.data
      if (value === "\u200b") {
        if (remaining === 0) return { node: textNode, offset: 0 }
        textNode = walker.nextNode() as Text | null
        continue
      }
      if (remaining <= value.length) {
        return { node: textNode, offset: remaining }
      }
      remaining -= value.length
      textNode = walker.nextNode() as Text | null
    }
    if (last) {
      return {
        node: last,
        offset: last.data === "\u200b" ? 0 : last.data.length,
      }
    }
    return { node: editable, offset: 0 }
  }

  const a = place(startEl, start.offset)
  const b = place(endEl, end.offset)
  if (!a || !b) return
  const range = document.createRange()
  try {
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
  } catch {
    return
  }
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}

function leafText(text: string): string {
  return text.length === 0 ? "\u200b" : text
}

function renderInlines(nodes: readonly InlineNode[], keyPrefix: string): React.ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    if (node.type === "link") {
      return (
        <a
          key={key}
          href={node.href}
          rel="noopener noreferrer"
          target="_blank"
          data-df="editor-link"
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey) event.preventDefault()
          }}
        >
          {renderInlines(node.children, key)}
        </a>
      )
    }
    let content: React.ReactNode = (
      <span data-df="editor-leaf">{leafText(node.text)}</span>
    )
    if (node.code) {
      content = <code data-df="editor-code">{content}</code>
    }
    if (node.bold) {
      content = <strong data-df="editor-strong">{content}</strong>
    }
    if (node.italic) {
      content = <em data-df="editor-em">{content}</em>
    }
    if (node.strikethrough) {
      content = <s data-df="editor-strike">{content}</s>
    }
    return <React.Fragment key={key}>{content}</React.Fragment>
  })
}

function isDocEmpty(doc: EditorDoc): boolean {
  if (doc.blocks.length !== 1) return false
  const block = doc.blocks[0]
  if (!block || block.type !== "paragraph") return false
  return plainTextFromInlines(block.children).trim() === ""
}

function EditorToolbarButtons({
  state,
  disabled,
  onAction,
}: {
  state: EditorState
  disabled: boolean
  onAction: (run: (prev: EditorState) => EditorState) => void
}) {
  const s = useDfStrings()
  const mark = (type: MarkType) => isMarkActive(state, type)
  const block = activeBlockType(state)

  const btn = (
    label: string,
    pressed: boolean,
    run: () => void,
    icon: React.ReactNode
  ) => (
    <Button
      key={label}
      type="button"
      size="icon-xs"
      variant="ghost"
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      {icon}
    </Button>
  )

  return (
    <>
      {btn(
        s.formatToolbarBold,
        mark("bold"),
        () => onAction((prev) => toggleMark(prev, "bold")),
        <Bold />
      )}
      {btn(
        s.formatToolbarItalic,
        mark("italic"),
        () => onAction((prev) => toggleMark(prev, "italic")),
        <Italic />
      )}
      {btn(
        s.formatToolbarStrikethrough,
        mark("strikethrough"),
        () => onAction((prev) => toggleMark(prev, "strikethrough")),
        <Strikethrough />
      )}
      {btn(
        s.formatToolbarInlineCode,
        mark("code"),
        () => onAction((prev) => toggleMark(prev, "code")),
        <Code />
      )}
      {btn(
        s.formatToolbarLink,
        false,
        () => {
          const href =
            typeof window !== "undefined"
              ? window.prompt(
                  s.formatToolbarLinkUrl,
                  s.formatToolbarLinkPlaceholder
                )
              : null
          if (href) onAction((prev) => setLink(prev, href))
        },
        <Link2 />
      )}
      <span data-df="editor-toolbar-sep" aria-hidden />
      {btn(
        s.formatToolbarHeading1,
        block?.type === "heading" && block.level === 1,
        () => onAction((prev) => setBlockType(prev, "heading", { level: 1 })),
        <Heading1 />
      )}
      {btn(
        s.formatToolbarHeading2,
        block?.type === "heading" && block.level === 2,
        () => onAction((prev) => setBlockType(prev, "heading", { level: 2 })),
        <Heading2 />
      )}
      {btn(
        s.formatToolbarHeading3,
        block?.type === "heading" && block.level === 3,
        () => onAction((prev) => setBlockType(prev, "heading", { level: 3 })),
        <Heading3 />
      )}
      {btn(
        s.formatToolbarBulletList,
        block?.type === "bullet_list",
        () => onAction((prev) => setBlockType(prev, "bullet_list")),
        <List />
      )}
      {btn(
        s.formatToolbarOrderedList,
        block?.type === "ordered_list",
        () => onAction((prev) => setBlockType(prev, "ordered_list")),
        <ListOrdered />
      )}
      {btn(
        s.formatToolbarTaskList,
        block?.type === "task_list",
        () => onAction((prev) => setBlockType(prev, "task_list")),
        <ListChecks />
      )}
      {btn(
        s.editorQuote,
        block?.type === "blockquote",
        () => onAction((prev) => setBlockType(prev, "blockquote")),
        <Quote />
      )}
      {btn(
        s.formatToolbarCodeBlock,
        block?.type === "code_block",
        () => onAction((prev) => setBlockType(prev, "code_block")),
        <SquareCode />
      )}
      {btn(
        s.editorDivider,
        false,
        () => onAction((prev) => setBlockType(prev, "divider")),
        <Minus />
      )}
    </>
  )
}

function renderBlock(
  block: BlockNode,
  blockIndex: number,
  readOnly: boolean,
  onToggleTask: (path: EditorPath) => void
): React.ReactNode {
  if (block.type === "paragraph") {
    return (
      <p key={blockIndex} data-df="editor-paragraph" data-df-path={pathKey([blockIndex])}>
        {renderInlines(block.children, `p-${blockIndex}`)}
      </p>
    )
  }
  if (block.type === "heading") {
    const Tag = (`h${block.level}` as "h1" | "h2" | "h3")
    return (
      <Tag
        key={blockIndex}
        data-df="editor-heading"
        data-level={block.level}
        data-df-path={pathKey([blockIndex])}
      >
        {renderInlines(block.children, `h-${blockIndex}`)}
      </Tag>
    )
  }
  if (block.type === "blockquote") {
    return (
      <blockquote
        key={blockIndex}
        data-df="editor-quote"
        data-df-path={pathKey([blockIndex])}
      >
        {renderInlines(block.children, `q-${blockIndex}`)}
      </blockquote>
    )
  }
  if (block.type === "code_block") {
    return (
      <pre
        key={blockIndex}
        data-df="editor-code-block"
        data-df-path={pathKey([blockIndex])}
        spellCheck={false}
      >
        <code>{leafText(block.value)}</code>
      </pre>
    )
  }
  if (block.type === "divider") {
    return (
      <hr
        key={blockIndex}
        data-df="editor-divider"
        data-df-path={pathKey([blockIndex])}
        contentEditable={false}
      />
    )
  }
  if (block.type === "raw") {
    return (
      <pre
        key={blockIndex}
        data-df="editor-raw"
        data-df-path={pathKey([blockIndex])}
        contentEditable={false}
      >
        {block.markdown}
      </pre>
    )
  }
  if (block.type === "bullet_list") {
    return (
      <ul key={blockIndex} data-df="editor-bullet-list">
        {block.items.map((item, itemIndex) => (
          <li
            key={itemIndex}
            data-df="editor-list-item"
            data-df-path={pathKey([blockIndex, itemIndex])}
          >
            {renderInlines(item.children, `ul-${blockIndex}-${itemIndex}`)}
          </li>
        ))}
      </ul>
    )
  }
  if (block.type === "ordered_list") {
    return (
      <ol key={blockIndex} data-df="editor-ordered-list">
        {block.items.map((item, itemIndex) => (
          <li
            key={itemIndex}
            data-df="editor-list-item"
            data-df-path={pathKey([blockIndex, itemIndex])}
          >
            {renderInlines(item.children, `ol-${blockIndex}-${itemIndex}`)}
          </li>
        ))}
      </ol>
    )
  }
  return (
    <ul key={blockIndex} data-df="editor-task-list">
      {block.items.map((item, itemIndex) => {
        const path: EditorPath = [blockIndex, itemIndex]
        return (
          <li
            key={itemIndex}
            data-df="editor-task-item"
            data-df-path={pathKey(path)}
            data-checked={item.checked ? "true" : "false"}
          >
            <EditorTaskCheck
              checked={item.checked}
              readOnly={readOnly}
              onToggle={() => onToggleTask(path)}
            />
            <span data-df="editor-task-text">
              {renderInlines(item.children, `task-${blockIndex}-${itemIndex}`)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function EditorBlocks({
  blocks,
  readOnly,
  onToggleTask,
}: {
  blocks: BlockNode[]
  readOnly: boolean
  onToggleTask: (path: EditorPath) => void
}) {
  return blocks.map((block, index) =>
    renderBlock(block, index, readOnly, onToggleTask)
  )
}

function EditorTaskCheck({
  checked,
  readOnly,
  onToggle,
}: {
  checked: boolean
  readOnly: boolean
  onToggle: () => void
}) {
  const s = useDfStrings()
  return (
    <span
      data-df="checkbox"
      data-size="sm"
      data-state={checked ? "checked" : "unchecked"}
      data-disabled={readOnly ? "" : undefined}
      contentEditable={false}
      className="df-editor-task-check"
    >
      <button
        type="button"
        data-df="checkbox-input"
        role="checkbox"
        aria-checked={checked}
        aria-label={
          checked ? s.editorMarkTaskIncomplete : s.editorMarkTaskComplete
        }
        disabled={readOnly}
        tabIndex={readOnly ? -1 : 0}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (readOnly) return
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault()
            event.stopPropagation()
            onToggle()
          }
        }}
      />
      <span data-df="checkbox-box" aria-hidden>
        {checked ? <Check data-df="checkbox-icon" /> : null}
      </span>
    </span>
  )
}

function Editor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  minHeight,
  toolbar = "both",
  autoFocus = false,
  className,
  "aria-label": ariaLabel,
}: EditorProps) {
  const s = useDfStrings()
  const resolvedPlaceholder = placeholder ?? s.editorPlaceholder
  const resolvedAriaLabel = ariaLabel ?? s.editorAriaLabel
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDocRef = React.useRef<EditorDoc | null>(null)
  const onChangeRef = useLatestRef(onChange)
  const skipSelectionSync = React.useRef(false)
  const floatingOffsetRef = React.useRef(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  // React state drives render. stateRef mirrors the latest commit for sync
  // command and event paths that must not wait for a re-render.
  const [state, setState] = React.useState<EditorState>(() => ({
    doc: parseMarkdown(value),
    selection: collapsedSelection([0], 0),
  }))
  const stateRef = React.useRef(state)
  const [floating, setFloating] = React.useState<FloatingPos | null>(null)
  const [showFloating, setShowFloating] = React.useState(false)

  const emitChange = React.useCallback((doc: EditorDoc) => {
    if (!onChangeRef.current) return
    pendingDocRef.current = doc
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null
      const pending = pendingDocRef.current
      pendingDocRef.current = null
      if (pending) onChangeRef.current?.(serializeMarkdown(pending))
    }, SETTLE_MS)
  }, [onChangeRef])

  const flushChange = React.useCallback((doc: EditorDoc) => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
    pendingDocRef.current = null
    onChangeRef.current?.(serializeMarkdown(doc))
  }, [onChangeRef])

  React.useEffect(() => {
    const onChangeLatest = onChangeRef
    return () => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current)
        settleTimer.current = null
      }
      const pending = pendingDocRef.current
      pendingDocRef.current = null
      if (pending) onChangeLatest.current?.(serializeMarkdown(pending))
    }
  }, [onChangeRef])

  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const raw = getComputedStyle(el).getPropertyValue("--df-editor-floating-offset").trim()
    const px = Number.parseFloat(raw)
    if (Number.isFinite(px) && px >= 0) floatingOffsetRef.current = px
  }, [])

  React.useEffect(() => {
    const current = serializeMarkdown(stateRef.current.doc)
    if (current === value || (value.trim() === "" && isDocEmpty(stateRef.current.doc))) {
      return
    }
    const next: EditorState = {
      doc: parseMarkdown(value),
      selection: stateRef.current.selection,
    }
    stateRef.current = next
    setState(next)
  }, [value])

  const commit = React.useCallback(
    (next: EditorState, opts?: { flush?: boolean }) => {
      stateRef.current = next
      setState(next)
      skipSelectionSync.current = true
      if (opts?.flush) flushChange(next.doc)
      else emitChange(next.doc)
      requestAnimationFrame(() => {
        const root = surfaceRef.current
        if (!root || readOnly) return
        setDomSelection(root, next.selection)
        skipSelectionSync.current = false
      })
    },
    [emitChange, flushChange, readOnly]
  )

  React.useEffect(() => {
    if (!autoFocus || readOnly) return
    surfaceRef.current?.focus()
  }, [autoFocus, readOnly])

  const updateFloatingFromSelection = React.useCallback(() => {
    if (toolbar !== "floating" && toolbar !== "both") {
      setShowFloating(false)
      return
    }
    if (readOnly) {
      setShowFloating(false)
      return
    }
    const sel = window.getSelection()
    const root = surfaceRef.current
    if (!sel || !root || sel.rangeCount === 0 || sel.isCollapsed) {
      setShowFloating(false)
      return
    }
    if (!root.contains(sel.anchorNode)) {
      setShowFloating(false)
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setShowFloating(false)
      return
    }
    setFloating({
      top: rect.top - floatingOffsetRef.current,
      left: rect.left + rect.width / 2,
    })
    setShowFloating(true)
  }, [readOnly, toolbar])

  React.useEffect(() => {
    const onSelectionChange = () => {
      if (skipSelectionSync.current) return
      const root = surfaceRef.current
      if (!root) return
      const model = readDomSelection(root)
      if (model) {
        stateRef.current = { ...stateRef.current, selection: model }
        setState((prev) => ({ ...prev, selection: model }))
      }
      updateFloatingFromSelection()
    }
    document.addEventListener("selectionchange", onSelectionChange)
    return () => document.removeEventListener("selectionchange", onSelectionChange)
  }, [updateFloatingFromSelection])

  const run = React.useCallback(
    (recipe: (prev: EditorState) => EditorState, opts?: { flush?: boolean }) => {
      if (readOnly) return
      commit(recipe(stateRef.current), opts)
    },
    [commit, readOnly]
  )

  const onToggleTask = React.useCallback(
    (path: EditorPath) => {
      run((prev) => toggleTaskChecked(prev, path))
    },
    [run]
  )

  const onBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
    if (readOnly) {
      event.preventDefault()
      return
    }
    const native = event.nativeEvent as InputEvent
    const type = native.inputType
    const data = native.data ?? ""

    if (type === "insertText" || type === "insertCompositionText") {
      event.preventDefault()
      if (!data) return
      run((prev) => {
        let next = insertText(prev, data)
        if (data === " " || data === "\n") {
          next = applyInputRule(next, data)
        }
        return next
      })
      return
    }

    if (type === "insertParagraph" || type === "insertLineBreak") {
      event.preventDefault()
      const block = stateRef.current.doc.blocks[
        normalizeSelection(stateRef.current.selection).start.path[0] ?? 0
      ]
      if (block?.type === "code_block" || type === "insertLineBreak") {
        run((prev) => insertText(prev, "\n"))
        return
      }
      run((prev) => {
        const ruled = applyInputRule(prev, "\n")
        if (ruled !== prev) return ruled
        return splitBlock(prev)
      })
      return
    }

    if (type === "deleteContentBackward" || type === "deleteContentForward") {
      event.preventDefault()
      if (type === "deleteContentBackward") {
        run((prev) => deleteBackward(prev))
      } else if (!selectionIsCollapsed(stateRef.current.selection)) {
        run((prev) => deleteSelection(prev))
      }
      return
    }

    if (type.startsWith("format")) {
      event.preventDefault()
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return
    const mod = event.metaKey || event.ctrlKey
    const block = stateRef.current.doc.blocks[
      normalizeSelection(stateRef.current.selection).start.path[0] ?? 0
    ]

    if (event.key === "Tab" && block?.type === "code_block") {
      event.preventDefault()
      run((prev) => insertText(prev, "  "))
      return
    }

    if (mod && event.key.toLowerCase() === "b") {
      event.preventDefault()
      run((prev) => toggleMark(prev, "bold"))
      return
    }
    if (mod && event.key.toLowerCase() === "i") {
      event.preventDefault()
      run((prev) => toggleMark(prev, "italic"))
      return
    }
    if (mod && event.key.toLowerCase() === "k") {
      event.preventDefault()
      const href =
        typeof window !== "undefined" ? window.prompt("Link URL", "https://") : null
      if (href) run((prev) => setLink(prev, href))
      return
    }
  }

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) return
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain")
    if (!text) return
    run((prev) => pasteMarkdown(prev, text))
  }

  const onBlur = () => {
    flushChange(stateRef.current.doc)
    setShowFloating(false)
  }

  const showStatic = toolbar === "static" || toolbar === "both"
  const empty = isDocEmpty(state.doc)
  const style = minHeight
    ? ({ "--df-editor-min-height": minHeight } as React.CSSProperties)
    : undefined

  return (
    <div
      ref={rootRef}
      data-df="editor"
      className={cn("df-editor", className)}
      data-readonly={readOnly ? "true" : undefined}
      style={style}
    >
      {showStatic ? (
        <div
          className="df-editor-toolbar"
          data-df="editor-toolbar"
          role="toolbar"
          aria-label={s.editorFormatting}
        >
          <EditorToolbarButtons
            state={state}
            disabled={readOnly}
            onAction={(recipe) => run(recipe)}
          />
        </div>
      ) : null}

      <div className="df-editor-surface-wrap" data-df="editor-surface-wrap">
        {empty ? (
          <p className="df-editor-placeholder" aria-hidden="true">
            {resolvedPlaceholder}
          </p>
        ) : null}
        <div
          ref={surfaceRef}
          className="df-editor-surface"
          data-df="editor-surface"
          role="textbox"
          aria-multiline="true"
          aria-label={resolvedAriaLabel}
          aria-readonly={readOnly || undefined}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          spellCheck
          onBeforeInput={onBeforeInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={onBlur}
        >
          <EditorBlocks
            blocks={state.doc.blocks}
            readOnly={readOnly}
            onToggleTask={onToggleTask}
          />
        </div>
      </div>

      {showFloating && floating ? (
        <div
          className="df-editor-floating-toolbar"
          data-df="editor-floating-toolbar"
          role="toolbar"
          aria-label={s.editorSelectionFormatting}
          style={{
            top: floating.top,
            left: floating.left,
            transform: "translate(-50%, -100%)",
          }}
        >
          <EditorToolbarButtons
            state={state}
            disabled={readOnly}
            onAction={(recipe) => run(recipe)}
          />
        </div>
      ) : null}
    </div>
  )
}

const DfEditor = Editor

export { Editor, DfEditor }
export type { EditorProps as DfEditorProps }
