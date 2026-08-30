/** Flat tree drop resolution for indent and outdent by pointer x offset. */

/** Horizontal pixels per depth step when resolving indent. */
export const DF_DND_TREE_INDENT_PX = 24

export type TreeFlatNode = {
  id: string
  parentId: string | null
  depth: number
}

export type TreeDropTarget = {
  targetParentId: string | null
  index: number
  depth: number
}

/** Depth from list relative pointer x, floored by the indent threshold. */
export function depthFromOffsetX(
  offsetX: number,
  indentThreshold: number = DF_DND_TREE_INDENT_PX
): number {
  if (!Number.isFinite(offsetX) || offsetX <= 0 || indentThreshold <= 0) {
    return 0
  }
  return Math.floor(offsetX / indentThreshold)
}

/** Collect a node id and every contiguous descendant in flat preorder. */
export function collectSubtreeIds(
  nodes: readonly TreeFlatNode[],
  rootId: string
): string[] {
  const ids = [rootId]
  const root = nodes.find((node) => node.id === rootId)
  if (!root) return ids
  const rootIndex = nodes.findIndex((node) => node.id === rootId)
  for (let i = rootIndex + 1; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!node || node.depth <= root.depth) break
    ids.push(node.id)
  }
  return ids
}

/** Union of subtrees for every dragged root id. */
export function collectDraggedSubtreeIds(
  nodes: readonly TreeFlatNode[],
  movingIds: readonly string[]
): Set<string> {
  const forbidden = new Set<string>()
  for (const id of movingIds) {
    for (const subtreeId of collectSubtreeIds(nodes, id)) {
      forbidden.add(subtreeId)
    }
  }
  return forbidden
}

/**
 * True when nesting under `targetParentId` would place a dragged node inside
 * its own subtree.
 */
export function isCyclicTreeParent(
  forbiddenParentIds: ReadonlySet<string>,
  targetParentId: string | null
): boolean {
  if (targetParentId == null) return false
  return forbiddenParentIds.has(targetParentId)
}

/**
 * Resolve a drop into `{ targetParentId, index, depth }` for a flat tree.
 * `insertIndex` is the gap index among nodes excluding the active id.
 * Depth is clamped to one level under the previous sibling and not above the next sibling.
 * Returns null when the resolved parent is the dragged node or any node in a dragged subtree.
 */
export function resolveTreeDrop(options: {
  nodes: readonly TreeFlatNode[]
  activeId: string
  insertIndex: number
  pointerOffsetX: number
  indentThreshold?: number
  /** Dragged roots; defaults to `[activeId]`. Subtree union is excluded as parents. */
  movingIds?: readonly string[]
}): TreeDropTarget | null {
  const indent = options.indentThreshold ?? DF_DND_TREE_INDENT_PX
  const movingIds =
    options.movingIds && options.movingIds.length > 0
      ? options.movingIds
      : [options.activeId]
  const forbiddenParents = collectDraggedSubtreeIds(options.nodes, movingIds)

  const remaining = options.nodes.filter((node) => node.id !== options.activeId)
  const insertIndex = Math.max(
    0,
    Math.min(
      Number.isFinite(options.insertIndex) ? options.insertIndex : 0,
      remaining.length
    )
  )

  if (remaining.length === 0) {
    return { targetParentId: null, index: 0, depth: 0 }
  }

  const previous = insertIndex > 0 ? remaining[insertIndex - 1] : null
  const next = insertIndex < remaining.length ? remaining[insertIndex] : null

  if (!previous) {
    return { targetParentId: null, index: 0, depth: 0 }
  }

  const maxDepth = previous.depth + 1
  const minDepth = next ? next.depth : 0
  let depth = depthFromOffsetX(options.pointerOffsetX, indent)
  depth = Math.max(minDepth, Math.min(maxDepth, depth))

  const targetParentId = parentIdForDepth(remaining, previous, depth)
  if (isCyclicTreeParent(forbiddenParents, targetParentId)) {
    return null
  }

  const index = siblingInsertIndex(remaining, insertIndex, targetParentId)
  return { targetParentId, index, depth }
}

