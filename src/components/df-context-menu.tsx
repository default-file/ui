"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronRight } from "lucide-react"

import {
  DISMISS_NESTED_LAYER_SELECTORS,
  useAnchoredPosition,
  useControllableState,
  useDismiss,
  useIsClient,
  useIsomorphicLayoutEffect,
  type AnchorRect,
} from "../hooks"
import {
  findAction,
  initialNavState,
  reduceContextMenuNav,
  type ContextMenuActionBase,
  type ContextMenuEntry as ContextMenuEntryBase,
  type ContextMenuFocusLevel,
  type ContextMenuNavState,
  type ContextMenuSeparatorEntry,
} from "../lib/df-context-menu"
import { nearestDarkClass } from "../lib/nearest-theme"
import { cn } from "../lib/utils"
import { hasKbdShortcut, Kbd } from "./df-kbd"

const SUBMENU_OPEN_DELAY_MS = 120
const SUBMENU_CLOSE_DELAY_MS = 100
const TYPEAHEAD_RESET_MS = 500

const CONTEXT_MENU_LAYER_SELECTORS = [
  ...DISMISS_NESTED_LAYER_SELECTORS,
  '[data-df="context-menu-content"]',
] as const

type ContextMenuActionEntry = Omit<ContextMenuActionBase, "submenu"> & {
  glyph?: React.ReactNode
  onSelect?: () => void
  submenu?: ContextMenuEntry[]
}

type ContextMenuEntry = ContextMenuActionEntry | ContextMenuSeparatorEntry

function isMenuSeparator(
  entry: ContextMenuEntry
): entry is ContextMenuSeparatorEntry {
  return entry.type === "separator"
}

type MenuSession = {
  id: string
  items: ContextMenuEntry[]
  anchor: AnchorRect
  trigger: HTMLElement | null
  themeClass?: "dark" | undefined
}

type MenuListener = () => void

let imperativeSession: MenuSession | null = null
const imperativeListeners = new Set<MenuListener>()

function emitImperative() {
  for (const listener of imperativeListeners) listener()
}

function subscribeImperative(listener: MenuListener) {
  imperativeListeners.add(listener)
  return () => {
    imperativeListeners.delete(listener)
  }
}

function getImperativeSnapshot() {
  return imperativeSession
}

const EMPTY_SESSION: MenuSession | null = null

function getImperativeServerSnapshot(): MenuSession | null {
  return EMPTY_SESSION
}

function closeImperativeSession() {
  if (imperativeSession == null) return
  const trigger = imperativeSession.trigger
  imperativeSession = null
  emitImperative()
  trigger?.focus?.()
}

/** Open a portal context menu at the pointer or focused element. */
function openContextMenu(
  event: {
    preventDefault(): void
    clientX?: number
    clientY?: number
    currentTarget?: EventTarget | null
    target?: EventTarget | null
  },
  items: ContextMenuEntry[]
) {
  event.preventDefault()
  const trigger =
    event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : event.target instanceof HTMLElement
        ? event.target
        : null

  let anchor: AnchorRect
  if (
    typeof event.clientX === "number" &&
    typeof event.clientY === "number" &&
    (event.clientX !== 0 || event.clientY !== 0)
  ) {
    anchor = { x: event.clientX, y: event.clientY, width: 0, height: 0 }
  } else if (trigger) {
    const rect = trigger.getBoundingClientRect()
    anchor = {
      x: rect.left,
      y: rect.bottom,
      width: rect.width,
      height: 0,
    }
  } else {
    anchor = { x: 0, y: 0, width: 0, height: 0 }
  }

  imperativeSession = {
    id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    items,
    anchor,
    trigger,
    themeClass: nearestDarkClass(trigger),
  }
  emitImperative()
}

