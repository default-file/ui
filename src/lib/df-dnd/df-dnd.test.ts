import assert from "node:assert/strict"
import { test } from "node:test"

import {
  DF_DND_AUTO_SCROLL_MAX_VELOCITY_PX,
  DF_DND_AUTO_SCROLL_ZONE_PX,
  autoScrollDelta,
  edgeScrollVelocity,
} from "./auto-scroll.ts"
import { startAutoScrollSession } from "./auto-scroll-runtime.ts"
import {
  dropIndicatorFromInsertIndex,
  isDropIndicatorActive,
} from "./drop-indicator.ts"
import {
  boardVisualOrder,
  moveBoardGroup,
  moveGroupInList,
  orderedDragIds,
} from "./multi-drag.ts"
import {
  indexFromPointerY,
  moveBoardItem,
  moveIndex,
} from "./reorder.ts"
import {
  DF_DND_TREE_INDENT_PX,
  applyTreeDrop,
  depthFromOffsetX,
  resolveTreeDrop,
} from "./tree.ts"

test("moveIndex reorders within a list", () => {
  assert.deepEqual(moveIndex(["a", "b", "c"], 0, 2), ["b", "c", "a"])
  assert.deepEqual(moveIndex(["a", "b", "c"], 2, 0), ["c", "a", "b"])
})

test("moveBoardItem moves across columns", () => {
  const columns = [
    {
      id: "todo",
      items: [{ id: "1" }, { id: "2" }],
    },
    {
      id: "doing",
      items: [{ id: "3" }],
    },
  ]
  const next = moveBoardItem(columns, "1", "doing", 0)
  assert.deepEqual(
    next.map((column) => ({
      id: column.id,
      items: column.items.map((item) => item.id),
    })),
    [
      { id: "todo", items: ["2"] },
      { id: "doing", items: ["1", "3"] },
    ]
  )
})

test("indexFromPointerY picks insert index from midpoints", () => {
  const rects = [
    { id: "a", top: 0, bottom: 40, height: 40 },
    { id: "b", top: 40, bottom: 80, height: 40 },
  ]
  assert.equal(indexFromPointerY(10, rects), 0)
  assert.equal(indexFromPointerY(50, rects), 1)
  assert.equal(indexFromPointerY(90, rects), 2)
})

test("edgeScrollVelocity scales inside the activation zone", () => {
  assert.equal(DF_DND_AUTO_SCROLL_ZONE_PX, 48)
  assert.equal(DF_DND_AUTO_SCROLL_MAX_VELOCITY_PX, 28)
  assert.equal(
    edgeScrollVelocity({ pointer: 0, start: 0, end: 200, zone: 40, maxVelocity: 20 }),
    -20
  )
  assert.equal(
    edgeScrollVelocity({ pointer: 20, start: 0, end: 200, zone: 40, maxVelocity: 20 }),
    -10
  )
  assert.equal(
    edgeScrollVelocity({ pointer: 100, start: 0, end: 200, zone: 40, maxVelocity: 20 }),
    0
  )
  assert.equal(
    edgeScrollVelocity({ pointer: 180, start: 0, end: 200, zone: 40, maxVelocity: 20 }),
    10
  )
  assert.equal(
    edgeScrollVelocity({ pointer: 200, start: 0, end: 200, zone: 40, maxVelocity: 20 }),
    20
  )
})

test("autoScrollDelta respects axis filters", () => {
  const both = autoScrollDelta({
    clientX: 0,
    clientY: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 200,
    zone: 40,
    maxVelocity: 20,
  })
  assert.equal(both.dx, -20)
  assert.equal(both.dy, -20)

  const xOnly = autoScrollDelta({
    clientX: 0,
    clientY: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 200,
    axis: "x",
    zone: 40,
    maxVelocity: 20,
  })
  assert.equal(xOnly.dx, -20)
  assert.equal(xOnly.dy, 0)
})

test("orderedDragIds returns selection in visual order", () => {
  assert.deepEqual(
    orderedDragIds(["a", "b", "c", "d"], new Set(["d", "b"]), "b"),
    ["b", "d"]
  )
  assert.deepEqual(
    orderedDragIds(["a", "b", "c"], new Set(["a", "c"]), "b"),
    ["b"]
  )
  assert.deepEqual(orderedDragIds(["a", "b"], undefined, "a"), ["a"])
})

