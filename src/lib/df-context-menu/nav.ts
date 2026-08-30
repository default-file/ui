import {
  edgeActionId,
  findAction,
  isAction,
  nextActionId,
  typeaheadActionId,
  type ContextMenuEntry,
} from "./items"

export type ContextMenuFocusLevel = "root" | "submenu"

export type ContextMenuNavState = {
  level: ContextMenuFocusLevel
  rootActiveId: string | null
  openSubmenuId: string | null
  submenuActiveId: string | null
}

export type ContextMenuNavCommand =
  | { type: "move"; delta: 1 | -1 }
  | { type: "edge"; edge: "start" | "end" }
  | { type: "enter-submenu" }
  | { type: "exit-submenu" }
  | { type: "escape" }
  | { type: "activate" }
  | { type: "typeahead"; query: string }
  /** Highlight a root item without opening its submenu. */
  | { type: "highlight-root"; id: string }
  /** Open a submenu visually while keyboard focus stays on the root. */
  | { type: "open-submenu-visual"; id: string }
  | { type: "hover-submenu-item"; parentId: string; id: string }
  | { type: "close-submenu" }
  | { type: "reset"; entries: ContextMenuEntry[] }

export type ContextMenuNavEffect =
  | { type: "none" }
  | { type: "close-root" }
  | { type: "activate"; itemId: string }
  | { type: "focus-level"; level: ContextMenuFocusLevel }

export function initialNavState(
  entries: ContextMenuEntry[]
): ContextMenuNavState {
  return {
    level: "root",
    rootActiveId: edgeActionId(entries, "start"),
    openSubmenuId: null,
    submenuActiveId: null,
  }
}

export function submenuEntriesFor(
  entries: ContextMenuEntry[],
  openSubmenuId: string | null
): ContextMenuEntry[] {
  if (openSubmenuId == null) return []
  return findAction(entries, openSubmenuId)?.submenu ?? []
}

/** Active menuitem id for the keyboard focus level. */
export function activeIdForLevel(state: ContextMenuNavState): string | null {
  return state.level === "submenu" ? state.submenuActiveId : state.rootActiveId
}

function enterSubmenu(
  state: ContextMenuNavState,
  entries: ContextMenuEntry[],
  parentId: string | null
): { state: ContextMenuNavState; effect: ContextMenuNavEffect } {
  const parent = findAction(entries, parentId)
  if (
    parent == null ||
    parent.disabled ||
    parent.submenu == null ||
    parent.submenu.length === 0
  ) {
    return { state, effect: { type: "none" } }
  }
  const firstChild = edgeActionId(parent.submenu, "start")
  return {
    state: {
      level: "submenu",
      rootActiveId: parent.id,
      openSubmenuId: parent.id,
      submenuActiveId: firstChild,
    },
    effect: { type: "focus-level", level: "submenu" },
  }
}

function exitSubmenu(
  state: ContextMenuNavState
): { state: ContextMenuNavState; effect: ContextMenuNavEffect } {
  if (state.openSubmenuId == null && state.level === "root") {
    return { state, effect: { type: "none" } }
  }
  return {
    state: {
      level: "root",
      rootActiveId: state.openSubmenuId ?? state.rootActiveId,
      openSubmenuId: null,
      submenuActiveId: null,
    },
    effect: { type: "focus-level", level: "root" },
  }
}

/**
 * Pure keyboard and hover navigation for root + one submenu level.
 * Disabled items are skipped at both levels via navigableActions helpers.
 */