function menuItemDomId(menuId: string, itemId: string): string {
  return `${menuId}-item-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

type ContextMenuSurfaceProps = {
  open: boolean
  items: ContextMenuEntry[]
  anchor: AnchorRect | null
  triggerRef?: React.RefObject<HTMLElement | null> | undefined
  themeClass?: "dark" | undefined
  onClose: () => void
  onSelect?: ((item: ContextMenuActionEntry) => void) | undefined
}

function ContextMenuSurface({
  open,
  items,
  anchor,
  triggerRef,
  themeClass,
  onClose,
  onSelect,
}: ContextMenuSurfaceProps) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const submenuSurfaceRef = React.useRef<HTMLDivElement | null>(null)
  const mounted = useIsClient()
  const reactId = React.useId()
  const rootMenuId = `df-ctx-${reactId.replace(/:/g, "")}`
  const submenuMenuId = `${rootMenuId}-sub`
  const [nav, setNav] = React.useState<ContextMenuNavState>(() =>
    initialNavState(items as ContextMenuEntryBase[])
  )
  const [sessionKey, setSessionKey] = React.useState<string | null>(null)
  const typeaheadRef = React.useRef<{ query: string; timer: number | null }>({
    query: "",
    timer: null,
  })
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissRefs = React.useMemo(
    () => (triggerRef ? [contentRef, triggerRef] : [contentRef]),
    [triggerRef]
  )

  const placement = useAnchoredPosition({
    open: open && mounted,
    triggerRef,
    contentRef,
    anchorRect: anchor,
    side: "bottom",
    align: "start",
    sideOffset: 0,
    alignOffset: 0,
    matchTriggerWidth: false,
    collisionAvoidance: true,
    followScroll: true,
  })

  useDismiss(open && mounted, onClose, dismissRefs, {
    excludeSelectors: CONTEXT_MENU_LAYER_SELECTORS,
    dismissOnScroll: true,
  })

  const nextSessionKey = open
    ? `${anchor?.x ?? 0}:${anchor?.y ?? 0}:${items.map((item) => ("id" in item ? item.id : "sep")).join(",")}`
    : null

  if (nextSessionKey !== sessionKey) {
    setSessionKey(nextSessionKey)
    if (nextSessionKey == null) {
      setNav(initialNavState([]))
    } else {
      setNav(initialNavState(items as ContextMenuEntryBase[]))
    }
  }

  const focusLevel = React.useCallback((level: ContextMenuFocusLevel) => {
    const target =
      level === "submenu" ? submenuSurfaceRef.current : contentRef.current
    window.requestAnimationFrame(() => {
      target?.focus()
    })
  }, [])

  const resolveFullAction = React.useCallback(
    (
      state: ContextMenuNavState,
      itemId: string
    ): ContextMenuActionEntry | null => {
      if (state.level === "submenu" && state.openSubmenuId != null) {
        const parent = findAction(items, state.openSubmenuId)
        const child = findAction(parent?.submenu ?? [], itemId)
        return (child as ContextMenuActionEntry | null) ?? null
      }
      return (findAction(items, itemId) as ContextMenuActionEntry | null) ?? null
    },
    [items]
  )

  const applyNav = React.useCallback(
    (
      command: Parameters<typeof reduceContextMenuNav>[2],
      baseState: ContextMenuNavState = nav
    ) => {
      const baseItems = items as ContextMenuEntryBase[]
      const { state, effect } = reduceContextMenuNav(
        baseState,
        baseItems,
        command
      )
      setNav(state)

      if (effect.type === "close-root") {
        onClose()
        return
      }
      if (effect.type === "focus-level") {
        focusLevel(effect.level)
        return
      }
      if (effect.type === "activate") {
        const resolved = resolveFullAction(state, effect.itemId)
        if (resolved == null || resolved.disabled) return
        onClose()
        onSelect?.(resolved)
        resolved.onSelect?.()
      }
    },
    [focusLevel, items, nav, onClose, onSelect, resolveFullAction]
  )

  React.useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      contentRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open, sessionKey])

  React.useEffect(() => {
    const openTimer = openTimerRef
    const closeTimer = closeTimerRef
    const typeahead = typeaheadRef.current
    return () => {
      if (openTimer.current != null) clearTimeout(openTimer.current)
      if (closeTimer.current != null) clearTimeout(closeTimer.current)
      if (typeahead.timer != null) window.clearTimeout(typeahead.timer)
    }
  }, [])

  const cancelSubmenuTimers = React.useCallback(() => {
    if (openTimerRef.current != null) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleSubmenuOpen = React.useCallback(
    (id: string) => {
      cancelSubmenuTimers()
      openTimerRef.current = setTimeout(() => {
        applyNav({ type: "open-submenu-visual", id })
        openTimerRef.current = null
      }, SUBMENU_OPEN_DELAY_MS)
    },
    [applyNav, cancelSubmenuTimers]
  )

  const scheduleSubmenuClose = React.useCallback(() => {
    cancelSubmenuTimers()
    closeTimerRef.current = setTimeout(() => {
      applyNav({ type: "close-submenu" })
      closeTimerRef.current = null
    }, SUBMENU_CLOSE_DELAY_MS)
  }, [applyNav, cancelSubmenuTimers])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      applyNav({ type: "escape" })
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      applyNav({ type: "move", delta: 1 })
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      applyNav({ type: "move", delta: -1 })
      return
    }
    if (event.key === "Home") {
      event.preventDefault()
      applyNav({ type: "edge", edge: "start" })
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      applyNav({ type: "edge", edge: "end" })
      return
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      applyNav({ type: "enter-submenu" })
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      applyNav({ type: "exit-submenu" })
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      applyNav({ type: "activate" })
      return
    }

    if (
      event.key.length !== 1 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return
    }

    const typeahead = typeaheadRef.current
    if (typeahead.timer != null) window.clearTimeout(typeahead.timer)
    typeahead.query += event.key.toLowerCase()
    event.preventDefault()
    applyNav({ type: "typeahead", query: typeahead.query })
    typeahead.timer = window.setTimeout(() => {
      typeahead.query = ""
      typeahead.timer = null
    }, TYPEAHEAD_RESET_MS)
  }

  if (!mounted || !open) return null

  const rootActiveDescendant =
    nav.level === "root" && nav.rootActiveId != null
      ? menuItemDomId(rootMenuId, nav.rootActiveId)
      : undefined

  return createPortal(
    <div data-df="context-menu-portal" className={themeClass}>
      <div
        ref={contentRef}
        id={rootMenuId}
        role="menu"
        tabIndex={-1}
        aria-activedescendant={rootActiveDescendant}
        data-df="context-menu-content"
        data-side={placement.side}
        data-align={placement.align}
        className="df-context-menu"
        style={placement.style}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        {items.map((entry, index) => {
          if (isMenuSeparator(entry)) {
            return (
              <div
                key={entry.id ?? `sep-${index}`}
                role="separator"
                data-df="context-menu-separator"
              />
            )
          }

          const hasSubmenu =
            Array.isArray(entry.submenu) && entry.submenu.length > 0
          const submenuOpen = nav.openSubmenuId === entry.id
          const active =
            nav.level === "root" && nav.rootActiveId === entry.id

          return (
            <ContextMenuItemRow
              key={entry.id}
              item={entry}
              itemDomId={menuItemDomId(rootMenuId, entry.id)}
              active={active}
              submenuOpen={submenuOpen}
              submenuMenuId={submenuMenuId}
              submenuActiveId={
                submenuOpen ? nav.submenuActiveId : null
              }
              submenuLevelActive={nav.level === "submenu" && submenuOpen}
              submenuSurfaceRef={submenuSurfaceRef}
              onRootKeyDown={handleKeyDown}
              onHover={() => {
                cancelSubmenuTimers()
                applyNav({ type: "highlight-root", id: entry.id })
                if (hasSubmenu && !entry.disabled) {
                  scheduleSubmenuOpen(entry.id)
                } else {
                  scheduleSubmenuClose()
                }
              }}
              onLeaveSubmenuZone={scheduleSubmenuClose}
              onEnterSubmenuZone={() => {
                if (!hasSubmenu) return
                cancelSubmenuTimers()
                applyNav({ type: "open-submenu-visual", id: entry.id })
              }}
              onHoverSubmenuItem={(id) => {
                cancelSubmenuTimers()
                applyNav({
                  type: "hover-submenu-item",
                  parentId: entry.id,
                  id,
                })
              }}
              onSelectRoot={() => {
                cancelSubmenuTimers()
                applyNav(
                  { type: "activate" },
                  {
                    level: "root",
                    rootActiveId: entry.id,
                    openSubmenuId: null,
                    submenuActiveId: null,
                  }
                )
              }}
              onActivateSubmenuItem={(id) => {
                cancelSubmenuTimers()
                const child = findAction(entry.submenu ?? [], id)
                if (child == null || child.disabled) return
                const resolved = child as ContextMenuActionEntry
                onClose()
                onSelect?.(resolved)
                resolved.onSelect?.()
              }}
            />
          )
        })}
      </div>
    </div>,
    document.body
  )
}

type ContextMenuItemRowProps = {
  item: ContextMenuActionEntry
  itemDomId: string
  active: boolean
  submenuOpen: boolean
  submenuMenuId: string
  submenuActiveId: string | null
  submenuLevelActive: boolean
  submenuSurfaceRef: React.MutableRefObject<HTMLDivElement | null>
  onRootKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onHover: () => void
  onLeaveSubmenuZone: () => void
  onEnterSubmenuZone: () => void
  onHoverSubmenuItem: (id: string) => void
  onSelectRoot: () => void
  onActivateSubmenuItem: (id: string) => void
}

function ContextMenuItemRow({
  item,
  itemDomId,
  active,
  submenuOpen,
  submenuMenuId,
  submenuActiveId,
  submenuLevelActive,
  submenuSurfaceRef,
  onRootKeyDown,
  onHover,
  onLeaveSubmenuZone,
  onEnterSubmenuZone,
  onHoverSubmenuItem,
  onSelectRoot,
  onActivateSubmenuItem,
}: ContextMenuItemRowProps) {
  const triggerRef = React.useRef<HTMLDivElement | null>(null)
  const submenuRef = React.useRef<HTMLDivElement | null>(null)
  const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0

  const placement = useAnchoredPosition({
    open: submenuOpen && hasSubmenu,
    triggerRef,
    contentRef: submenuRef,
    side: "right",
    align: "start",
    sideOffset: 4,
    alignOffset: 0,
    matchTriggerWidth: false,
    collisionAvoidance: true,
  })

  const setSubmenuRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      submenuRef.current = node
      if (submenuOpen) {
        submenuSurfaceRef.current = node
      } else if (submenuSurfaceRef.current === node) {
        submenuSurfaceRef.current = null
      }
    },
    [submenuOpen, submenuSurfaceRef]
  )

  const submenuActiveDescendant =
    submenuLevelActive && submenuActiveId != null
      ? menuItemDomId(submenuMenuId, submenuActiveId)
      : undefined

  return (
    <div
      data-df="context-menu-item-wrap"
      onMouseEnter={onEnterSubmenuZone}
      onMouseLeave={onLeaveSubmenuZone}
    >
      <div
        ref={triggerRef}
        id={itemDomId}
        role="menuitem"
        aria-disabled={item.disabled || undefined}
        aria-haspopup={hasSubmenu ? "menu" : undefined}
        aria-expanded={hasSubmenu ? submenuOpen : undefined}
        data-df="context-menu-item"
        data-active={active ? "" : undefined}
        data-disabled={item.disabled ? "" : undefined}
        data-destructive={item.destructive ? "" : undefined}
        data-submenu={hasSubmenu ? "" : undefined}
        onMouseEnter={onHover}
        onClick={() => onSelectRoot()}
      >
        {item.glyph != null ? (
          <span data-df="context-menu-glyph" aria-hidden>
            {item.glyph}
          </span>
        ) : null}
        <span data-df="context-menu-label">{item.label}</span>
        {hasKbdShortcut(item.shortcut) ? (
          <span data-df="context-menu-shortcut">
            <Kbd size="sm">{item.shortcut}</Kbd>
          </span>
        ) : null}
        {hasSubmenu ? (
          <span data-df="context-menu-chevron" aria-hidden>
            <ChevronRight />
          </span>
        ) : null}
      </div>

      {hasSubmenu && submenuOpen && item.submenu
        ? createPortal(
            <div
              ref={setSubmenuRef}
              id={submenuMenuId}
              role="menu"
              tabIndex={-1}
              aria-activedescendant={submenuActiveDescendant}
              data-df="context-menu-content"
              data-submenu=""
              data-side={placement.side}
              data-align={placement.align}
              className="df-context-menu"
              style={placement.style}
              onMouseEnter={onEnterSubmenuZone}
              onMouseLeave={onLeaveSubmenuZone}
              onKeyDown={onRootKeyDown}
            >
              {item.submenu.map((entry, index) => {
                if (isMenuSeparator(entry)) {
                  return (
                    <div
                      key={entry.id ?? `sub-sep-${index}`}
                      role="separator"
                      data-df="context-menu-separator"
                    />
                  )
                }
                const subActive = submenuActiveId === entry.id
                return (
                  <div
                    key={entry.id}
                    id={menuItemDomId(submenuMenuId, entry.id)}
                    role="menuitem"
                    aria-disabled={entry.disabled || undefined}
                    data-df="context-menu-item"
                    data-active={subActive ? "" : undefined}
                    data-disabled={entry.disabled ? "" : undefined}
                    data-destructive={entry.destructive ? "" : undefined}
                    onMouseEnter={() => onHoverSubmenuItem(entry.id)}
                    onClick={() => onActivateSubmenuItem(entry.id)}
                  >
                    {entry.glyph != null ? (
                      <span data-df="context-menu-glyph" aria-hidden>
                        {entry.glyph}
                      </span>
                    ) : null}
                    <span data-df="context-menu-label">{entry.label}</span>
                    {hasKbdShortcut(entry.shortcut) ? (
                      <span data-df="context-menu-shortcut">
                        <Kbd size="sm">{entry.shortcut}</Kbd>
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

type ContextMenuTriggerProps = {
  className?: string
  onContextMenu?: (event: React.MouseEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  ref?: React.Ref<HTMLElement>
}

type ContextMenuProps = {
  items: ContextMenuEntry[]
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onSelect?: (item: ContextMenuActionEntry) => void
  children: React.ReactElement<ContextMenuTriggerProps>
  className?: string
}

function focusStillInContextMenu(active: Element | null): boolean {
  if (active == null) return true
  if (active === document.body) return true
  if (!(active instanceof HTMLElement)) return false
  if (!active.isConnected) return true
  return (
    active.closest('[data-df="context-menu-content"]') != null ||
    active.closest('[data-df="context-menu-portal"]') != null
  )
}

function ContextMenu({
  items,
  open,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  children,
  className,
}: ContextMenuProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const [anchor, setAnchor] = React.useState<AnchorRect | null>(null)
  const [themeClass, setThemeClass] = React.useState<"dark" | undefined>()
  const wasOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    const active = document.activeElement
    if (focusStillInContextMenu(active instanceof Element ? active : null)) {
      triggerRef.current?.focus?.()
    }
  }, [isOpen])

  const openAtPointer = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    closeImperativeSession()
    setThemeClass(nearestDarkClass(event.currentTarget as HTMLElement))
    setAnchor({
      x: event.clientX,
      y: event.clientY,
      width: 0,
      height: 0,
    })
    setOpen(true)
  }

  const openAtTrigger = (event: React.KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const node = triggerRef.current
    if (!node) return
    closeImperativeSession()
    const rect = node.getBoundingClientRect()
    setThemeClass(nearestDarkClass(node))
    setAnchor({
      x: rect.left,
      y: rect.bottom,
      width: rect.width,
      height: 0,
    })
    setOpen(true)
  }

  const child = React.Children.only(children)

  const assignTriggerRef = (node: HTMLElement | null) => {
    triggerRef.current = node
    const childRef = (
      child as React.ReactElement & { ref?: React.Ref<HTMLElement> }
    ).ref
    if (typeof childRef === "function") childRef(node)
    else if (childRef && typeof childRef === "object") {
      ;(childRef as React.MutableRefObject<HTMLElement | null>).current = node
    }
  }

  const trigger = React.cloneElement(child, {
    ref: assignTriggerRef,
    className: cn(className, child.props.className),
    onContextMenu: (event: React.MouseEvent) => {
      child.props.onContextMenu?.(event)
      if (event.defaultPrevented) return
      openAtPointer(event)
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      child.props.onKeyDown?.(event)
      if (event.defaultPrevented) return
      if (
        event.key === "ContextMenu" ||
        (event.key === "F10" && event.shiftKey)
      ) {
        openAtTrigger(event)
      }
    },
  })

  return (
    <>
      {trigger}
      <ContextMenuSurface
        open={isOpen}
        items={items}
        anchor={anchor}
        triggerRef={triggerRef}
        themeClass={themeClass}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
      />
    </>
  )
}

function ContextMenuHost() {
  const session = React.useSyncExternalStore(
    subscribeImperative,
    getImperativeSnapshot,
    getImperativeServerSnapshot
  )
  const triggerRef = React.useRef<HTMLElement | null>(null)

  useIsomorphicLayoutEffect(() => {
    triggerRef.current = session?.trigger ?? null
  }, [session])

  if (session == null) return null

  return (
    <ContextMenuSurface
      open
      items={session.items}
      anchor={session.anchor}
      triggerRef={triggerRef}
      themeClass={session.themeClass}
      onClose={closeImperativeSession}
    />
  )
}

export {
  ContextMenu,
  ContextMenuHost,
  openContextMenu,
}
export type {
  ContextMenuActionEntry,
  ContextMenuEntry,
  ContextMenuProps,
  ContextMenuSeparatorEntry,
}
