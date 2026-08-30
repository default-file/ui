import assert from "node:assert/strict"
import { test } from "node:test"

import {
  edgeActionId,
  isSeparator,
  navigableActions,
  nextActionId,
  typeaheadActionId,
  type ContextMenuEntry,
} from "./items.ts"
import {
  activeIdForLevel,
  initialNavState,
  reduceContextMenuNav,
  type ContextMenuNavState,
} from "./nav.ts"

const entries: ContextMenuEntry[] = [
  { id: "cut", label: "Cut" },
  { id: "copy", label: "Copy" },
  { type: "separator" },
  { id: "paste", label: "Paste", disabled: true },
  { id: "delete", label: "Delete", destructive: true },
]

const nested: ContextMenuEntry[] = [
  { id: "cut", label: "Cut" },
  {
    id: "share",
    label: "Share",
    submenu: [
      { id: "share-link", label: "Copy link" },
      { id: "share-email", label: "Email", disabled: true },
      { id: "share-team", label: "Team" },
    ],
  },
  { id: "delete", label: "Delete" },
]

test("isSeparator detects separator entries", () => {
  assert.equal(isSeparator({ type: "separator" }), true)
  assert.equal(isSeparator({ id: "cut", label: "Cut" }), false)
})

test("navigableActions skips separators and disabled items", () => {
  assert.deepEqual(
    navigableActions(entries).map((item) => item.id),
    ["cut", "copy", "delete"]
  )
})

test("nextActionId cycles through enabled items", () => {
  assert.equal(nextActionId(entries, null, 1), "cut")
  assert.equal(nextActionId(entries, "cut", 1), "copy")
  assert.equal(nextActionId(entries, "copy", 1), "delete")
  assert.equal(nextActionId(entries, "delete", 1), "cut")
  assert.equal(nextActionId(entries, "cut", -1), "delete")
})

test("edgeActionId returns first and last enabled ids", () => {
  assert.equal(edgeActionId(entries, "start"), "cut")
  assert.equal(edgeActionId(entries, "end"), "delete")
})

test("typeaheadActionId matches by label prefix from the current item", () => {
  assert.equal(typeaheadActionId(entries, "c", null), "cut")
  assert.equal(typeaheadActionId(entries, "c", "cut"), "copy")
  assert.equal(typeaheadActionId(entries, "d", "copy"), "delete")
})

test("enter-submenu moves active to the first enabled child", () => {
  const start: ContextMenuNavState = {
    level: "root",
    rootActiveId: "share",
    openSubmenuId: null,
    submenuActiveId: null,
  }
  const { state, effect } = reduceContextMenuNav(start, nested, {
    type: "enter-submenu",
  })
  assert.equal(state.level, "submenu")
  assert.equal(state.openSubmenuId, "share")
  assert.equal(state.submenuActiveId, "share-link")
  assert.equal(activeIdForLevel(state), "share-link")
  assert.deepEqual(effect, { type: "focus-level", level: "submenu" })
})

test("exit-submenu returns active to the parent item", () => {
  const start: ContextMenuNavState = {
    level: "submenu",
    rootActiveId: "share",
    openSubmenuId: "share",
    submenuActiveId: "share-team",
  }
  const { state, effect } = reduceContextMenuNav(start, nested, {
    type: "exit-submenu",
  })
  assert.equal(state.level, "root")
  assert.equal(state.openSubmenuId, null)
  assert.equal(state.rootActiveId, "share")
  assert.equal(state.submenuActiveId, null)
  assert.deepEqual(effect, { type: "focus-level", level: "root" })
})

test("ArrowUp and ArrowDown stay within the active submenu level", () => {
  const start: ContextMenuNavState = {
    level: "submenu",
    rootActiveId: "share",
    openSubmenuId: "share",
    submenuActiveId: "share-link",
  }
  const down = reduceContextMenuNav(start, nested, { type: "move", delta: 1 })
  assert.equal(down.state.submenuActiveId, "share-team")
  assert.equal(down.state.level, "submenu")

  const up = reduceContextMenuNav(down.state, nested, { type: "move", delta: -1 })
  assert.equal(up.state.submenuActiveId, "share-link")
})

test("submenu navigation skips disabled items at both levels", () => {
  const rootMove = reduceContextMenuNav(initialNavState(nested), nested, {
    type: "move",
    delta: 1,
  })
  assert.equal(rootMove.state.rootActiveId, "share")

  const inSub: ContextMenuNavState = {
    level: "submenu",
    rootActiveId: "share",
    openSubmenuId: "share",
    submenuActiveId: "share-link",
  }
  const subMove = reduceContextMenuNav(inSub, nested, { type: "move", delta: 1 })
  assert.equal(subMove.state.submenuActiveId, "share-team")
})

test("escape at submenu exits without closing the root", () => {
  const start: ContextMenuNavState = {
    level: "submenu",
    rootActiveId: "share",
    openSubmenuId: "share",
    submenuActiveId: "share-link",
  }
  const { state, effect } = reduceContextMenuNav(start, nested, {
    type: "escape",
  })
  assert.equal(state.level, "root")
  assert.equal(state.rootActiveId, "share")
  assert.notEqual(effect.type, "close-root")
})

test("escape at root closes the menu", () => {
  const { effect } = reduceContextMenuNav(initialNavState(nested), nested, {
    type: "escape",
  })
  assert.deepEqual(effect, { type: "close-root" })
})