export function reduceContextMenuNav(
  state: ContextMenuNavState,
  entries: ContextMenuEntry[],
  command: ContextMenuNavCommand
): { state: ContextMenuNavState; effect: ContextMenuNavEffect } {
  switch (command.type) {
    case "reset":
      return {
        state: initialNavState(command.entries),
        effect: { type: "focus-level", level: "root" },
      }

    case "move": {
      if (state.level === "submenu") {
        const sub = submenuEntriesFor(entries, state.openSubmenuId)
        return {
          state: {
            ...state,
            submenuActiveId: nextActionId(sub, state.submenuActiveId, command.delta),
          },
          effect: { type: "none" },
        }
      }
      return {
        state: {
          ...state,
          rootActiveId: nextActionId(entries, state.rootActiveId, command.delta),
          openSubmenuId: null,
          submenuActiveId: null,
        },
        effect: { type: "none" },
      }
    }

    case "edge": {
      if (state.level === "submenu") {
        const sub = submenuEntriesFor(entries, state.openSubmenuId)
        return {
          state: {
            ...state,
            submenuActiveId: edgeActionId(sub, command.edge),
          },
          effect: { type: "none" },
        }
      }
      return {
        state: {
          ...state,
          rootActiveId: edgeActionId(entries, command.edge),
          openSubmenuId: null,
          submenuActiveId: null,
        },
        effect: { type: "none" },
      }
    }

    case "enter-submenu":
      return enterSubmenu(state, entries, state.rootActiveId)

    case "exit-submenu":
      return exitSubmenu(state)

    case "escape":
      if (state.level === "submenu" || state.openSubmenuId != null) {
        return exitSubmenu(state)
      }
      return { state, effect: { type: "close-root" } }

    case "activate": {
      if (state.level === "submenu") {
        const sub = submenuEntriesFor(entries, state.openSubmenuId)
        const item = findAction(sub, state.submenuActiveId)
        if (item == null || item.disabled) {
          return { state, effect: { type: "none" } }
        }
        return {
          state,
          effect: { type: "activate", itemId: item.id },
        }
      }
      const item = findAction(entries, state.rootActiveId)
      if (item == null || item.disabled) {
        return { state, effect: { type: "none" } }
      }
      if (item.submenu != null && item.submenu.length > 0) {
        return enterSubmenu(state, entries, item.id)
      }
      return {
        state,
        effect: { type: "activate", itemId: item.id },
      }
    }

    case "typeahead": {
      if (state.level === "submenu") {
        const sub = submenuEntriesFor(entries, state.openSubmenuId)
        const match = typeaheadActionId(
          sub,
          command.query,
          state.submenuActiveId
        )
        if (match == null) return { state, effect: { type: "none" } }
        return {
          state: { ...state, submenuActiveId: match },
          effect: { type: "none" },
        }
      }
      const match = typeaheadActionId(entries, command.query, state.rootActiveId)
      if (match == null) return { state, effect: { type: "none" } }
      return {
        state: {
          ...state,
          rootActiveId: match,
          openSubmenuId: null,
          submenuActiveId: null,
        },
        effect: { type: "none" },
      }
    }

    case "highlight-root": {
      const item = findAction(entries, command.id)
      if (item == null) return { state, effect: { type: "none" } }
      const keepOpen = state.openSubmenuId === item.id
      return {
        state: {
          level: "root",
          rootActiveId: item.id,
          openSubmenuId: keepOpen ? state.openSubmenuId : null,
          submenuActiveId: keepOpen ? state.submenuActiveId : null,
        },
        effect: { type: "none" },
      }
    }

    case "open-submenu-visual": {
      const item = findAction(entries, command.id)
      if (
        item == null ||
        item.disabled ||
        item.submenu == null ||
        item.submenu.length === 0
      ) {
        return {
          state: {
            level: "root",
            rootActiveId: command.id,
            openSubmenuId: null,
            submenuActiveId: null,
          },
          effect: { type: "none" },
        }
      }
      return {
        state: {
          level: "root",
          rootActiveId: item.id,
          openSubmenuId: item.id,
          submenuActiveId: edgeActionId(item.submenu, "start"),
        },
        effect: { type: "none" },
      }
    }

    case "hover-submenu-item": {
      const parent = findAction(entries, command.parentId)
      if (parent?.submenu == null) return { state, effect: { type: "none" } }
      const child = findAction(parent.submenu, command.id)
      if (child == null || child.disabled) {
        return {
          state: {
            level: "submenu",
            rootActiveId: command.parentId,
            openSubmenuId: command.parentId,
            submenuActiveId: state.submenuActiveId,
          },
          effect: { type: "focus-level", level: "submenu" },
        }
      }
      return {
        state: {
          level: "submenu",
          rootActiveId: command.parentId,
          openSubmenuId: command.parentId,
          submenuActiveId: child.id,
        },
        effect: { type: "focus-level", level: "submenu" },
      }
    }

    case "close-submenu":
      return {
        state: {
          level: "root",
          rootActiveId: state.rootActiveId,
          openSubmenuId: null,
          submenuActiveId: null,
        },
        effect: { type: "none" },
      }

  }
}

export function resolveActivateItem(
  entries: ContextMenuEntry[],
  state: ContextMenuNavState,
  itemId: string
): ContextMenuEntry | null {
  if (state.level === "submenu") {
    const sub = submenuEntriesFor(entries, state.openSubmenuId)
    return findAction(sub, itemId)
  }
  return findAction(entries, itemId)
}

export { isAction }
