"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp } from "lucide-react"

import {
  ListItem,
  ListItemLabel,
  LIST_ITEM_HOST_SELECTOR,
  LIST_ITEM_INTERACTIVE_HOST_SELECTOR,
  resolveListItemLayout,
  type ListItemChromeProps,
  type ListItemLayout,
  type ListItemProps,
} from "./df-list-item"
import { SearchInput } from "./df-search-input"
import { ScrollArea } from "./df-scroll-area"
import {
  DISMISS_NESTED_LAYER_SELECTORS,
  useAnchoredPosition,
  useControllableState,
  useDismiss,
  useIsClient,
  useIsomorphicLayoutEffect,
  useNearestDarkClass,
  usePresence,
} from "../hooks"
import { useDfStrings } from "../lib/df-intl"
import { cn, composeEventHandlers, composeRefs } from "../lib/utils"

type SelectionMode = "single" | "multiple"
type OptionListItemLayout = ListItemLayout

type OptionListWidthMode = "hug" | "fill" | "fixed"

type OptionListContextValue = {
  selectionMode: SelectionMode
  value: string | null
  values: string[]
  setValue: (value: string | null) => void
  toggleValue: (value: string) => void
  isSelected: (value: string) => boolean
  open: boolean
  setOpen: (open: boolean) => void
  openOnHover: boolean
  cancelHoverClose: () => void
  scheduleHoverClose: () => void
  triggerRef: React.RefObject<HTMLElement | null>
  listboxId: string
  activeValue: string | null
  setActiveValue: (value: string | null) => void
  optionDomId: (value: string) => string
  labelFor: (value: string | null) => React.ReactNode
  secondaryFor: (value: string | null) => React.ReactNode | null
  layoutFor: (value: string | null) => OptionListItemLayout
  registerLabel: (value: string, label: React.ReactNode) => void
  registerSecondary: (
    value: string,
    secondary: React.ReactNode | null | undefined,
    layout?: OptionListItemLayout
  ) => void
  closeOnSelect: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  widthMode: OptionListWidthMode
  submenuAnimated: boolean
  submenuOpenDuration: number
  submenuCloseDuration: number
  /** Default List Item chrome for every OptionListItem. Per item props win. */
  itemChrome?: ListItemChromeProps | undefined
}

const OptionListContext = React.createContext<OptionListContextValue | null>(
  null
)

function useOptionListContext() {
  const ctx = React.useContext(OptionListContext)
  if (!ctx) {
    throw new Error("Option List parts must be used within OptionList")
  }
  return ctx
}

const DEFAULT_SUBMENU_OPEN_DURATION = 180
const DEFAULT_SUBMENU_CLOSE_DURATION = 90
const DEFAULT_HOVER_CLOSE_DELAY = 60

type OptionListSubmenuMotion = {
  animated: boolean
  openDuration: number
  closeDuration: number
}

type OptionListSubmenuState = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  setTriggerNode: (node: HTMLElement | null) => void
  cancelClose: () => void
  scheduleClose: () => void
  motion: OptionListSubmenuMotion
}

const OptionListSubmenuStateContext =
  React.createContext<OptionListSubmenuState | null>(null)
const OptionListSubmenuTriggerZoneContext = React.createContext(false)

type OptionListSubmenuProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  animated?: boolean
  openDuration?: number
  closeDuration?: number
  closeDelay?: number
  children: React.ReactNode
}

function OptionListSubmenu({
  open,
  defaultOpen = false,
  onOpenChange,
  animated,
  openDuration,
  closeDuration,
  closeDelay = DEFAULT_HOVER_CLOSE_DELAY,
  children,
}: OptionListSubmenuProps) {
  const root = useOptionListContext()
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

  const motion = React.useMemo<OptionListSubmenuMotion>(
    () => ({
      animated: animated ?? root.submenuAnimated,
      openDuration: openDuration ?? root.submenuOpenDuration,
      closeDuration: closeDuration ?? root.submenuCloseDuration,
    }),
    [
      animated,
      closeDuration,
      openDuration,
      root.submenuAnimated,
      root.submenuCloseDuration,
      root.submenuOpenDuration,
    ]
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
    <OptionListSubmenuStateContext.Provider value={state}>
      <OptionListSubmenuTriggerZoneContext.Provider value={true}>
        <div
          data-df="option-list-submenu"
          data-state={isOpen ? "open" : "closed"}
          data-animated={motion.animated ? "true" : "false"}
          onMouseEnter={() => {
            cancelClose()
            if (root.openOnHover) root.cancelHoverClose()
          }}
          onMouseLeave={() => {
            scheduleClose()
          }}
        >
          {children}
        </div>
      </OptionListSubmenuTriggerZoneContext.Provider>
    </OptionListSubmenuStateContext.Provider>
  )
}

type OptionListSubContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  align?: "start" | "center" | "end" | "auto"
  alignOffset?: number
  portal?: boolean
  animated?: boolean
  openDuration?: number
  closeDuration?: number
}