test("moveGroupInList splices a selected group at the remaining-space index", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }]
  assert.deepEqual(
    moveGroupInList(items, ["b", "d"], 0).map((item) => item.id),
    ["b", "d", "a", "c", "e"]
  )
  assert.deepEqual(
    moveGroupInList(items, ["b", "d"], 3).map((item) => item.id),
    ["a", "c", "e", "b", "d"]
  )
  assert.deepEqual(
    moveGroupInList(items, ["b", "d"], 1).map((item) => item.id),
    ["a", "b", "d", "c", "e"]
  )
  assert.deepEqual(
    moveGroupInList(items, ["c"], 0).map((item) => item.id),
    ["c", "a", "b", "d", "e"]
  )
})

test("moveGroupInList drop inside the selected span preserves order without duplication", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }]
  const next = moveGroupInList(items, ["b", "c", "d"], 1)
  assert.deepEqual(
    next.map((item) => item.id),
    ["a", "b", "c", "d", "e"]
  )
  assert.equal(next.length, items.length)
  assert.deepEqual(
    [...new Set(next.map((item) => item.id))].sort(),
    ["a", "b", "c", "d", "e"]
  )
})

test("moveBoardGroup moves a multi-card payload across columns", () => {
  const columns = [
    { id: "todo", items: [{ id: "1" }, { id: "2" }, { id: "3" }] },
    { id: "doing", items: [{ id: "4" }] },
  ]
  assert.deepEqual(boardVisualOrder(columns), ["1", "2", "3", "4"])
  const next = moveBoardGroup(columns, ["1", "3"], "doing", 1)
  assert.deepEqual(
    next.map((column) => ({
      id: column.id,
      items: column.items.map((item) => item.id),
    })),
    [
      { id: "todo", items: ["2"] },
      { id: "doing", items: ["4", "1", "3"] },
    ]
  )
})

test("moveBoardGroup reorders within one column", () => {
  const columns = [
    { id: "todo", items: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] },
  ]
  const same = moveBoardGroup(columns, ["2", "3"], "todo", 0)
  assert.deepEqual(
    same[0]?.items.map((item) => item.id),
    ["2", "3", "1", "4"]
  )
})

test("dropIndicatorFromInsertIndex maps gaps to before and after", () => {
  const ids = ["a", "b", "c"]
  assert.deepEqual(dropIndicatorFromInsertIndex(0, ids), {
    targetId: "a",
    placement: "before",
  })
  assert.deepEqual(dropIndicatorFromInsertIndex(1, ids), {
    targetId: "b",
    placement: "before",
  })
  assert.deepEqual(dropIndicatorFromInsertIndex(3, ids), {
    targetId: "c",
    placement: "after",
  })
  assert.equal(
    isDropIndicatorActive(
      { targetId: "c", placement: "after" },
      "c",
      "after"
    ),
    true
  )
})

test("depthFromOffsetX floors by indent threshold", () => {
  assert.equal(DF_DND_TREE_INDENT_PX, 24)
  assert.equal(depthFromOffsetX(0), 0)
  assert.equal(depthFromOffsetX(23), 0)
  assert.equal(depthFromOffsetX(24), 1)
  assert.equal(depthFromOffsetX(48), 2)
})

test("resolveTreeDrop indents under the previous sibling", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "b", parentId: null, depth: 0 },
    { id: "c", parentId: null, depth: 0 },
  ]
  const rootGap = resolveTreeDrop({
    nodes,
    activeId: "c",
    insertIndex: 1,
    pointerOffsetX: 0,
  })
  assert.deepEqual(rootGap, {
    targetParentId: null,
    index: 1,
    depth: 0,
  })

  const indent = resolveTreeDrop({
    nodes,
    activeId: "c",
    insertIndex: 1,
    pointerOffsetX: 30,
  })
  assert.deepEqual(indent, {
    targetParentId: "a",
    index: 0,
    depth: 1,
  })
})

test("resolveTreeDrop clamps depth to the next sibling floor", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "a1", parentId: "a", depth: 1 },
    { id: "b", parentId: null, depth: 0 },
  ]
  const target = resolveTreeDrop({
    nodes,
    activeId: "b",
    insertIndex: 1,
    pointerOffsetX: 0,
  })
  assert.ok(target)
  assert.equal(target.depth, 1)
  assert.equal(target.targetParentId, "a")
})

