"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import {
  DISMISS_NESTED_LAYER_SELECTORS,
  useAnchoredPosition,
  useControllableState,
  useDismiss,
  useIsClient,
  useIsomorphicLayoutEffect,
  useNearestDarkClass,
  usePresence,
  type Align,
  type Side,
} from "../hooks"
import {
  dfPaddingChromeStyle,
  resolvePaddingSides,
  type PaddingChromeProps,
} from "../lib/padding-chrome"
import { cn, composeEventHandlers, composeRefs } from "../lib/utils"
import { hasKbdShortcut, Kbd } from "./df-kbd"
import {
  ListItem,
  ListItemSubmenuChevron,
  LIST_ITEM_INTERACTIVE_HOST_SELECTOR,
  type ListItemLeading,
  type ListItemProps,
  type ListItemSize,
} from "./df-list-item"
import { ScrollArea } from "./df-scroll-area"

const DEFAULT_SUBMENU_CLOSE_DELAY = 60

function hasHeaderLeading(leading: React.ReactNode | undefined): boolean {
  return leading != null && leading !== false
}

type DropdownMenuSurfaceChromeProps = {
  background?: string | undefined
  foreground?: string | undefined
  borderColor?: string | undefined
  borderWidth?: string | undefined
  borderStyle?: string | undefined
  radius?: string | undefined
  /** Panel shadow. Off by default. Pass a kit elevation token, or none or false. */
  shadow?: string | false | undefined
  dividerColor?: string | undefined
}

function resolveDropdownMenuShadow(
  shadow: string | false | undefined
): string | undefined {
  if (shadow === false || shadow === "none") return "none"
  if (shadow == null) return undefined
  return shadow
}

function dropdownMenuSurfaceChromeStyle({
  background,
  foreground,
  borderColor,
  borderWidth,
  borderStyle,
  radius,
  shadow,
  dividerColor,
}: DropdownMenuSurfaceChromeProps): React.CSSProperties {
  const resolvedShadow = resolveDropdownMenuShadow(shadow)
  return {
    ...(background != null ? { "--df-dropdown-menu-bg": background } : null),
    ...(foreground != null ? { "--df-dropdown-menu-fg": foreground } : null),
    ...(borderColor != null
      ? { "--df-dropdown-menu-border-color": borderColor }
      : null),
    ...(borderWidth != null
      ? { "--df-dropdown-menu-border-width": borderWidth }
      : null),
    ...(borderStyle != null
      ? { "--df-dropdown-menu-border-style": borderStyle }
      : null),
    ...(radius != null ? { "--df-dropdown-menu-radius": radius } : null),
    ...(resolvedShadow != null
      ? { "--df-dropdown-menu-shadow": resolvedShadow }
      : null),
    ...(dividerColor != null
      ? { "--df-dropdown-menu-divider-color": dividerColor }
      : null),
  } as React.CSSProperties
}

type DropdownMenuItemTone = "default" | "success" | "destructive"

type DropdownMenuContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  menuId: string
  labelId: string
  hasLabel: boolean
  setHasLabel: (value: boolean) => void
  closeOnSelect: boolean
  restoreFocusRef: React.MutableRefObject<boolean>
}

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null)

function useDropdownMenuContext() {
  const ctx = React.useContext(DropdownMenuContext)
  if (!ctx) {
    throw new Error("DropdownMenu components must be used within DropdownMenu")
  }
  return ctx
}

const DropdownMenuItemSizeContext = React.createContext<ListItemSize | null>(
  null
)

type DropdownMenuSubmenuMotion = {
  animated: boolean
  openDuration?: number | undefined
  closeDuration?: number | undefined
}

type DropdownMenuSubmenuState = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  setTriggerNode: (node: HTMLElement | null) => void
  cancelClose: () => void
  scheduleClose: () => void
  motion: DropdownMenuSubmenuMotion
}

const DropdownMenuSubmenuStateContext =
  React.createContext<DropdownMenuSubmenuState | null>(null)
const DropdownMenuSubmenuTriggerZoneContext = React.createContext(false)

type DropdownMenuProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  closeOnSelect?: boolean
  children: React.ReactNode
}

function DropdownMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  closeOnSelect = true,
  children,
}: DropdownMenuProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const restoreFocusRef = React.useRef(true)
  const menuId = React.useId()
  const labelId = React.useId()
  const [hasLabel, setHasLabel] = React.useState(false)

  return (
    <DropdownMenuContext.Provider
      value={{
        open: isOpen,
        setOpen,
        triggerRef,
        menuId,
        labelId,
        hasLabel,
        setHasLabel,
        closeOnSelect,
        restoreFocusRef,
      }}
    >
      {children}
    </DropdownMenuContext.Provider>
  )
}