/**
 * Move one node to a resolved tree drop target and recompute depths for its subtree.
 * Sibling order among non moved nodes is preserved.
 * A node cannot be dropped into its own subtree.
 */
export function applyTreeDrop<T extends TreeFlatNode>(
  nodes: readonly T[],
  activeId: string,
  target: TreeDropTarget | null,
  movingIds?: readonly string[]
): readonly T[] {
  if (target == null) return nodes

  const roots =
    movingIds && movingIds.length > 0 ? movingIds : [activeId]
  const forbiddenParents = collectDraggedSubtreeIds(nodes, roots)
  if (isCyclicTreeParent(forbiddenParents, target.targetParentId)) {
    return nodes
  }

  const activeIndex = nodes.findIndex((node) => node.id === activeId)
  if (activeIndex < 0) return nodes

  const active = nodes[activeIndex]
  if (!active) return nodes

  const subtreeIds = collectSubtreeIds(nodes, activeId)
  const subtreeSet = new Set(subtreeIds)
  const subtree = nodes.filter((node) => subtreeSet.has(node.id))
  const remaining = nodes.filter((node) => !subtreeSet.has(node.id))

  const depthDelta = target.depth - active.depth
  const moved = subtree.map((node) => {
    if (node.id === activeId) {
      return {
        ...node,
        parentId: target.targetParentId,
        depth: target.depth,
      }
    }
    return {
      ...node,
      depth: Math.max(0, node.depth + depthDelta),
    }
  })

  const siblingIds = remaining
    .filter((node) => node.parentId === target.targetParentId)
    .map((node) => node.id)
  const clampedIndex = Math.max(0, Math.min(target.index, siblingIds.length))

  const beforeSibling = siblingIds[clampedIndex]
  let insertAt = remaining.length
  if (beforeSibling) {
    const at = remaining.findIndex((node) => node.id === beforeSibling)
    if (at >= 0) insertAt = at
  } else if (siblingIds.length > 0) {
    const lastSibling = siblingIds[siblingIds.length - 1]
    if (lastSibling) {
      const lastIndex = remaining.findIndex((node) => node.id === lastSibling)
      if (lastIndex >= 0) {
        insertAt = lastIndex + subtreeSpanLength(remaining, lastSibling)
      }
    }
  } else {
    insertAt = flatInsertForEmptyParent(remaining, target.targetParentId)
  }

  return [
    ...remaining.slice(0, insertAt),
    ...moved,
    ...remaining.slice(insertAt),
  ]
}

function parentIdForDepth(
  remaining: readonly TreeFlatNode[],
  previous: TreeFlatNode,
  depth: number
): string | null {
  if (depth <= 0) return null
  if (depth === previous.depth + 1) return previous.id
  if (depth === previous.depth) return previous.parentId

  let cursor: TreeFlatNode | undefined = previous
  while (cursor && cursor.depth >= depth) {
    cursor = remaining.find((node) => node.id === cursor?.parentId)
  }
  if (cursor && cursor.depth === depth - 1) return cursor.id
  return previous.parentId
}

function siblingInsertIndex(
  remaining: readonly TreeFlatNode[],
  insertIndex: number,
  parentId: string | null
): number {
  let index = 0
  for (let i = 0; i < insertIndex; i += 1) {
    const node = remaining[i]
    if (node && node.parentId === parentId) index += 1
  }
  return index
}

function subtreeSpanLength(
  nodes: readonly TreeFlatNode[],
  rootId: string
): number {
  return collectSubtreeIds(nodes, rootId).length
}

function flatInsertForEmptyParent(
  remaining: readonly TreeFlatNode[],
  parentId: string | null
): number {
  if (parentId == null) return remaining.length
  const parentIndex = remaining.findIndex((node) => node.id === parentId)
  if (parentIndex < 0) return remaining.length
  let insertAt = parentIndex + 1
  const parentDepth = remaining[parentIndex]?.depth ?? 0
  for (let i = parentIndex + 1; i < remaining.length; i += 1) {
    const node = remaining[i]
    if (!node || node.depth <= parentDepth) break
    insertAt = i + 1
  }
  return insertAt
}