function OptionListSubContent({
  className,
  children,
  side = "right",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  portal = true,
  animated,
  openDuration,
  closeDuration,
  onAnimationEnd,
  onMouseEnter,
  onMouseLeave,
  ...props
}: OptionListSubContentProps) {
  const root = useOptionListContext()
  const submenu = React.useContext(OptionListSubmenuStateContext)
  if (!submenu) {
    throw new Error("OptionListSubContent must be used within OptionListSubmenu")
  }

  const { open, setOpen, triggerRef, motion: submenuMotion } = submenu
  const motion: OptionListSubmenuMotion = {
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

  const motionStyle = {
    "--df-submenu-open-duration": `${motion.openDuration}ms`,
    "--df-submenu-close-duration": `${motion.closeDuration}ms`,
  } as React.CSSProperties

  const panel = (
    <OptionListSubmenuTriggerZoneContext.Provider value={false}>
      <div
        {...props}
        ref={contentRef}
        role="menu"
        data-df="option-list-content"
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
                width: "max-content",
                maxWidth:
                  "min(calc(100vw - 4 * var(--spacing-unit, 0.25rem)), var(--df-max-w-sm))",
              }
            : {
                ...motionStyle,
                position: "absolute",
                left: `calc(100% + ${sideOffset}px)`,
                top: alignOffset,
                zIndex: "var(--z-toast)",
                width: "max-content",
                minWidth: "var(--df-menu-min-width)",
              }
        }
        onMouseEnter={(event) => {
          composeEventHandlers(onMouseEnter, () => {
            submenu.cancelClose()
            if (root.openOnHover) root.cancelHoverClose()
          })(event)
        }}
        onMouseLeave={(event) => {
          composeEventHandlers(onMouseLeave, () => {
            submenu.scheduleClose()
            if (root.openOnHover) root.scheduleHoverClose()
          })(event)
        }}
        onAnimationEnd={(event) => {
          composeEventHandlers(onAnimationEnd, onExitAnimationEnd)(event)
        }}
      >
        {children}
      </div>
    </OptionListSubmenuTriggerZoneContext.Provider>
  )

  if (!portal) return panel

  return createPortal(
    <div
      data-df="option-list-portal"
      className={portalThemeClass}
    >
      {panel}
    </div>,
    document.body
  )
}

/** Root and trigger width: hug content, fill the parent, or a fixed CSS length. */
type OptionListWidth = "hug" | "fill" | (string & {})

function resolveOptionListWidth(width: OptionListWidth | undefined): {
  mode: "hug" | "fill" | "fixed"
  style?: React.CSSProperties
} {
  if (width == null || width === "hug") return { mode: "hug" }
  if (width === "fill") return { mode: "fill" }
  return {
    mode: "fixed",
    style: { "--df-option-list-width": width } as React.CSSProperties,
  }
}

type OptionListProps = {
  selectionMode?: SelectionMode | undefined
  value?: string | null | undefined
  defaultValue?: string | null | undefined
  onValueChange?: ((value: string | null) => void) | undefined
  values?: string[] | undefined
  defaultValues?: string[] | undefined
  onValuesChange?: ((values: string[]) => void) | undefined
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  /** Open on pointer enter. Click, Enter, and Space open when closed; Escape and leave close. */
  openOnHover?: boolean | undefined
  /** Delay in milliseconds before closing after pointer leave when openOnHover is true. */
  hoverCloseDelay?: number | undefined
  closeOnSelect?: boolean | undefined
  width?: OptionListWidth | undefined
  submenuAnimated?: boolean | undefined
  submenuOpenDuration?: number | undefined
  submenuCloseDuration?: number | undefined
  /** Default List Item chrome for every OptionListItem. Per item props win. */
  itemChrome?: ListItemChromeProps | undefined
  children: React.ReactNode
}