function DropdownMenuTrigger({
  children,
  render,
  className,
  onClick,
  onKeyDown,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { open, setOpen, triggerRef, menuId, restoreFocusRef } =
    useDropdownMenuContext()

  const onTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    composeEventHandlers(onClick, () => {
      restoreFocusRef.current = true
      setOpen(!open)
    })(event)
  }

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    composeEventHandlers(onKeyDown, (nextEvent) => {
      if (nextEvent.key === "Enter" || nextEvent.key === " ") {
        nextEvent.preventDefault()
        restoreFocusRef.current = true
        setOpen(!open)
        return
      }
      if (nextEvent.key === "ArrowDown") {
        nextEvent.preventDefault()
        restoreFocusRef.current = true
        if (!open) setOpen(true)
        return
      }
      if (nextEvent.key === "Escape" && open) {
        nextEvent.preventDefault()
        restoreFocusRef.current = true
        setOpen(false)
      }
    })(event)
  }

  const shared = {
    ref: triggerRef as React.Ref<HTMLButtonElement>,
    "data-df-dropdown-menu-trigger": "",
    "aria-expanded": open,
    "aria-haspopup": "menu" as const,
    "aria-controls": open ? menuId : undefined,
  }

  if (render) {
    const renderProps = render.props as {
      className?: string
      children?: React.ReactNode
      onClick?: (event: React.MouseEvent<HTMLElement>) => void
      onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void
    }
    return React.cloneElement(render, {
      ...props,
      ...shared,
      className: cn(className, renderProps.className),
      children: children ?? renderProps.children,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        renderProps.onClick?.(event)
        if (event.defaultPrevented) return
        onTriggerClick(event as React.MouseEvent<HTMLButtonElement>)
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        renderProps.onKeyDown?.(event)
        if (event.defaultPrevented) return
        onTriggerKeyDown(event as React.KeyboardEvent<HTMLButtonElement>)
      },
    } as never)
  }

  return (
    <button
      type="button"
      data-df="dropdown-menu-trigger"
      {...props}
      {...shared}
      className={cn(className)}
      onClick={onTriggerClick}
      onKeyDown={onTriggerKeyDown}
    >
      {children}
    </button>
  )
}

/** Panel width: hug content, fill the trigger width, or a fixed CSS length. */
type DropdownMenuWidth = "hug" | "fill" | (string & {})

function resolveDropdownMenuWidth(width: DropdownMenuWidth | undefined): {
  mode: "hug" | "fill" | "fixed"
  style?: React.CSSProperties
} {
  if (width == null || width === "hug") return { mode: "hug" }
  if (width === "fill") return { mode: "fill" }
  return {
    mode: "fixed",
    style: { "--df-dropdown-menu-width": width } as React.CSSProperties,
  }
}

type DropdownMenuContentProps = React.HTMLAttributes<HTMLDivElement> &
  DropdownMenuSurfaceChromeProps &
  PaddingChromeProps & {
    align?: Align
    alignOffset?: number
    side?: Side
    sideOffset?: number
    /** Panel width: hug, fill, or a CSS length. */
    width?: DropdownMenuWidth
    matchTriggerWidth?: boolean
    portal?: boolean
    dismissOnScroll?: boolean
    followScroll?: boolean
    collisionAvoidance?: boolean
    animated?: boolean
    openDuration?: number
    closeDuration?: number
    gap?: string
    /** Default List Item density for rows in this panel. Per item size wins. */
    itemSize?: ListItemSize
  }

function getMenuItems(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[]
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      `${LIST_ITEM_INTERACTIVE_HOST_SELECTOR}[role="menuitem"]`
    )
  )
}

function menuItemText(item: HTMLElement): string {
  return (item.textContent ?? "").trim().toLowerCase()
}

