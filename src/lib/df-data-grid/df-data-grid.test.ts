import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildInitialColumnState,
  patchColumnHidden,
  patchColumnWidth,
  resolveVisibleColumns,
} from "./column-state.ts"
import { resolveEditSessionEvent } from "./edit-session.ts"
import { moveGridFocus } from "./focus.ts"
import { nextSelectionFromClick, toggleAllSelection } from "./selection.ts"

const columns = [
  { id: "name", width: 160, minWidth: 80 },
  { id: "status", width: 120, minWidth: 64, hidden: true },
  { id: "owner", width: 140, minWidth: 64 },
]

test("buildInitialColumnState copies width and hidden from column defs", () => {
  assert.deepEqual(buildInitialColumnState(columns), [
    { id: "name", width: 160, hidden: undefined },
    { id: "status", width: 120, hidden: true },
    { id: "owner", width: 140, hidden: undefined },
  ])
})

test("resolveVisibleColumns applies state overrides and drops hidden columns", () => {
  const visible = resolveVisibleColumns(
    columns,
    [
      { id: "name", width: 200 },
      { id: "status", hidden: false, width: 100 },
      { id: "owner", hidden: true },
    ],
    { width: 120, minWidth: 48 }
  )
  assert.deepEqual(
    visible.map((column) => ({ id: column.id, width: column.width })),
    [
      { id: "name", width: 200 },
      { id: "status", width: 100 },
    ]
  )
})

test("patchColumnWidth clamps through resolveVisibleColumns minWidth", () => {
  const next = patchColumnWidth([], columns, "name", 40)
  const visible = resolveVisibleColumns(columns, next, {
    width: 120,
    minWidth: 48,
  })
  assert.equal(visible.find((column) => column.id === "name")?.width, 80)
})

test("patchColumnHidden updates a single column", () => {
  const next = patchColumnHidden([], columns, "owner", true)
  assert.equal(next.find((entry) => entry.id === "owner")?.hidden, true)
  assert.equal(next.find((entry) => entry.id === "name")?.hidden, undefined)
})

test("nextSelectionFromClick supports single and multi toggle", () => {
  assert.deepEqual(
    nextSelectionFromClick({
      mode: "single",
      selectedIds: ["a"],
      rowId: "b",
      rowIndex: 1,
      rowIds: ["a", "b", "c"],
      shiftKey: false,
      anchorIndex: 0,
    }),
    { selectedIds: ["b"], anchorIndex: 1 }
  )

  assert.deepEqual(
    nextSelectionFromClick({
      mode: "multi",
      selectedIds: ["a"],
      rowId: "a",
      rowIndex: 0,
      rowIds: ["a", "b", "c"],
      shiftKey: false,
      anchorIndex: 0,
    }),
    { selectedIds: [], anchorIndex: 0 }
  )
})

test("nextSelectionFromClick applies shift range from the anchor", () => {
  assert.deepEqual(
    nextSelectionFromClick({
      mode: "multi",
      selectedIds: ["a"],
      rowId: "c",
      rowIndex: 2,
      rowIds: ["a", "b", "c", "d"],
      shiftKey: true,
      anchorIndex: 0,
    }),
    { selectedIds: ["a", "b", "c"], anchorIndex: 0 }
  )
})

test("toggleAllSelection selects all or clears when already complete", () => {
  assert.deepEqual(toggleAllSelection([], ["a", "b"]), ["a", "b"])
  assert.deepEqual(toggleAllSelection(["a", "b"], ["a", "b"]), [])
})

test("moveGridFocus handles arrows, home/end, and page keys", () => {
  const bounds = { rowCount: 10, colCount: 4, pageSize: 3 }
  assert.deepEqual(
    moveGridFocus({ rowIndex: 2, colIndex: 1 }, "ArrowUp", bounds),
    { rowIndex: 1, colIndex: 1 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 2, colIndex: 1 }, "ArrowRight", bounds),
    { rowIndex: 2, colIndex: 2 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 2, colIndex: 1 }, "Home", bounds),
    { rowIndex: 2, colIndex: 0 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 2, colIndex: 1 }, "End", bounds),
    { rowIndex: 2, colIndex: 3 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 5, colIndex: 1 }, "PageUp", bounds),
    { rowIndex: 2, colIndex: 1 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 5, colIndex: 1 }, "PageDown", bounds),
    { rowIndex: 8, colIndex: 1 }
  )
  assert.equal(
    moveGridFocus({ rowIndex: 0, colIndex: 0 }, "Enter", bounds),
    null
  )
})

test("moveGridFocus clamps at the first and last edges", () => {
  const bounds = { rowCount: 10, colCount: 4, pageSize: 3 }
  assert.deepEqual(
    moveGridFocus({ rowIndex: 0, colIndex: 1 }, "ArrowUp", bounds),
    { rowIndex: 0, colIndex: 1 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 2, colIndex: 0 }, "ArrowLeft", bounds),
    { rowIndex: 2, colIndex: 0 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 9, colIndex: 1 }, "ArrowDown", bounds),
    { rowIndex: 9, colIndex: 1 }
  )
  assert.deepEqual(
    moveGridFocus({ rowIndex: 2, colIndex: 3 }, "ArrowRight", bounds),
    { rowIndex: 2, colIndex: 3 }
  )
})

test("resolveEditSessionEvent commits on Enter and cancels on Escape", () => {
  assert.equal(
    resolveEditSessionEvent({ kind: "keydown", key: "Enter" }),
    "commit"
  )
  assert.equal(
    resolveEditSessionEvent({ kind: "keydown", key: "Escape" }),
    "cancel"
  )
  assert.equal(
    resolveEditSessionEvent({
      kind: "keydown",
      key: "Enter",
      defaultPrevented: true,
    }),
    "ignore"
  )
})

test("resolveEditSessionEvent commits on focus leaving the edit cell", () => {
  assert.equal(
    resolveEditSessionEvent({
      kind: "focusout",
      focusRemainsInCell: false,
    }),
    "commit"
  )
  assert.equal(
    resolveEditSessionEvent({
      kind: "focusout",
      focusRemainsInCell: true,
    }),
    "ignore"
  )
})
