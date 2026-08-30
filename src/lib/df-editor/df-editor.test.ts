import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyInputRule,
  collapsedSelection,
  createCodeBlock,
  createHeading,
  createParagraph,
  createText,
  emptyDoc,
  insertText,
  isSafeHref,
  mergeBlocks,
  parseMarkdown,
  pasteMarkdown,
  replaceDoc,
  sanitizeHref,
  selectionAround,
  serializeMarkdown,
  setBlockType,
  setLink,
  splitBlock,
  toggleMark,
  toggleTaskChecked,
  type EditorDoc,
  type EditorState,
} from "./index.ts"

function stateFromMarkdown(
  markdown: string,
  path: number[] = [0],
  offset = 0
): EditorState {
  return {
    doc: parseMarkdown(markdown),
    selection: collapsedSelection(path, offset),
  }
}

function assertRoundTrip(doc: EditorDoc) {
  const again = parseMarkdown(serializeMarkdown(doc))
  assert.deepEqual(again, doc)
}

function assertParseStable(source: string) {
  const once = parseMarkdown(source)
  const twice = parseMarkdown(serializeMarkdown(once))
  assert.deepEqual(twice, once)
}

test("round-trip paragraph with marks", () => {
  const doc = parseMarkdown("Hello **bold** and *italic* and `code` and ~~strike~~.\n")
  assertRoundTrip(doc)
  const md = serializeMarkdown(doc)
  assert.match(md, /\*\*bold\*\*/)
  assert.match(md, /[_*]italic[_*]/)
  assert.match(md, /`code`/)
  assert.match(md, /~~strike~~/)
})

test("round-trip heading levels 1 to 3", () => {
  for (const level of [1, 2, 3] as const) {
    const doc: EditorDoc = {
      type: "doc",
      blocks: [createHeading(level, [createText("Title")])],
    }
    assertRoundTrip(doc)
  }
})

test("round-trip bullet ordered and task lists", () => {
  const source = [
    "- one",
    "- two",
    "",
    "1. first",
    "2. second",
    "",
    "- [ ] todo",
    "- [x] done",
    "",
  ].join("\n")
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks[0]?.type, "bullet_list")
  assert.equal(doc.blocks[1]?.type, "ordered_list")
  assert.equal(doc.blocks[2]?.type, "task_list")
  assertRoundTrip(doc)
  assert.match(serializeMarkdown(doc), /^1\. first$/m)
  assert.match(serializeMarkdown(doc), /^- \[x\] done$/m)
})

test("round-trip blockquote code block and divider", () => {
  const source = ["> quoted", "", "```js", "const x = 1", "```", "", "---", ""].join(
    "\n"
  )
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks[0]?.type, "blockquote")
  assert.equal(doc.blocks[1]?.type, "code_block")
  assert.equal(doc.blocks[2]?.type, "divider")
  assertRoundTrip(doc)
})

test("round-trip link inline", () => {
  const doc = parseMarkdown("See [docs](https://example.com).\n")
  assertRoundTrip(doc)
  assert.match(serializeMarkdown(doc), /\[docs\]\(https:\/\/example\.com\)/)
})

test("unknown markdown tables html and footnotes pass through as raw", () => {
  const table = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  const html = "<div class=\"note\">keep</div>"
  const footnote = "[^1]: footnote body"
  const source = [table, "", html, "", footnote, "", "After", ""].join("\n")
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks[0]?.type, "raw")
  assert.equal(doc.blocks[1]?.type, "raw")
  assert.equal(doc.blocks[2]?.type, "raw")
  assert.equal(doc.blocks[3]?.type, "paragraph")
  const out = serializeMarkdown(doc)
  assert.match(out, /\| a \| b \|/)
  assert.match(out, /<div class="note">keep<\/div>/)
  assert.match(out, /\[\^1\]: footnote body/)
  assert.match(out, /After/)
  const again = parseMarkdown(out)
  assert.equal(again.blocks[0]?.type, "raw")
  if (again.blocks[0]?.type === "raw" && doc.blocks[0]?.type === "raw") {
    assert.equal(again.blocks[0].markdown, doc.blocks[0].markdown)
  }
})

test("toggleMark bold within one block", () => {
  let state = stateFromMarkdown("Hello world\n")
  state = {
    ...state,
    selection: selectionAround([0], 6, 11),
  }
  state = toggleMark(state, "bold")
  assert.match(serializeMarkdown(state.doc), /\*\*world\*\*/)
  state = toggleMark(state, "bold")
  assert.equal(serializeMarkdown(state.doc).includes("**world**"), false)
})

test("toggleMark across block boundary is a no-op", () => {
  const doc = parseMarkdown("One\n\nTwo\n")
  const before = serializeMarkdown(doc)
  const state: EditorState = {
    doc,
    selection: {
      anchor: { path: [0], offset: 1 },
      focus: { path: [1], offset: 1 },
    },
  }
  const next = toggleMark(state, "bold")
  assert.equal(serializeMarkdown(next.doc), before)
  assert.deepEqual(next.selection, state.selection)
})