function OptionList({
  selectionMode = "single",
  value,
  defaultValue = null,
  onValueChange,
  values,
  defaultValues = [],
  onValuesChange,
  open,
  defaultOpen = false,
  onOpenChange,
  openOnHover = false,
  hoverCloseDelay = DEFAULT_HOVER_CLOSE_DELAY,
  closeOnSelect,
  width = "hug",
  submenuAnimated = true,
  submenuOpenDuration = DEFAULT_SUBMENU_OPEN_DURATION,
  submenuCloseDuration = DEFAULT_SUBMENU_CLOSE_DURATION,
  itemChrome,
  children,
}: OptionListProps) {
  const resolvedWidth = resolveOptionListWidth(width)
  const [current, setCurrent] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  })
  const [currentValues, setCurrentValues] = useControllableState({
    value: values,
    defaultValue: defaultValues,
    onChange: onValuesChange,
  })
  const [isOpen, setIsOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeValue, setActiveValue] = React.useState<string | null>(null)
  const [, setLabelsVersion] = React.useState(0)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const hoverCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const reactId = React.useId()
  const listboxId = `df-option-list-${reactId.replace(/:/g, "")}`
  const optionDomId = React.useCallback(
    (itemValue: string) =>
      `${listboxId}-opt-${itemValue.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [listboxId]
  )
  const labels = React.useRef(new Map<string, React.ReactNode>())
  const secondaries = React.useRef(new Map<string, React.ReactNode | null>())
  const layouts = React.useRef(new Map<string, OptionListItemLayout>())

  const cancelHoverClose = React.useCallback(() => {
    if (hoverCloseTimerRef.current != null) {
      clearTimeout(hoverCloseTimerRef.current)
      hoverCloseTimerRef.current = null
    }
    if (openOnHover) setIsOpen(true)
  }, [openOnHover, setIsOpen])

  const scheduleHoverClose = React.useCallback(() => {
    if (!openOnHover) return
    if (hoverCloseTimerRef.current != null) {
      clearTimeout(hoverCloseTimerRef.current)
    }
    hoverCloseTimerRef.current = setTimeout(() => {
      setIsOpen(false)
      hoverCloseTimerRef.current = null
    }, hoverCloseDelay)
  }, [hoverCloseDelay, openOnHover, setIsOpen])

  React.useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current != null) {
        clearTimeout(hoverCloseTimerRef.current)
      }
    }
  }, [])

  const resolvedCloseOnSelect =
    closeOnSelect ?? selectionMode === "single"

  const registerLabel = React.useCallback(
    (itemValue: string, label: React.ReactNode) => {
      if (labels.current.get(itemValue) === label) return
      labels.current.set(itemValue, label)
      setLabelsVersion((n) => n + 1)
    },
    []
  )

  const registerSecondary = React.useCallback(
    (
      itemValue: string,
      secondary: React.ReactNode | null | undefined,
      layout: OptionListItemLayout = "inline"
    ) => {
      const nextSecondary = secondary ?? null
      const nextLayout = resolveListItemLayout(layout, nextSecondary)
      const secondaryUnchanged =
        secondaries.current.get(itemValue) === nextSecondary
      const layoutUnchanged = layouts.current.get(itemValue) === nextLayout
      if (secondaryUnchanged && layoutUnchanged) return
      secondaries.current.set(itemValue, nextSecondary)
      layouts.current.set(itemValue, nextLayout)
      setLabelsVersion((n) => n + 1)
    },
    []
  )

  const labelFor = React.useCallback((itemValue: string | null) => {
    if (!itemValue) return null
    return labels.current.get(itemValue) ?? itemValue
  }, [])

  const secondaryFor = React.useCallback((itemValue: string | null) => {
    if (!itemValue) return null
    return secondaries.current.get(itemValue) ?? null
  }, [])

  const layoutFor = React.useCallback((itemValue: string | null) => {
    if (!itemValue) return "inline" as const
    return layouts.current.get(itemValue) ?? "inline"
  }, [])

  const isSelected = React.useCallback(
    (itemValue: string) => {
      if (selectionMode === "multiple") {
        return currentValues.includes(itemValue)
      }
      return current === itemValue
    },
    [current, currentValues, selectionMode]
  )

  const toggleValue = React.useCallback(
    (itemValue: string) => {
      if (selectionMode === "multiple") {
        setCurrentValues(
          currentValues.includes(itemValue)
            ? currentValues.filter((v) => v !== itemValue)
            : [...currentValues, itemValue]
        )
        return
      }
      setCurrent(itemValue)
    },
    [currentValues, selectionMode, setCurrent, setCurrentValues]
  )

  return (
    <OptionListContext.Provider
      value={{
        selectionMode,
        value: current,
        values: currentValues,
        setValue: setCurrent,
        toggleValue,
        isSelected,
        open: isOpen,
        setOpen: setIsOpen,
        openOnHover,
        cancelHoverClose,
        scheduleHoverClose,
        triggerRef,
        listboxId,
        activeValue,
        setActiveValue,
        optionDomId,
        labelFor,
        secondaryFor,
        layoutFor,
        registerLabel,
        registerSecondary,
        closeOnSelect: resolvedCloseOnSelect,
        searchQuery,
        setSearchQuery,
        widthMode: resolvedWidth.mode,
        submenuAnimated,
        submenuOpenDuration,
        submenuCloseDuration,
        itemChrome,
      }}
    >
      <div
        data-df="option-list"
        data-width={resolvedWidth.mode}
        style={resolvedWidth.style}
      >
        {children}
      </div>
    </OptionListContext.Provider>
  )
}

function OptionListTrigger({
  className,
  children,
  render,
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const {
    open,
    setOpen,
    openOnHover,
    cancelHoverClose,
    scheduleHoverClose,
    triggerRef,
    listboxId,
  } = useOptionListContext()

  const toggleOpen = () => setOpen(!open)

  const onTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    composeEventHandlers(onClick, () => {
      if (openOnHover) {
        if (!open) setOpen(true)
        return
      }
      toggleOpen()
    })(event)
  }

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    composeEventHandlers(onKeyDown, (nextEvent) => {
      if (nextEvent.key === "Enter" || nextEvent.key === " ") {
        nextEvent.preventDefault()
        if (openOnHover) {
          if (!open) setOpen(true)
          return
        }
        toggleOpen()
      }
      if (nextEvent.key === "ArrowDown") {
        nextEvent.preventDefault()
        if (!open) setOpen(true)
      }
      if (nextEvent.key === "Escape" && open) {
        nextEvent.preventDefault()
        setOpen(false)
      }
    })(event)
  }

  const onTriggerMouseEnter = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    composeEventHandlers(onMouseEnter, () => {
      if (openOnHover) cancelHoverClose()
    })(event)
  }

  const onTriggerMouseLeave = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    composeEventHandlers(onMouseLeave, () => {
      if (openOnHover) scheduleHoverClose()
    })(event)
  }

  if (render) {
    const renderProps = render.props as {
      role?: string
      tabIndex?: number
      className?: string
      children?: React.ReactNode
      onClick?: (event: React.MouseEvent<HTMLElement>) => void
      onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void
      onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void
      onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void
    }
    return React.cloneElement(render, {
      ...props,
      ref: triggerRef as React.Ref<HTMLElement>,
      "data-df-option-list-trigger": "",
      "aria-expanded": open,
      "aria-haspopup": "listbox",
      "aria-controls": open ? listboxId : undefined,
      role: renderProps.role ?? "button",
      tabIndex: renderProps.tabIndex ?? 0,
      className: cn(className, renderProps.className),
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
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
        renderProps.onMouseEnter?.(event)
        if (event.defaultPrevented) return
        onTriggerMouseEnter(event as React.MouseEvent<HTMLButtonElement>)
      },
      onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
        renderProps.onMouseLeave?.(event)
        if (event.defaultPrevented) return
        onTriggerMouseLeave(event as React.MouseEvent<HTMLButtonElement>)
      },
      children: children ?? renderProps.children,
    } as never)
  }

  return (
    <button
      type="button"
      className={cn(className)}
      {...props}
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      data-df="option-list-trigger"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listboxId : undefined}
      onClick={onTriggerClick}
      onKeyDown={onTriggerKeyDown}
      onMouseEnter={onTriggerMouseEnter}
      onMouseLeave={onTriggerMouseLeave}
    >
      {children}
    </button>
  )
}

function OptionListGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-df="option-list-group" className={cn(className)} {...props} />
  )
}

type OptionListSearchProps = Omit<
  React.ComponentProps<typeof SearchInput>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string | undefined
  defaultValue?: string | undefined
  onValueChange?: ((value: string) => void) | undefined
}

function OptionListSearch({
  className,
  placeholder: placeholderProp,
  value,
  defaultValue,
  onValueChange,
  size = "sm",
  clearable = true,
  ...props
}: OptionListSearchProps) {
  const s = useDfStrings()
  const placeholder = placeholderProp ?? s.optionListSearchPlaceholder
  const { searchQuery, setSearchQuery } = useOptionListContext()
  const isControlled = value !== undefined
  const current = isControlled ? value : searchQuery

  React.useEffect(() => {
    if (defaultValue == null || isControlled) return
    setSearchQuery(defaultValue)
  }, [defaultValue, isControlled, setSearchQuery])

  function commit(next: string) {
    setSearchQuery(next)
    onValueChange?.(next)
  }

  return (
    <div data-df="option-list-search" className={cn(className)}>
      <SearchInput
        {...props}
        size={size}
        clearable={clearable}
        placeholder={placeholder}
        value={current}
        onChange={(event) => commit(event.target.value)}
        onClear={() => {
          props.onClear?.()
          commit("")
        }}
      />
    </div>
  )
}

type OptionListBodyProps = React.ComponentProps<"div"> & {
  scrollable?: boolean | undefined
  maxHeight?: string | number | undefined
  /** Space on each side of the scrollbar thumb, in pixels. */
  scrollThumbGap?: number | undefined
}

function OptionListBody({
  className,
  children,
  scrollable = false,
  maxHeight = "var(--df-menu-stacked-max-height)",
  scrollThumbGap,
  style,
  ...props
}: OptionListBodyProps) {
  const gapStyle =
    scrollThumbGap != null
      ? ({
          "--df-option-list-scroll-thumb-gap": `${scrollThumbGap}px`,
        } as React.CSSProperties)
      : undefined

  if (scrollable) {
    return (
      <div
        data-df="option-list-body"
        data-scrollable=""
        className={cn("min-h-0", className)}
        {...props}
        style={{ ...gapStyle, ...style }}
      >
        <ScrollArea visibility="always" style={{ maxHeight }}>
          {children}
        </ScrollArea>
      </div>
    )
  }

  return (
    <div
      data-df="option-list-body"
      className={cn(className)}
      {...props}
      style={style}
    >
      {children}
    </div>
  )
}

/** Stable across duplicate module instances in one JS realm. */
const DF_OPTION_LIST_HEADER = Symbol.for("@default-file/ui.option-list-header")
const DF_OPTION_LIST_FOOTER = Symbol.for("@default-file/ui.option-list-footer")
const DF_OPTION_LIST_SUBMENU = Symbol.for("@default-file/ui.option-list-submenu")

function markOptionListPart<T extends object>(part: T, mark: symbol): T {
  Object.defineProperty(part, mark, { value: true })
  return part
}

function isOptionListPart(node: React.ReactNode, mark: symbol): boolean {
  if (!React.isValidElement(node)) return false
  const type = node.type as { [key: symbol]: unknown } | string
  return typeof type !== "string" && Boolean(type[mark])
}

function OptionListFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div data-df="option-list-footer" className={cn(className)} {...props}>
      {children}
    </div>
  )
}
markOptionListPart(OptionListFooter, DF_OPTION_LIST_FOOTER)

type OptionListHeaderProps = React.ComponentProps<"div"> & {
  /** Primary panel title. */
  label?: React.ReactNode
  /** Supporting copy under the label. */
  description?: React.ReactNode
  /** Injected by OptionListContent for listbox aria-labelledby. */
  labelId?: string
}

/** Panel header with an edge to edge bottom rule. */
function OptionListHeader({
  className,
  label,
  description,
  labelId,
  children,
  ...props
}: OptionListHeaderProps) {
  return (
    <div data-df="option-list-header" className={cn(className)} {...props}>
      {label != null ? (
        <div data-df="option-list-header-label" id={labelId}>
          {label}
        </div>
      ) : null}
      {description != null ? (
        <div data-df="option-list-header-description">{description}</div>
      ) : null}
      {children}
    </div>
  )
}
markOptionListPart(OptionListHeader, DF_OPTION_LIST_HEADER)
markOptionListPart(OptionListSubmenu, DF_OPTION_LIST_SUBMENU)

function resolveOptionListHeader(
  header: React.ReactNode,
  labelId: string
): { node: React.ReactNode; labelledBy?: string | undefined } {
  if (header == null) return { node: null }
  if (isOptionListPart(header, DF_OPTION_LIST_HEADER)) {
    const el = header as React.ReactElement<OptionListHeaderProps>
    const resolvedId = el.props.labelId ?? labelId
    return {
      node: React.cloneElement(el, { labelId: resolvedId }),
      labelledBy: el.props.label != null ? resolvedId : undefined,
    }
  }
  return { node: <OptionListHeader labelId={labelId}>{header}</OptionListHeader> }
}

function resolveOptionListFooter(footer: React.ReactNode): React.ReactNode {
  if (footer == null) return null
  if (isOptionListPart(footer, DF_OPTION_LIST_FOOTER)) return footer
  return <OptionListFooter>{footer}</OptionListFooter>
}

type OptionListChrome = "menu" | "plain" | "panel"

/** Panel surface chrome. Values should be CSS lengths or `var(--…)` tokens. */
type OptionListSurfaceChromeProps = {
  background?: string | undefined
  foreground?: string | undefined
  borderColor?: string | undefined
  borderWidth?: string | undefined
  borderStyle?: string | undefined
  /** Hairline rules on header, search, and footer. Defaults to var(--border). */
  dividerColor?: string | undefined
  radius?: string | undefined
}

function optionListSurfaceChromeStyle({
  background,
  foreground,
  borderColor,
  borderWidth,
  borderStyle,
  dividerColor,
  radius,
}: OptionListSurfaceChromeProps): React.CSSProperties {
  return {
    ...(background != null
      ? { "--df-option-list-surface-bg": background }
      : null),
    ...(foreground != null
      ? { "--df-option-list-surface-fg": foreground }
      : null),
    ...(borderColor != null
      ? { "--df-option-list-surface-border-color": borderColor }
      : null),
    ...(borderWidth != null
      ? { "--df-option-list-surface-border-width": borderWidth }
      : null),
    ...(borderStyle != null
      ? { "--df-option-list-surface-border-style": borderStyle }
      : null),
    ...(dividerColor != null
      ? { "--df-option-list-divider-color": dividerColor }
      : null),
    ...(radius != null
      ? { "--df-option-list-surface-radius": radius }
      : null),
  } as React.CSSProperties
}

type OptionListContentProps = React.HTMLAttributes<HTMLDivElement> &
  OptionListSurfaceChromeProps & {
    side?: "top" | "bottom" | "left" | "right"
    sideOffset?: number
    align?: "start" | "center" | "end" | "auto"
    alignOffset?: number
    alignItemWithTrigger?: boolean
    portal?: boolean
    /**
     * menu keeps popover fill, shadow, and radius.
     * plain drops those so the list can sit inside a host surface.
     * panel is a bordered card surface for always visible lists.
     */
    chrome?: OptionListChrome
    dismissOnScroll?: boolean
    search?: boolean
    searchPlaceholder?: string
    searchBackground?: string
    searchValue?: string
    defaultSearchValue?: string
    onSearchChange?: (value: string) => void
    scrollable?: boolean
    scrollMaxHeight?: string | number
    /** Space on each side of the scrollbar thumb, in pixels. */
    scrollThumbGap?: number
    /** Panel header above the options. Prefer OptionListHeader for label and description. */
    header?: React.ReactNode
    footer?: React.ReactNode
  }

function containsSubmenu(node: React.ReactNode): boolean {
  let found = false
  React.Children.forEach(node, (child) => {
    if (found || !React.isValidElement(child)) return
    if (isOptionListPart(child, DF_OPTION_LIST_SUBMENU)) {
      found = true
      return
    }
    const nested = (child.props as { children?: React.ReactNode }).children
    if (nested != null && containsSubmenu(nested)) found = true
  })
  return found
}

function scrollSelectedIntoListViewport(
  selected: HTMLElement,
  root: HTMLElement
) {
  const body = root.querySelector<HTMLElement>(
    '[data-df="option-list-body"][data-scrollable]'
  )
  if (!body || !body.contains(selected)) return

  const viewport = body.querySelector<HTMLElement>(
    '[data-df="scroll-area-viewport"]'
  )
  if (!viewport) return

  const itemRect = selected.getBoundingClientRect()
  const portRect = viewport.getBoundingClientRect()
  if (itemRect.top < portRect.top) {
    viewport.scrollTop -= portRect.top - itemRect.top
  } else if (itemRect.bottom > portRect.bottom) {
    viewport.scrollTop += itemRect.bottom - portRect.bottom
  }
}

const LIST_ITEM_TITLE_SELECTOR = '[data-df="list-item-title"]'

function navigableOptions(root: HTMLElement): HTMLElement[] {
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(LIST_ITEM_INTERACTIVE_HOST_SELECTOR)
  )
  return items.filter(
    (item) => item.closest('[data-df="option-list-content"]') === root
  )
}

function optionText(item: HTMLElement): string {
  const label = item.querySelector<HTMLElement>(LIST_ITEM_TITLE_SELECTOR)
  return (label?.textContent ?? item.textContent ?? "").trim().toLowerCase()
}

function OptionListContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger: alignItemWithTriggerProp,
  portal = true,
  chrome = "menu",
  background,
  foreground,
  borderColor,
  borderWidth,
  borderStyle,
  dividerColor,
  radius,
  dismissOnScroll = true,
  search = false,
  searchPlaceholder: searchPlaceholderProp,
  searchBackground,
  searchValue,
  defaultSearchValue,
  onSearchChange,
  scrollable,
  scrollMaxHeight,
  scrollThumbGap,
  header,
  footer,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}: OptionListContentProps) {
  const s = useDfStrings()
  const searchPlaceholder =
    searchPlaceholderProp ?? s.optionListSearchPlaceholder
  const {
    open,
    setOpen,
    openOnHover,
    cancelHoverClose,
    scheduleHoverClose,
    triggerRef,
    listboxId,
    activeValue,
    setActiveValue,
    optionDomId,
    value,
    values,
    widthMode,
  } = useOptionListContext()
  const alignItemWithTrigger =
    alignItemWithTriggerProp ??
    (widthMode === "fill" || widthMode === "fixed")
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const typeaheadRef = React.useRef<{ query: string; timer: number | null }>({
    query: "",
    timer: null,
  })
  const portalThemeClass = useNearestDarkClass(triggerRef, open && portal)
  const placement = useAnchoredPosition({
    open: open && portal,
    triggerRef,
    contentRef,
    side,
    align,
    sideOffset,
    alignOffset,
    matchTriggerWidth: alignItemWithTrigger,
  })

  useDismiss(open && portal, () => setOpen(false), [triggerRef, contentRef], {
    excludeSelectors: DISMISS_NESTED_LAYER_SELECTORS,
    dismissOnScroll,
  })

  const mounted = useIsClient()
  const hasSubmenu = React.useMemo(() => containsSubmenu(children), [children])
  const wrapInScrollArea = scrollable ?? !hasSubmenu
  const stacked = search || header != null || footer != null
  const effectiveMaxHeight =
    scrollMaxHeight ??
    (stacked
      ? "var(--df-menu-stacked-max-height)"
      : "min(60vh, var(--df-menu-max-height))")

  // Keep list order; reveal the selected option in the list scrollport.
  useIsomorphicLayoutEffect(() => {
    if (!open || !mounted) return
    const root = contentRef.current
    if (!root) return
    const selected = root.querySelector<HTMLElement>(
      `${LIST_ITEM_HOST_SELECTOR}[data-state="selected"]`
    )
    if (!selected) return
    scrollSelectedIntoListViewport(selected, root)
  }, [open, mounted])

  const moveActiveTo = React.useCallback(
    (item: HTMLElement | undefined) => {
      if (!item) return
      const next = item.getAttribute("data-value")
      if (next == null) return
      setActiveValue(next)
      const root = contentRef.current
      if (root) scrollSelectedIntoListViewport(item, root)
      else item.scrollIntoView({ block: "nearest" })
    },
    [setActiveValue]
  )

  // Set the initial active option and move focus into the list on open.
  // The guard keeps focus stable while selections change during interaction.
  const initializedRef = React.useRef(false)
  React.useEffect(() => {
    if (!open || !mounted || !portal) {
      initializedRef.current = false
      return
    }
    if (initializedRef.current) return
    initializedRef.current = true
    const root = contentRef.current
    if (!root) return
    const items = navigableOptions(root)
    const preferred = value ?? values[0] ?? null
    const initial =
      items.find((item) => item.getAttribute("data-value") === preferred) ??
      items[0]
    setActiveValue(initial?.getAttribute("data-value") ?? null)
    const searchInput = root.querySelector<HTMLInputElement>(
      '[data-df="option-list-search"] input'
    )
    if (searchInput) searchInput.focus()
    else root.focus()
    if (initial) scrollSelectedIntoListViewport(initial, root)
  }, [open, mounted, portal, setActiveValue, value, values])

  // Return focus to the trigger when the list closes by keyboard or selection.
  const wasOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (!portal) return
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    setActiveValue(null)
    const active = document.activeElement
    if (active == null || active === document.body) {
      triggerRef.current?.focus?.()
    }
  }, [open, portal, setActiveValue, triggerRef])

  React.useEffect(() => {
    const typeahead = typeaheadRef.current
    return () => {
      if (typeahead.timer != null) window.clearTimeout(typeahead.timer)
    }
  }, [])

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const root = contentRef.current
    if (!root) return
    const items = navigableOptions(root)
    if (items.length === 0) return

    const inSearch = Boolean(
      (event.target as HTMLElement | null)?.closest(
        '[data-df="option-list-search"]'
      )
    )
    const currentIndex = items.findIndex(
      (item) => item.getAttribute("data-value") === activeValue
    )

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const base = currentIndex === -1 ? -1 : currentIndex
      moveActiveTo(items[(base + 1 + items.length) % items.length])
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      const base = currentIndex === -1 ? 0 : currentIndex
      moveActiveTo(items[(base - 1 + items.length) % items.length])
      return
    }
    if (event.key === "Home") {
      event.preventDefault()
      moveActiveTo(items[0])
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      moveActiveTo(items[items.length - 1])
      return
    }
    if (event.key === "Enter" || (event.key === " " && !inSearch)) {
      if (currentIndex === -1) return
      event.preventDefault()
      items[currentIndex]?.click()
      return
    }
    if (event.key === "ArrowRight" && currentIndex !== -1) {
      const item = items[currentIndex]
      if (item == null) return
      if (item.getAttribute("data-submenu-trigger") != null) {
        event.preventDefault()
        item.click()
      }
      return
    }

    if (
      inSearch ||
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
      items.find((item) => optionText(item).startsWith(query)) ??
      items.find((item) => optionText(item).includes(query))
    if (match) {
      event.preventDefault()
      moveActiveTo(match)
    }
    typeahead.timer = window.setTimeout(() => {
      typeahead.query = ""
      typeahead.timer = null
    }, 500)
  }

  if (!mounted) {
    return (
      <div hidden aria-hidden data-df="option-list-label-registry">
        {children}
      </div>
    )
  }

  if (!open) {
    return (
      <div hidden aria-hidden>
        {children}
      </div>
    )
  }

  const body = (
    <OptionListBody
      scrollable={wrapInScrollArea}
      maxHeight={effectiveMaxHeight}
      scrollThumbGap={scrollThumbGap}
    >
      {children}
    </OptionListBody>
  )

  const flushChrome = chrome === "plain" || chrome === "panel"
  const hugMinWidth = stacked
    ? "var(--df-submenu-min-width)"
    : "var(--df-option-list-min-width)"
  const headerLabelId = `${listboxId}-header-label`
  const resolvedHeader = resolveOptionListHeader(header, headerLabelId)
  const ariaLabelledBy =
    props["aria-labelledby"] ?? resolvedHeader.labelledBy
  const surfaceStyle = optionListSurfaceChromeStyle({
    background,
    foreground,
    borderColor,
    borderWidth,
    borderStyle,
    dividerColor,
    radius,
  })
  const layoutStyle = portal
    ? {
        ...placement.style,
        ...(alignItemWithTrigger
          ? null
          : {
              // Hug the longest option. Use alignItemWithTrigger to match the field.
              width: "max-content",
              minWidth: flushChrome ? 0 : "var(--df-option-list-min-width)",
              maxWidth:
                "min(calc(100vw - 4 * var(--spacing-unit, 0.25rem)), var(--df-max-w-sm))",
            }),
      }
    : {
        position: "relative" as const,
        width: alignItemWithTrigger ? "100%" : "max-content",
        minWidth: flushChrome
          ? 0
          : alignItemWithTrigger
            ? "var(--df-option-list-min-width)"
            : hugMinWidth,
      }

  const panel = (
    <div
      {...props}
      ref={contentRef}
      role="listbox"
      id={listboxId}
      tabIndex={-1}
      aria-activedescendant={
        activeValue != null ? optionDomId(activeValue) : undefined
      }
      aria-labelledby={ariaLabelledBy}
      data-df="option-list-content"
      data-side={placement.side}
      data-align={placement.align}
      data-align-trigger={alignItemWithTrigger ? "true" : "false"}
      data-portal={portal ? "true" : "false"}
      data-chrome={chrome}
      data-stacked={stacked ? "true" : undefined}
      data-scroll={wrapInScrollArea ? "kit" : undefined}
      className={cn(className)}
      style={{ ...surfaceStyle, ...layoutStyle, ...style }}
      onKeyDown={(event) => {
        composeEventHandlers(props.onKeyDown, handleListKeyDown)(event)
      }}
      onMouseEnter={(event) => {
        composeEventHandlers(onMouseEnter, () => {
          if (openOnHover) cancelHoverClose()
        })(event)
      }}
      onMouseLeave={(event) => {
        composeEventHandlers(onMouseLeave, () => {
          if (openOnHover) scheduleHoverClose()
        })(event)
      }}
    >
      {resolvedHeader.node}
      {search ? (
        <OptionListSearch
          placeholder={searchPlaceholder}
          background={searchBackground}
          value={searchValue}
          defaultValue={defaultSearchValue}
          onValueChange={onSearchChange}
        />
      ) : null}
      {body}
      {resolveOptionListFooter(footer)}
    </div>
  )

  if (!portal) return panel

  return createPortal(
    <div
      data-df="option-list-portal"
      className={portalThemeClass}
    >
      {panel}
    </div>,
    document.body
  )
}

function OptionListLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <ListItemLabel variant="menu" className={cn(className)} {...props} />
}

type OptionListItemProps = Omit<
  ListItemProps,
  "selected" | "highlighted" | "open" | "asChild"
> & {
  value: string
}

function optionLabelText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(optionLabelText).join(" ")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return optionLabelText(node.props.children)
  }
  return ""
}

const OptionListItem = React.forwardRef<HTMLElement, OptionListItemProps>(
  function OptionListItem(
    {
      className,
      children,
      value,
      disabled,
      readOnly,
      leading,
      secondary,
      layout = "inline",
      trailing,
      indicator,
      id: idProp,
      onClick,
      onMouseEnter,
      "data-highlighted": dataHighlightedProp,
      ...props
    },
    ref
  ) {
    const {
      isSelected,
      toggleValue,
      setOpen,
      setActiveValue,
      registerLabel,
      registerSecondary,
      closeOnSelect,
      searchQuery,
      selectionMode,
      activeValue,
      optionDomId,
      itemChrome,
    } = useOptionListContext()
    const submenu = React.useContext(OptionListSubmenuStateContext)
    const inTriggerZone = React.useContext(OptionListSubmenuTriggerZoneContext)
    const isSubmenuTrigger = Boolean(submenu && inTriggerZone)

    const selected = isSelected(value)
    const blockInteraction = Boolean(disabled || readOnly)
    const keyboardActive =
      !blockInteraction && !isSubmenuTrigger && activeValue === value
    const showCheckbox = leading === "checkbox"
    const showTrailingIndicator =
      indicator ??
      (!showCheckbox &&
        selectionMode === "single" &&
        trailing == null &&
        !isSubmenuTrigger)
    const copyLayout = resolveListItemLayout(layout, secondary)
    const highlighted =
      (isSubmenuTrigger && submenu?.open) || dataHighlightedProp != null

    useIsomorphicLayoutEffect(() => {
      registerLabel(value, children)
      registerSecondary(value, secondary, copyLayout)
    }, [children, copyLayout, registerLabel, registerSecondary, secondary, value])

    const setItemRef = React.useCallback(
      (node: HTMLElement | null) => {
        if (isSubmenuTrigger && submenu) {
          submenu.setTriggerNode(node)
        }
      },
      [isSubmenuTrigger, submenu]
    )

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      const haystack =
        `${optionLabelText(children)} ${optionLabelText(secondary)} ${optionLabelText(trailing)}`
          .toLowerCase()
          .trim()
      if (!haystack.includes(query)) return null
    }

    return (
      <ListItem
        {...itemChrome}
        {...props}
        ref={composeRefs(ref, setItemRef)}
        id={idProp ?? (isSubmenuTrigger ? undefined : optionDomId(value))}
        role={isSubmenuTrigger ? "menuitem" : "option"}
        aria-selected={isSubmenuTrigger ? undefined : selected}
        aria-haspopup={isSubmenuTrigger ? "menu" : undefined}
        aria-expanded={isSubmenuTrigger ? submenu?.open : undefined}
        selected={isSubmenuTrigger ? false : selected}
        highlighted={highlighted}
        disabled={disabled}
        readOnly={readOnly}
        open={Boolean(isSubmenuTrigger && submenu?.open)}
        leading={leading}
        secondary={secondary}
        layout={copyLayout}
        trailing={trailing}
        indicator={showTrailingIndicator}
        data-value={value}
        data-active={keyboardActive ? "" : undefined}
        data-submenu-trigger={isSubmenuTrigger ? "" : undefined}
        className={cn(className)}
        onMouseEnter={(event) => {
          composeEventHandlers(onMouseEnter, () => {
            if (!blockInteraction && !isSubmenuTrigger) setActiveValue(value)
          })(event)
        }}
        onClick={(event) => {
          composeEventHandlers(onClick, () => {
            if (blockInteraction) return
            if (isSubmenuTrigger) {
              submenu?.cancelClose()
              return
            }
            toggleValue(value)
            if (closeOnSelect) setOpen(false)
          })(event)
        }}
      >
        {children}
      </ListItem>
    )
  }
)

type OptionListSeparatorProps = React.ComponentProps<"div"> & {
  /** When true, follow content padding. When false, span the full content width. */
  inset?: boolean
}

function OptionListSeparator({
  className,
  inset = false,
  ...props
}: OptionListSeparatorProps) {
  return (
    <div
      role="separator"
      data-df="option-list-separator"
      data-inset={inset ? "" : undefined}
      className={cn(className)}
      {...props}
    />
  )
}

function OptionListScrollUpButton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-df="option-list-scroll-up-button"
      className={cn(
        "flex w-full cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUp className="size-4" />
    </div>
  )
}

function OptionListScrollDownButton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-df="option-list-scroll-down-button"
      className={cn(
        "flex w-full cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDown className="size-4" />
    </div>
  )
}

export {
  OptionList,
  OptionListBody,
  OptionListContent,
  OptionListFooter,
  OptionListGroup,
  OptionListHeader,
  OptionListItem,
  OptionListLabel,
  OptionListScrollDownButton,
  OptionListScrollUpButton,
  OptionListSearch,
  OptionListSeparator,
  OptionListSubContent,
  OptionListSubmenu,
  OptionListTrigger,
  useOptionListContext,
}
export type {
  OptionListBodyProps,
  OptionListChrome,
  OptionListContentProps,
  OptionListHeaderProps,
  OptionListItemLayout,
  OptionListItemProps,
  OptionListProps,
  OptionListSearchProps,
  OptionListSeparatorProps,
  OptionListSubContentProps,
  OptionListSubmenuProps,
  OptionListSurfaceChromeProps,
  OptionListWidth,
  SelectionMode,
}