function DropdownMenuContent({
  className,
  style: styleProp,
  align = "end",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  width = "hug",
  matchTriggerWidth: matchTriggerWidthProp,
  portal = true,
  dismissOnScroll = true,
  followScroll = true,
  collisionAvoidance = true,
  animated = true,
  openDuration,
  closeDuration,
  background,
  foreground,
  borderColor,
  borderWidth,
  borderStyle,
  radius,
  shadow,
  dividerColor,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  gap,
  itemSize,
  children,
  onKeyDown,
  onAnimationEnd,
  ...props
}: DropdownMenuContentProps) {
  const { open, setOpen, triggerRef, restoreFocusRef } = useDropdownMenuContext()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const { present, onExitAnimationEnd } = usePresence(open, { animated })
  const portalThemeClass = useNearestDarkClass(triggerRef, present && portal)
  const mounted = useIsClient()
  const didInitialFocusRef = React.useRef(false)
  const wasOpenRef = React.useRef(false)
  const typeaheadRef = React.useRef<{ query: string; timer: number | null }>({
    query: "",
    timer: null,
  })
  const resolvedWidth = resolveDropdownMenuWidth(width)
  const matchTriggerWidth =
    matchTriggerWidthProp ?? resolvedWidth.mode === "fill"

  const placement = useAnchoredPosition({
    open: present && portal,
    triggerRef,
    contentRef,
    side,
    align,
    sideOffset,
    alignOffset,
    matchTriggerWidth,
    collisionAvoidance,
    followScroll,
  })

  useDismiss(open && portal, () => {
    restoreFocusRef.current = true
    setOpen(false)
  }, [triggerRef, contentRef], {
    excludeSelectors: DISMISS_NESTED_LAYER_SELECTORS,
    dismissOnScroll,
  })

  React.useEffect(() => {
    if (open && present) {
      wasOpenRef.current = true
      if (!didInitialFocusRef.current) {
        didInitialFocusRef.current = true
        const items = getMenuItems(contentRef.current)
        items[0]?.focus()
      }
      return
    }
    if (open || !wasOpenRef.current) return
    wasOpenRef.current = false
    didInitialFocusRef.current = false
    const shouldRestore = restoreFocusRef.current
    restoreFocusRef.current = true
    if (!shouldRestore) return
    const active = document.activeElement
    if (
      active == null ||
      active === document.body ||
      contentRef.current?.contains(active)
    ) {
      triggerRef.current?.focus?.()
    }
  }, [open, present, restoreFocusRef, triggerRef])

  React.useEffect(() => {
    const typeahead = typeaheadRef.current
    return () => {
      if (typeahead.timer != null) window.clearTimeout(typeahead.timer)
    }
  }, [])

  if (!mounted || !present) return null

  const chromeStyle = {
    ...dropdownMenuSurfaceChromeStyle({
      background,
      foreground,
      borderColor,
      borderWidth,
      borderStyle,
      radius,
      shadow,
      dividerColor,
    }),
    ...dfPaddingChromeStyle(
      "--df-dropdown-menu-padding",
      resolvePaddingSides({
        padding,
        paddingX,
        paddingY,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      })
    ),
    ...(gap != null ? { "--df-dropdown-menu-gap": gap } : null),
    ...(openDuration != null
      ? { "--df-dropdown-menu-open-duration": `${openDuration}ms` }
      : null),
    ...(closeDuration != null
      ? { "--df-dropdown-menu-close-duration": `${closeDuration}ms` }
      : null),
    ...resolvedWidth.style,
  } as React.CSSProperties

  const viewportMaxWidth =
    "min(calc(100vw - 4 * var(--spacing-unit, 0.25rem)), var(--df-dropdown-menu-max-width))"
  const fixedMaxWidth =
    "min(calc(100vw - 4 * var(--spacing-unit, 0.25rem)), var(--df-dropdown-menu-width))"
  const layoutStyle: React.CSSProperties = portal
    ? {
        ...placement.style,
        ...(matchTriggerWidth
          ? null
          : resolvedWidth.mode === "fixed"
            ? {
                width: "var(--df-dropdown-menu-width)",
                minWidth: "var(--df-dropdown-menu-width)",
                maxWidth: fixedMaxWidth,
              }
            : {
                width: "max-content",
                minWidth: "var(--df-dropdown-menu-min-width)",
                maxWidth: viewportMaxWidth,
              }),
      }
    : {
        position: "relative",
        ...(resolvedWidth.mode === "fixed"
          ? {
              width: "var(--df-dropdown-menu-width)",
              minWidth: "var(--df-dropdown-menu-width)",
              maxWidth: fixedMaxWidth,
            }
          : matchTriggerWidth
            ? {
                width: "100%",
                minWidth: "var(--df-dropdown-menu-min-width)",
              }
            : {
                width: "max-content",
                minWidth: "var(--df-dropdown-menu-min-width)",
                maxWidth: viewportMaxWidth,
              }),
      }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = getMenuItems(contentRef.current)
    if (items.length === 0) return

    const active = document.activeElement
    const index = items.findIndex((item) => item === active)

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const next = index < 0 ? 0 : (index + 1) % items.length
      items[next]?.focus()
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      const next =
        index < 0
          ? items.length - 1
          : (index - 1 + items.length) % items.length
      items[next]?.focus()
      return
    }
    if (event.key === "Home") {
      event.preventDefault()
      items[0]?.focus()
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      items[items.length - 1]?.focus()
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      restoreFocusRef.current = true
      setOpen(false)
      return
    }
    if (event.key === "Tab") {
      restoreFocusRef.current = false
      setOpen(false)
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
    const query = typeahead.query
    const match =
      items.find((item) => menuItemText(item).startsWith(query)) ??
      items.find((item) => menuItemText(item).includes(query))
    if (match) {
      event.preventDefault()
      match.focus()
    }
    typeahead.timer = window.setTimeout(() => {
      typeahead.query = ""
      typeahead.timer = null
    }, 500)
  }

  const panel = (
    <DropdownMenuItemSizeContext.Provider value={itemSize ?? null}>
      <div
        {...props}
        ref={contentRef}
        data-df="dropdown-menu-content"
        data-scroll="kit"
        data-width={resolvedWidth.mode}
        data-side={placement.side}
        data-align={placement.align}
        data-state={open ? "open" : "closed"}
        data-animated={animated ? "true" : "false"}
        data-portal={portal ? "true" : "false"}
        data-item-size={itemSize}
        className={cn(className)}
        style={{ ...layoutStyle, ...chromeStyle, ...styleProp }}
        onKeyDown={(event) => {
          composeEventHandlers(onKeyDown, handleKeyDown)(event)
        }}
        onAnimationEnd={(event) => {
          composeEventHandlers(onAnimationEnd, onExitAnimationEnd)(event)
        }}
      >
        {children}
      </div>
    </DropdownMenuItemSizeContext.Provider>
  )

  if (!portal) return panel

  return createPortal(
    <div data-df="dropdown-menu-portal" className={portalThemeClass}>
      {panel}
    </div>,
    document.body
  )
}