test("setBlockType heading bullet quote and code", () => {
  let state = stateFromMarkdown("Hello\n")
  state = setBlockType(state, "heading", { level: 2 })
  assert.equal(state.doc.blocks[0]?.type, "heading")
  state = setBlockType(state, "bullet_list")
  assert.equal(state.doc.blocks[0]?.type, "bullet_list")
  state = setBlockType(state, "blockquote")
  assert.equal(state.doc.blocks[0]?.type, "blockquote")
  state = setBlockType(state, "code_block")
  assert.equal(state.doc.blocks[0]?.type, "code_block")
})

test("splitBlock and mergeBlocks", () => {
  let state = stateFromMarkdown("Hello world\n")
  state = { ...state, selection: collapsedSelection([0], 5) }
  state = splitBlock(state)
  assert.equal(state.doc.blocks.length, 2)
  assert.equal(serializeMarkdown(state.doc), "Hello\n\n world\n")
  state = mergeBlocks(state)
  assert.equal(state.doc.blocks.length, 1)
  assert.equal(serializeMarkdown(state.doc), "Hello world\n")
})

test("splitBlock on list creates new item", () => {
  let state = stateFromMarkdown("- one\n")
  state = { ...state, selection: collapsedSelection([0, 0], 3) }
  state = splitBlock(state)
  assert.equal(state.doc.blocks[0]?.type, "bullet_list")
  if (state.doc.blocks[0]?.type === "bullet_list") {
    assert.equal(state.doc.blocks[0].items.length, 2)
  }
})

test("toggleTaskChecked flips item", () => {
  let state = stateFromMarkdown("- [ ] task\n")
  state = toggleTaskChecked(state, [0, 0])
  assert.match(serializeMarkdown(state.doc), /\[x\]/)
  state = toggleTaskChecked(state, [0, 0])
  assert.match(serializeMarkdown(state.doc), /\[ \]/)
})

test("insertText and setLink", () => {
  let state: EditorState = replaceDoc(emptyDoc())
  state = insertText(state, "Link me")
  state = { ...state, selection: selectionAround([0], 0, 7) }
  state = setLink(state, "https://example.com")
  assert.match(serializeMarkdown(state.doc), /\[Link me\]\(https:\/\/example\.com\)/)
  const rejected = setLink(state, "javascript:alert(1)")
  assert.deepEqual(rejected.doc, state.doc)
})

test("input rules heading bullet ordered quote code", () => {
  let state = stateFromMarkdown("#\n")
  state = { ...state, selection: collapsedSelection([0], 1) }
  state = insertText(state, " ")
  state = applyInputRule(state, " ")
  assert.equal(state.doc.blocks[0]?.type, "heading")

  state = stateFromMarkdown("-\n")
  state = { ...state, selection: collapsedSelection([0], 1) }
  state = insertText(state, " ")
  state = applyInputRule(state, " ")
  assert.equal(state.doc.blocks[0]?.type, "bullet_list")

  state = stateFromMarkdown("1.\n")
  state = { ...state, selection: collapsedSelection([0], 2) }
  state = insertText(state, " ")
  state = applyInputRule(state, " ")
  assert.equal(state.doc.blocks[0]?.type, "ordered_list")

  state = stateFromMarkdown(">\n")
  state = { ...state, selection: collapsedSelection([0], 1) }
  state = insertText(state, " ")
  state = applyInputRule(state, " ")
  assert.equal(state.doc.blocks[0]?.type, "blockquote")

  state = stateFromMarkdown("```\n")
  state = { ...state, selection: collapsedSelection([0], 3) }
  state = insertText(state, " ")
  state = applyInputRule(state, " ")
  assert.equal(state.doc.blocks[0]?.type, "code_block")
})

test("url rejection blocks javascript and data schemes", () => {
  assert.equal(isSafeHref("https://ok.com"), true)
  assert.equal(isSafeHref("http://ok.com"), true)
  assert.equal(isSafeHref("mailto:a@b.com"), true)
  assert.equal(isSafeHref("/relative/path"), true)
  assert.equal(isSafeHref("#hash"), true)
  assert.equal(isSafeHref("javascript:alert(1)"), false)
  assert.equal(isSafeHref("data:text/html;base64,xx"), false)
  assert.equal(isSafeHref("vbscript:msg"), false)
  assert.equal(sanitizeHref("javascript:alert(1)"), null)
  assert.equal(sanitizeHref("https://ok.com"), "https://ok.com")
})

test("pasteMarkdown inserts blocks", () => {
  let state = stateFromMarkdown("Host\n")
  state = { ...state, selection: collapsedSelection([0], 4) }
  state = pasteMarkdown(state, "## Pasted\n\nBody")
  assert.ok(state.doc.blocks.length >= 2)
  assert.ok(serializeMarkdown(state.doc).includes("## Pasted"))
})

