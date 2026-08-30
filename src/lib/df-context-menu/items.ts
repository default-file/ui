export type ContextMenuSeparatorEntry = {
  type: "separator"
  id?: string
}

export type ContextMenuActionBase = {
  type?: "item"
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  destructive?: boolean
  submenu?: ContextMenuEntry[]
}

export type ContextMenuEntry =
  | ContextMenuActionBase
  | ContextMenuSeparatorEntry

export function isSeparator(
  entry: ContextMenuEntry
): entry is ContextMenuSeparatorEntry {
  return entry.type === "separator"
}

export function isAction(
  entry: ContextMenuEntry
): entry is ContextMenuActionBase {
  return !isSeparator(entry)
}

export function findAction(
  entries: ContextMenuEntry[],
  id: string | null
): ContextMenuActionBase | null {
  if (id == null) return null
  for (const entry of entries) {
    if (isAction(entry) && entry.id === id) return entry
  }
  return null
}

/** Enabled action entries in document order (top level only). */
export function navigableActions(
  entries: ContextMenuEntry[]
): ContextMenuActionBase[] {
  return entries.filter(
    (entry): entry is ContextMenuActionBase =>
      isAction(entry) && !entry.disabled
  )
}

export function nextActionId(
  entries: ContextMenuEntry[],
  currentId: string | null,
  delta: 1 | -1
): string | null {
  const items = navigableActions(entries)
  if (items.length === 0) return null
  if (currentId == null) {
    return delta === 1 ? items[0]!.id : items[items.length - 1]!.id
  }
  const index = items.findIndex((item) => item.id === currentId)
  if (index === -1) {
    return delta === 1 ? items[0]!.id : items[items.length - 1]!.id
  }
  const next = (index + delta + items.length) % items.length
  return items[next]!.id
}

export function edgeActionId(
  entries: ContextMenuEntry[],
  edge: "start" | "end"
): string | null {
  const items = navigableActions(entries)
  if (items.length === 0) return null
  return edge === "start" ? items[0]!.id : items[items.length - 1]!.id
}

/** First letter typeahead over enabled item labels. */
export function typeaheadActionId(
  entries: ContextMenuEntry[],
  query: string,
  currentId: string | null
): string | null {
  const normalized = query.toLowerCase()
  if (!normalized) return null
  const items = navigableActions(entries)
  if (items.length === 0) return null

  const start =
    currentId == null
      ? 0
      : items.findIndex((item) => item.id === currentId) + 1

  for (let offset = 0; offset < items.length; offset++) {
    const item = items[(start + offset) % items.length]!
    if (item.label.toLowerCase().startsWith(normalized)) return item.id
  }

  for (let offset = 0; offset < items.length; offset++) {
    const item = items[(start + offset) % items.length]!
    if (item.label.toLowerCase().includes(normalized)) return item.id
  }

  return null
}