test("resolveTreeDrop outdents the last subtree node to the grandparent level", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "a1", parentId: "a", depth: 1 },
    { id: "a1a", parentId: "a1", depth: 2 },
  ]
  const target = resolveTreeDrop({
    nodes,
    activeId: "a1a",
    insertIndex: 2,
    pointerOffsetX: DF_DND_TREE_INDENT_PX,
  })
  assert.deepEqual(target, {
    targetParentId: "a",
    index: 1,
    depth: 1,
  })
  const next = applyTreeDrop(nodes, "a1a", target)
  assert.deepEqual(
    next.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth,
    })),
    [
      { id: "a", parentId: null, depth: 0 },
      { id: "a1", parentId: "a", depth: 1 },
      { id: "a1a", parentId: "a", depth: 1 },
    ]
  )
})

test("applyTreeDrop reparents and preserves subtree order", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "b", parentId: null, depth: 0 },
    { id: "b1", parentId: "b", depth: 1 },
    { id: "c", parentId: null, depth: 0 },
  ]
  const next = applyTreeDrop(nodes, "b", {
    targetParentId: "a",
    index: 0,
    depth: 1,
  })
  assert.deepEqual(
    next.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth,
    })),
    [
      { id: "a", parentId: null, depth: 0 },
      { id: "b", parentId: "a", depth: 1 },
      { id: "b1", parentId: "b", depth: 2 },
      { id: "c", parentId: null, depth: 0 },
    ]
  )
})

test("resolveTreeDrop rejects nesting a parent under its direct child", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "a1", parentId: "a", depth: 1 },
  ]
  const target = resolveTreeDrop({
    nodes,
    activeId: "a",
    insertIndex: 1,
    pointerOffsetX: DF_DND_TREE_INDENT_PX * 2,
  })
  assert.equal(target, null)
  assert.equal(
    applyTreeDrop(nodes, "a", {
      targetParentId: "a1",
      index: 0,
      depth: 1,
    }),
    nodes
  )
})

test("resolveTreeDrop rejects nesting a parent under a deep descendant", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "a1", parentId: "a", depth: 1 },
    { id: "a1a", parentId: "a1", depth: 2 },
  ]
  const target = resolveTreeDrop({
    nodes,
    activeId: "a",
    insertIndex: 2,
    pointerOffsetX: DF_DND_TREE_INDENT_PX * 3,
  })
  assert.equal(target, null)
  assert.equal(
    applyTreeDrop(nodes, "a", {
      targetParentId: "a1a",
      index: 0,
      depth: 3,
    }),
    nodes
  )
})

test("resolveTreeDrop rejects nesting a node under itself", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "b", parentId: null, depth: 0 },
  ]
  assert.equal(
    applyTreeDrop(nodes, "a", {
      targetParentId: "a",
      index: 0,
      depth: 1,
    }),
    nodes
  )
  assert.equal(applyTreeDrop(nodes, "a", null), nodes)
})

test("resolveTreeDrop rejects targets inside any multi-selected subtree", () => {
  const nodes = [
    { id: "a", parentId: null, depth: 0 },
    { id: "a1", parentId: "a", depth: 1 },
    { id: "x", parentId: null, depth: 0 },
    { id: "y", parentId: null, depth: 0 },
  ]
  const target = resolveTreeDrop({
    nodes,
    activeId: "x",
    movingIds: ["a", "x"],
    insertIndex: 2,
    pointerOffsetX: DF_DND_TREE_INDENT_PX * 2,
  })
  assert.equal(target, null)
  assert.equal(
    applyTreeDrop(
      nodes,
      "x",
      { targetParentId: "a1", index: 0, depth: 2 },
      ["a", "x"]
    ),
    nodes
  )
})

test("auto-scroll session stop prevents further scheduled ticks", () => {
  let scheduled = 0
  const frame: { callback: FrameRequestCallback | null } = { callback: null }
  let nextId = 1
  const live = new Set<number>()
  const originalRaf = globalThis.requestAnimationFrame
  const originalCancel = globalThis.cancelAnimationFrame

  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    scheduled += 1
    const id = nextId
    nextId += 1
    frame.callback = callback
    live.add(id)
    return id
  }) as typeof requestAnimationFrame

  globalThis.cancelAnimationFrame = ((id: number) => {
    live.delete(id)
    frame.callback = null
  }) as typeof cancelAnimationFrame

  try {
    const session = startAutoScrollSession({
      getContainer: () => null,
    })
    assert.equal(scheduled, 1)
    const stale = frame.callback
    assert.ok(stale)
    session.stop()
    const afterStop = scheduled
    stale(0)
    frame.callback?.(0)
    assert.equal(scheduled, afterStop)
    session.updatePointer(0, 0)
    assert.equal(scheduled, afterStop)
  } finally {
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCancel
  }
})