test("parse empty and code block identity", () => {
  assert.deepEqual(parseMarkdown(""), emptyDoc())
  const doc: EditorDoc = {
    type: "doc",
    blocks: [createCodeBlock("a\nb", "ts")],
  }
  assertRoundTrip(doc)
  assertRoundTrip({ type: "doc", blocks: [createParagraph([createText("x")])] })
})

test("inline code span with embedded backticks preserves content", () => {
  const source = "Use `` `code` `` here\n"
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks[0]?.type, "paragraph")
  if (doc.blocks[0]?.type === "paragraph") {
    const codes = doc.blocks[0].children.filter(
      (node) => node.type === "text" && node.code
    )
    assert.equal(codes.length, 1)
    assert.equal(codes[0] && codes[0].type === "text" ? codes[0].text : "", "`code`")
  }
  assertParseStable(source)
  assertRoundTrip(doc)
})

test("inline code span containing a double-backtick run", () => {
  const source = "Has ``` `` ``` inside\n"
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks[0]?.type, "paragraph")
  if (doc.blocks[0]?.type === "paragraph") {
    const code = doc.blocks[0].children.find(
      (node) => node.type === "text" && node.code
    )
    assert.ok(code && code.type === "text")
    assert.equal(code.text, "``")
  }
  assertParseStable(source)
  assertRoundTrip(doc)
})

test("longer code fence wraps shorter fence body", () => {
  const source = ["````md", "```", "inner", "```", "````", ""].join("\n")
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks.length, 1)
  assert.equal(doc.blocks[0]?.type, "code_block")
  if (doc.blocks[0]?.type === "code_block") {
    assert.equal(doc.blocks[0].value, "```\ninner\n```")
    assert.equal(doc.blocks[0].language, "md")
  }
  assertParseStable(source)
  assertRoundTrip(doc)
})

test("five-backtick fence wrapping four-backtick body", () => {
  const source = ["`````", "````", "body", "````", "`````", ""].join("\n")
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks.length, 1)
  assert.equal(doc.blocks[0]?.type, "code_block")
  if (doc.blocks[0]?.type === "code_block") {
    assert.equal(doc.blocks[0].value, "````\nbody\n````")
  }
  const out = serializeMarkdown(doc)
  assert.match(out, /^`````/m)
  assertParseStable(source)
  assertRoundTrip(doc)
})

test("unterminated fence consumes to end of input", () => {
  const source = "```\nline1\nstill_open\nno_closer"
  const doc = parseMarkdown(source)
  assert.equal(doc.blocks.length, 1)
  assert.equal(doc.blocks[0]?.type, "code_block")
  if (doc.blocks[0]?.type === "code_block") {
    assert.equal(doc.blocks[0].value, "line1\nstill_open\nno_closer")
  }
  assertParseStable(source)
  assertRoundTrip(doc)
})

test("audit probe fence with embedded closer stays parse-stable", () => {
  const source = "```\nline1\n```\nstill_in_fence\n```"
  assertParseStable(source)
  const doc = parseMarkdown(source)
  // First closer ends the opening fence; trailing fence is unterminated.
  assert.ok(doc.blocks.length >= 1)
  assert.equal(doc.blocks[0]?.type, "code_block")
  if (doc.blocks[0]?.type === "code_block") {
    assert.equal(doc.blocks[0].value, "line1")
  }
  const last = doc.blocks[doc.blocks.length - 1]
  assert.equal(last?.type, "code_block")
})

test("nested bold italic serialize does not collide delimiters", () => {
  const source = "**bold *italic* bold**\n"
  const doc = parseMarkdown(source)
  const out = serializeMarkdown(doc)
  assert.equal(out.includes("*****"), false)
  assertParseStable(source)
  assertRoundTrip(doc)
  assert.match(out, /\*\*bold _italic_ bold\*\*/)
})

test("fuzz parse serialize parse identity across mixed corpus", () => {
  const corpus = [
    "Hello **bold** and *italic* and `code` and ~~strike~~.\n",
    "# Title\n\nBody paragraph.\n",
    "## H2\n\n### H3\n",
    "- one\n- two\n",
    "1. first\n2. second\n",
    "- [ ] todo\n- [x] done\n",
    "> quoted line\n",
    "```js\nconst x = 1\n```\n",
    "---\n",
    "See [docs](https://example.com).\n",
    "| a | b |\n| --- | --- |\n| 1 | 2 |\n\nAfter table.\n",
    "Use `` `code` `` here\n",
    "Has ``` `` ``` inside\n",
    "````\n```\ninner\n```\n````\n",
    "`````\n````\nbody\n````\n`````\n",
    "```\nline1\nstill_open\n",
    "```\nline1\n```\nstill_in_fence\n```",
    "**bold *italic* bold**\n",
    "Mixed:\n\n- list\n\n```\ncode\n```\n\n> quote\n",
  ]
  assert.ok(corpus.length >= 15)
  for (const source of corpus) {
    assertParseStable(source)
  }
})