type DropdownMenuHeaderProps = React.ComponentProps<"div"> &
  PaddingChromeProps & {
    leading?: React.ReactNode
    title?: React.ReactNode
    description?: React.ReactNode
    meta?: React.ReactNode
    trailing?: React.ReactNode
    background?: string
    gap?: string
    titleColor?: string
    titleSize?: string
    titleWeight?: string
    descriptionColor?: string
    descriptionSize?: string
    dividerColor?: string
  }

function DropdownMenuHeader({
  className,
  style: styleProp,
  leading,
  title,
  description,
  meta,
  trailing,
  background,
  gap,
  titleColor,
  titleSize,
  titleWeight,
  descriptionColor,
  descriptionSize,
  dividerColor,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  children,
  ...props
}: DropdownMenuHeaderProps) {
  const { labelId, setHasLabel } = useDropdownMenuContext()

  useIsomorphicLayoutEffect(() => {
    const labelled = title != null
    setHasLabel(labelled)
    return () => setHasLabel(false)
  }, [setHasLabel, title])

  const chromeStyle = {
    ...(background != null
      ? { "--df-dropdown-menu-header-bg": background }
      : null),
    ...(gap != null ? { "--df-dropdown-menu-header-gap": gap } : null),
    ...(titleColor != null
      ? { "--df-dropdown-menu-title-color": titleColor }
      : null),
    ...(titleSize != null
      ? { "--df-dropdown-menu-title-size": titleSize }
      : null),
    ...(titleWeight != null
      ? { "--df-dropdown-menu-title-weight": titleWeight }
      : null),
    ...(descriptionColor != null
      ? { "--df-dropdown-menu-description-color": descriptionColor }
      : null),
    ...(descriptionSize != null
      ? { "--df-dropdown-menu-description-size": descriptionSize }
      : null),
    ...(dividerColor != null
      ? { "--df-dropdown-menu-divider-color": dividerColor }
      : null),
    ...dfPaddingChromeStyle(
      "--df-dropdown-menu-header-padding",
      resolvePaddingSides({
        padding,
        paddingX,
        paddingY,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      })
    ),
    ...styleProp,
  } as React.CSSProperties

  return (
    <div
      data-df="dropdown-menu-header"
      className={cn(className)}
      style={chromeStyle}
      {...props}
    >
      {hasHeaderLeading(leading) ||
      title != null ||
      description != null ||
      meta != null ||
      trailing != null ? (
        <div data-df="dropdown-menu-header-row">
          {hasHeaderLeading(leading) ? (
            <div data-df="dropdown-menu-header-leading">{leading}</div>
          ) : null}
          {title != null || description != null || meta != null ? (
            <div data-df="dropdown-menu-header-copy">
              {title != null ? (
                <div data-df="dropdown-menu-header-title" id={labelId}>
                  {title}
                </div>
              ) : null}
              {description != null ? (
                <div data-df="dropdown-menu-header-description">
                  {description}
                </div>
              ) : null}
              {meta != null ? (
                <div data-df="dropdown-menu-header-meta">{meta}</div>
              ) : null}
            </div>
          ) : null}
          {trailing != null ? (
            <div data-df="dropdown-menu-header-trailing">{trailing}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

type DropdownMenuBodyProps = React.ComponentProps<"div"> &
  PaddingChromeProps & {
    gap?: string
    /** Apply maxHeight for an intentional height cap. */
    scrollable?: boolean
    /** Height constraint when scrollable is true. */
    maxHeight?: string | number
    /** Space on each side of the scrollbar thumb, in pixels. */
    scrollThumbGap?: number
  }

function DropdownMenuBody({
  className,
  style: styleProp,
  gap,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  scrollable = false,
  maxHeight = "var(--df-dropdown-menu-body-max-height)",
  scrollThumbGap,
  children,
  ...props
}: DropdownMenuBodyProps) {
  const { menuId, labelId, hasLabel } = useDropdownMenuContext()

  const chromeStyle = {
    ...(gap != null ? { "--df-dropdown-menu-body-gap": gap } : null),
    ...(scrollThumbGap != null
      ? {
          "--df-dropdown-menu-scroll-thumb-gap": `${scrollThumbGap}px`,
        }
      : null),
    ...dfPaddingChromeStyle(
      "--df-dropdown-menu-body-padding",
      resolvePaddingSides({
        padding,
        paddingX,
        paddingY,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      })
    ),
    ...styleProp,
  } as React.CSSProperties

  return (
    <div
      {...props}
      id={menuId}
      role="menu"
      aria-labelledby={hasLabel ? labelId : undefined}
      data-df="dropdown-menu-body"
      data-scrollable={scrollable ? "" : undefined}
      className={cn("min-h-0", className)}
      style={chromeStyle}
    >
      <ScrollArea
        visibility="always"
        style={scrollable ? { maxHeight } : undefined}
      >
        {children}
      </ScrollArea>
    </div>
  )
}

type DropdownMenuItemProps = Omit<
  ListItemProps,
  "highlighted" | "open" | "as"
> & {
  tone?: DropdownMenuItemTone
  onSelect?: (event: Event) => void
  leading?: ListItemLeading
  size?: ListItemSize
  shortcut?: string
}

const DropdownMenuItem = React.forwardRef<HTMLElement, DropdownMenuItemProps>(
  function DropdownMenuItem(
    {
      className,
      children,
      disabled,
      readOnly,
      leading,
      secondary,
      layout = "inline",
      trailing,
      tone = "default",
      size: sizeProp,
      variant = "accent",
      asChild = false,
      selected = false,
      indicator: indicatorProp,
      shortcut,
      onSelect,
      onClick,
      onKeyDown,
      onMouseEnter,
      ...props
    },
    ref
  ) {
    const { setOpen, closeOnSelect, restoreFocusRef } = useDropdownMenuContext()
    const contentItemSize = React.useContext(DropdownMenuItemSizeContext)
    const size = sizeProp ?? contentItemSize ?? "md"
    const submenu = React.useContext(DropdownMenuSubmenuStateContext)
    const inTriggerZone = React.useContext(
      DropdownMenuSubmenuTriggerZoneContext
    )
    const isSubmenuTrigger = Boolean(submenu && inTriggerZone)
    const showIndicator =
      isSubmenuTrigger ? false : (indicatorProp ?? selected)

    const shortcutNode = hasKbdShortcut(shortcut) ? (
      <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
    ) : null
    const chevron =
      isSubmenuTrigger && trailing == null ? <ListItemSubmenuChevron /> : null
    const resolvedTrailing =
      trailing != null
        ? shortcutNode != null
          ? (
              <>
                {shortcutNode}
                {trailing}
              </>
            )
          : trailing
        : shortcutNode != null || chevron != null
          ? (
              <>
                {shortcutNode}
                {chevron}
              </>
            )
          : undefined

    const setItemRef = React.useCallback(
      (node: HTMLElement | null) => {
        if (isSubmenuTrigger && submenu) {
          submenu.setTriggerNode(node)
        }
      },
      [isSubmenuTrigger, submenu]
    )

    const activate = (event: React.SyntheticEvent<HTMLElement>) => {
      if (disabled || readOnly) {
        event.preventDefault()
        return
      }
      if (isSubmenuTrigger) {
        submenu?.cancelClose()
        submenu?.setOpen(true)
        return
      }
      const selectEvent = new Event("dropdown-menu-select", {
        bubbles: true,
        cancelable: true,
      })
      onSelect?.(selectEvent)
      if (selectEvent.defaultPrevented) return
      if (closeOnSelect) {
        restoreFocusRef.current = true
        setOpen(false)
      }
    }

    return (
      <ListItem
        {...props}
        ref={composeRefs(ref, setItemRef)}
        as={asChild ? undefined : "button"}
        asChild={asChild}
        role="menuitem"
        size={size}
        variant={variant}
        selected={isSubmenuTrigger ? false : selected}
        indicator={showIndicator}
        disabled={disabled}
        readOnly={readOnly}
        open={Boolean(isSubmenuTrigger && submenu?.open)}
        leading={leading}
        secondary={secondary}
        layout={layout}
        trailing={resolvedTrailing}
        aria-haspopup={isSubmenuTrigger ? "menu" : undefined}
        aria-expanded={isSubmenuTrigger ? submenu?.open : undefined}
        data-tone={tone === "default" ? undefined : tone}
        data-submenu-trigger={isSubmenuTrigger ? "" : undefined}
        tabIndex={-1}
        className={cn(className)}
        onMouseEnter={(event) => {
          composeEventHandlers(onMouseEnter, () => {
            if (isSubmenuTrigger) submenu?.cancelClose()
          })(event)
        }}
        onClick={(event) => {
          composeEventHandlers(onClick, (nextEvent) => {
            activate(nextEvent)
          })(event)
        }}
        onKeyDown={(event) => {
          composeEventHandlers(onKeyDown, (nextEvent) => {
            if (isSubmenuTrigger && nextEvent.key === "ArrowRight") {
              nextEvent.preventDefault()
              submenu?.cancelClose()
              submenu?.setOpen(true)
              return
            }
            if (nextEvent.key === "Enter" || nextEvent.key === " ") {
              nextEvent.preventDefault()
              activate(nextEvent)
            }
          })(event)
        }}
      >
        {children}
      </ListItem>
    )
  }
)

type DropdownMenuSeparatorProps = React.ComponentProps<"div"> & {
  dividerColor?: string
  marginBlock?: string
}

function DropdownMenuSeparator({
  className,
  style,
  dividerColor,
  marginBlock,
  ...props
}: DropdownMenuSeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      data-df="dropdown-menu-separator"
      className={cn(className)}
      style={
        {
          ...(dividerColor != null
            ? { "--df-dropdown-menu-divider-color": dividerColor }
            : null),
          ...(marginBlock != null
            ? { "--df-dropdown-menu-separator-margin-block": marginBlock }
            : null),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

type DropdownMenuFooterProps = Omit<
  ListItemProps,
  "selected" | "highlighted" | "open" | "as" | "indicator" | "variant"
> & {
  leading?: ListItemLeading
  size?: ListItemSize
}

function DropdownMenuFooter({
  className,
  children,
  leading = false,
  size = "sm",
  asChild = false,
  readOnly: readOnlyProp,
  fontSize,
  foreground,
  ...props
}: DropdownMenuFooterProps) {
  const readOnly = readOnlyProp ?? !asChild

  return (
    <div data-df="dropdown-menu-footer">
      <ListItem
        {...props}
        as={asChild ? undefined : "div"}
        asChild={asChild}
        variant="muted"
        size={size}
        leading={leading}
        indicator={false}
        selected={false}
        readOnly={readOnly}
        fontSize={fontSize ?? "var(--df-dropdown-menu-footer-size)"}
        foreground={foreground ?? "var(--df-dropdown-menu-footer-color)"}
        className={cn(className)}
      >
        {children}
      </ListItem>
    </div>
  )
}

type DropdownMenuShortcutProps = React.ComponentProps<"span">

function DropdownMenuShortcut({
  className,
  children,
  ...props
}: DropdownMenuShortcutProps) {
  return (
    <span
      data-df="dropdown-menu-shortcut"
      className={cn(className)}
      {...props}
    >
      <Kbd size="sm">{children}</Kbd>
    </span>
  )
}

type DropdownMenuLabelProps = React.ComponentProps<"div"> &
  PaddingChromeProps & {
    color?: string
    fontSize?: string
  }

function DropdownMenuLabel({
  className,
  style: styleProp,
  color,
  fontSize,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  ...props
}: DropdownMenuLabelProps) {
  return (
    <div
      data-df="dropdown-menu-label"
      className={cn(className)}
      style={
        {
          ...(color != null
            ? { "--df-dropdown-menu-label-color": color }
            : null),
          ...(fontSize != null
            ? { "--df-dropdown-menu-label-size": fontSize }
            : null),
          ...dfPaddingChromeStyle(
            "--df-dropdown-menu-label-padding",
            resolvePaddingSides({
              padding,
              paddingX,
              paddingY,
              paddingTop,
              paddingRight,
              paddingBottom,
              paddingLeft,
            })
          ),
          ...styleProp,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

type DropdownMenuSubmenuProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  animated?: boolean
  openDuration?: number
  closeDuration?: number
  closeDelay?: number
  children: React.ReactNode
}

function DropdownMenuSubmenu({
  open,
  defaultOpen = false,
  onOpenChange,
  animated = true,
  openDuration,
  closeDuration,
  closeDelay = DEFAULT_SUBMENU_CLOSE_DELAY,
  children,
}: DropdownMenuSubmenuProps) {
  const [isOpen, setIsOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const setTriggerNode = React.useCallback((node: HTMLElement | null) => {
    triggerRef.current = node
  }, [])

  const motion = React.useMemo<DropdownMenuSubmenuMotion>(
    () => ({
      animated,
      openDuration,
      closeDuration,
    }),
    [animated, closeDuration, openDuration]
  )

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setIsOpen(true)
  }, [setIsOpen])

  const scheduleClose = React.useCallback(() => {
    if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false)
      closeTimerRef.current = null
    }, closeDelay)
  }, [closeDelay, setIsOpen])

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const state = React.useMemo(
    () => ({
      open: isOpen,
      setOpen: setIsOpen,
      triggerRef,
      setTriggerNode,
      cancelClose,
      scheduleClose,
      motion,
    }),
    [cancelClose, isOpen, motion, scheduleClose, setIsOpen, setTriggerNode]
  )

  return (
    <DropdownMenuSubmenuStateContext.Provider value={state}>
      <DropdownMenuSubmenuTriggerZoneContext.Provider value={true}>
        <div
          data-df="dropdown-menu-submenu"
          data-state={isOpen ? "open" : "closed"}
          data-animated={motion.animated ? "true" : "false"}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {children}
        </div>
      </DropdownMenuSubmenuTriggerZoneContext.Provider>
    </DropdownMenuSubmenuStateContext.Provider>
  )
}

type DropdownMenuSubContentProps = React.HTMLAttributes<HTMLDivElement> &
  DropdownMenuSurfaceChromeProps & {
    side?: Side
    sideOffset?: number
    align?: Align
    alignOffset?: number
    portal?: boolean
    animated?: boolean
    openDuration?: number
    closeDuration?: number
  }

function DropdownMenuSubContent({
  className,
  style: styleProp,
  children,
  side = "right",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  portal = true,
  animated,
  openDuration,
  closeDuration,
  background,
  foreground,
  borderColor,
  borderWidth,
  borderStyle,
  radius,
  shadow,
  dividerColor,
  onAnimationEnd,
  onMouseEnter,
  onMouseLeave,
  onKeyDown,
  ...props
}: DropdownMenuSubContentProps) {
  const submenu = React.useContext(DropdownMenuSubmenuStateContext)
  if (!submenu) {
    throw new Error(
      "DropdownMenuSubContent must be used within DropdownMenuSubmenu"
    )
  }

  const { open, setOpen, triggerRef, motion: submenuMotion } = submenu
  const motion: DropdownMenuSubmenuMotion = {
    animated: animated ?? submenuMotion.animated,
    openDuration: openDuration ?? submenuMotion.openDuration,
    closeDuration: closeDuration ?? submenuMotion.closeDuration,
  }

  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const { present, onExitAnimationEnd } = usePresence(open, {
    animated: motion.animated,
  })
  const portalThemeClass = useNearestDarkClass(triggerRef, present && portal)
  const placement = useAnchoredPosition({
    open: present && portal,
    triggerRef,
    contentRef,
    side,
    align,
    sideOffset,
    alignOffset,
  })

  useDismiss(open && portal, () => setOpen(false), [triggerRef, contentRef], {
    excludeSelectors: DISMISS_NESTED_LAYER_SELECTORS,
  })

  const mounted = useIsClient()
  if (!mounted || !present) return null

  const chromeStyle = dropdownMenuSurfaceChromeStyle({
    background,
    foreground,
    borderColor,
    borderWidth,
    borderStyle,
    radius,
    shadow,
    dividerColor,
  })

  const motionStyle = {
    ...(motion.openDuration != null
      ? {
          "--df-dropdown-menu-submenu-open-duration": `${motion.openDuration}ms`,
        }
      : null),
    ...(motion.closeDuration != null
      ? {
          "--df-dropdown-menu-submenu-close-duration": `${motion.closeDuration}ms`,
        }
      : null),
  } as React.CSSProperties

  const panel = (
    <DropdownMenuSubmenuTriggerZoneContext.Provider value={false}>
      <div
        {...props}
        ref={contentRef}
        role="menu"
        data-df="dropdown-menu-content"
        data-scroll="kit"
        data-submenu=""
        data-side={placement.side}
        data-align={placement.align}
        data-state={open ? "open" : "closed"}
        data-animated={motion.animated ? "true" : "false"}
        data-portal={portal ? "true" : "false"}
        className={cn(className)}
        style={
          portal
            ? {
                ...placement.style,
                ...motionStyle,
                ...chromeStyle,
                ...styleProp,
                width: "max-content",
                minWidth: "var(--df-dropdown-menu-min-width)",
                maxWidth:
                  "min(calc(100vw - 4 * var(--spacing-unit, 0.25rem)), var(--df-dropdown-menu-max-width))",
              }
            : {
                ...motionStyle,
                ...chromeStyle,
                ...styleProp,
                position: "absolute",
                left: `calc(100% + ${sideOffset}px)`,
                top: alignOffset,
                zIndex: "var(--z-toast)",
                width: "max-content",
                minWidth: "var(--df-dropdown-menu-min-width)",
              }
        }
        onMouseEnter={(event) => {
          composeEventHandlers(onMouseEnter, () => {
            submenu.cancelClose()
          })(event)
        }}
        onMouseLeave={(event) => {
          composeEventHandlers(onMouseLeave, () => {
            submenu.scheduleClose()
          })(event)
        }}
        onKeyDown={(event) => {
          composeEventHandlers(onKeyDown, (nextEvent) => {
            if (nextEvent.key === "ArrowLeft" || nextEvent.key === "Escape") {
              nextEvent.preventDefault()
              nextEvent.stopPropagation()
              setOpen(false)
              triggerRef.current?.focus?.()
              return
            }

            const items = getMenuItems(contentRef.current)
            if (items.length === 0) return
            const active = document.activeElement
            const index = items.findIndex((item) => item === active)

            if (nextEvent.key === "ArrowDown") {
              nextEvent.preventDefault()
              const next = index < 0 ? 0 : (index + 1) % items.length
              items[next]?.focus()
              return
            }
            if (nextEvent.key === "ArrowUp") {
              nextEvent.preventDefault()
              const next =
                index < 0
                  ? items.length - 1
                  : (index - 1 + items.length) % items.length
              items[next]?.focus()
            }
          })(event)
        }}
        onAnimationEnd={(event) => {
          composeEventHandlers(onAnimationEnd, onExitAnimationEnd)(event)
        }}
      >
        <ScrollArea visibility="always">
          {children}
        </ScrollArea>
      </div>
    </DropdownMenuSubmenuTriggerZoneContext.Provider>
  )

  if (!portal) return panel

  return createPortal(
    <div
      data-df="dropdown-menu-portal"
      className={portalThemeClass}
    >
      {panel}
    </div>,
    document.body
  )
}

export {
  DropdownMenu,
  DropdownMenuBody,
  DropdownMenuContent,
  DropdownMenuFooter,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSubContent,
  DropdownMenuSubmenu,
  DropdownMenuTrigger,
  useDropdownMenuContext,
}

export type {
  DropdownMenuBodyProps,
  DropdownMenuContentProps,
  DropdownMenuFooterProps,
  DropdownMenuHeaderProps,
  DropdownMenuItemProps,
  DropdownMenuItemTone,
  DropdownMenuLabelProps,
  DropdownMenuProps,
  DropdownMenuSeparatorProps,
  DropdownMenuShortcutProps,
  DropdownMenuSubContentProps,
  DropdownMenuSubmenuProps,
  DropdownMenuSurfaceChromeProps,
  DropdownMenuWidth,
}
