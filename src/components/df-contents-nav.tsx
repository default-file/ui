"use client"

import * as React from "react"

import { useControllableState } from "../hooks"
import { useDfStrings } from "../lib/df-intl"
import { sanitizeHref } from "../lib/df-url"
import { cn, composeEventHandlers } from "../lib/utils"
import {
  ListItem,
  ListItemLabel,
  type ListItemChromeProps,
  type ListItemSize,
  type ListItemVariant,
} from "./df-list-item"
import {
  ListItemNest,
  useListItemNestScope,
  type ListItemNestChromeProps,
} from "./df-list-item-nest"

type ContentsNavVariant = "toc" | "index"
type ContentsNavLayout = "grouped" | "flat"

type ContentsNavItemData = {
  id: string
  title: React.ReactNode
  /** Pass null to render a row without a link. toc defaults omitted href to #id. */
  href?: string | null
  disabled?: boolean
  readOnly?: boolean
  children?: ContentsNavItemData[]
}

type ContentsNavSectionData = {
  id?: string
  label: React.ReactNode
  divided?: boolean
  items: ContentsNavItemData[]
}

type ContentsNavScrollRoot =
  | Element
  | null
  | React.RefObject<Element | null>
  | (() => Element | null)

type ContentsNavContextValue = {
  variant: ContentsNavVariant
  nestLine: boolean
  itemVariant: ListItemVariant
  itemSize: ListItemSize
  nestItemSize: ListItemSize
  /** Default List Item chrome for every row. Per item props win. */
  itemChrome?: ListItemChromeProps | undefined
  /** Default ListItemNest chrome for data driven child groups. */
  nestChrome?: ListItemNestChromeProps | undefined
  activeId: string
  setActiveId: (id: string) => void
  renderItem?:
    | ((
        item: ContentsNavItemData,
        ctx: { active: boolean; depth: number }
      ) => React.ReactElement)
    | undefined
}

const ContentsNavContext =
  React.createContext<ContentsNavContextValue | null>(null)

function useContentsNav() {
  const ctx = React.useContext(ContentsNavContext)
  if (!ctx) {
    throw new Error("Contents Nav parts must be used within ContentsNav")
  }
  return ctx
}

function flattenContentsNavIds(items: ContentsNavItemData[]): string[] {
  const ids: string[] = []
  for (const item of items) {
    ids.push(item.id)
    if (item.children?.length) {
      ids.push(...flattenContentsNavIds(item.children))
    }
  }
  return ids
}

function resolveScrollRoot(scrollRoot: ContentsNavScrollRoot | undefined): Element | null {
  if (scrollRoot == null) {
    if (typeof document === "undefined") return null
    return document.scrollingElement
  }
  if (typeof scrollRoot === "function") return scrollRoot()
  if (scrollRoot instanceof Element) return scrollRoot
  return scrollRoot.current
}

/**
 * Active section id from scroll position inside root.
 * Uses spyRatio for the primary marker and promotes the last id near the end
 * of the scrollport when that heading has entered reading position.
 */
function activeIdFromScroll(
  ids: string[],
  root: Element,
  spyRatio: number
): string {
  const rootRect = root.getBoundingClientRect()
  const marker = rootRect.top + rootRect.height * spyRatio
  let current = ids[0] ?? ""
  for (const id of ids) {
    const el = document.getElementById(id)
    if (!el) continue
    if (el.getBoundingClientRect().top <= marker) current = id
  }

  const distanceFromBottom =
    root.scrollHeight - root.scrollTop - root.clientHeight
  if (distanceFromBottom > 24) return current

  let lastIndex = -1
  for (let i = ids.length - 1; i >= 0; i--) {
    if (document.getElementById(ids[i]!)) {
      lastIndex = i
      break
    }
  }
  if (lastIndex < 0) return current

  const lastId = ids[lastIndex]!
  const lastEl = document.getElementById(lastId)
  if (!lastEl) return current

  const promoteLine = rootRect.top + rootRect.height * Math.min(spyRatio + 0.3, 0.9)
  if (lastEl.getBoundingClientRect().top <= promoteLine) return lastId

  if (lastIndex > 0) {
    for (let i = lastIndex - 1; i >= 0; i--) {
      const prevEl = document.getElementById(ids[i]!)
      if (!prevEl) continue
      if (prevEl.getBoundingClientRect().top < rootRect.top) return lastId
      break
    }
  }

  return current
}

type ContentsNavProps = Omit<React.ComponentProps<"nav">, "title"> & {
  variant?: ContentsNavVariant
  /** Optional heading above the list (typical for toc). */
  title?: React.ReactNode
  items?: ContentsNavItemData[]
  sections?: ContentsNavSectionData[]
  /** Index list shape. grouped uses sections; flat renders items only. */
  layout?: ContentsNavLayout
  /** Default nest guide line for toc trees. Per nest override via ListItemNest. */
  nestLine?: boolean
  scrollSpy?: boolean
  scrollRoot?: ContentsNavScrollRoot
  /** Fraction of the scrollport height used as the spy marker. */
  spyRatio?: number
  activeId?: string
  defaultActiveId?: string
  onActiveIdChange?: (id: string) => void
  itemVariant?: ListItemVariant
  itemSize?: ListItemSize
  nestItemSize?: ListItemSize
  /** Default List Item chrome for every row. Per item props win. */
  itemChrome?: ListItemChromeProps
  /** Default ListItemNest chrome for data driven child groups. */
  nestChrome?: ListItemNestChromeProps
  renderItem?: (
    item: ContentsNavItemData,
    ctx: { active: boolean; depth: number }
  ) => React.ReactElement
}

function ContentsNavHeading({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-df="contents-nav-heading"
      className={cn(className)}
      {...props}
    />
  )
}

type ContentsNavSectionProps = React.ComponentProps<"div"> & {
  label?: React.ReactNode
  divided?: boolean
}

function ContentsNavSection({
  className,
  label,
  divided = false,
  children,
  ...props
}: ContentsNavSectionProps) {
  return (
    <div
      data-df="contents-nav-section"
      data-divided={divided ? "true" : "false"}
      className={cn(className)}
      {...props}
    >
      {label != null ? (
        <ListItemLabel variant="nav">{label}</ListItemLabel>
      ) : null}
      {children}
    </div>
  )
}

type ContentsNavItemProps = Omit<
  React.ComponentProps<typeof ListItem>,
  "selected" | "variant" | "size"
> & {
  active?: boolean | undefined
  variant?: ListItemVariant | undefined
  size?: ListItemSize | undefined
  href?: string | undefined
  itemId?: string | undefined
}

const ContentsNavItem = React.forwardRef<HTMLElement, ContentsNavItemProps>(
  function ContentsNavItem(
    {
      className,
      active,
      variant,
      size,
      href,
      itemId,
      asChild,
      children,
      onClick,
      disabled,
      readOnly,
      ...props
    },
    ref
  ) {
    const ctx = useContentsNav()
    const inNest = useListItemNestScope()
    const resolvedVariant = variant ?? ctx.itemVariant
    const resolvedSize = size ?? (inNest ? ctx.nestItemSize : ctx.itemSize)
    const resolvedActive =
      active ?? (itemId != null ? ctx.activeId === itemId : false)
    const ariaCurrent = resolvedActive
      ? ctx.variant === "index"
        ? "page"
        : "true"
      : undefined
    const blockInteraction = Boolean(disabled || readOnly)

    const handleSelect = (event: React.MouseEvent<HTMLElement>) => {
      if (blockInteraction) {
        event.preventDefault()
        return
      }
      composeEventHandlers(onClick, () => {
        if (itemId != null) ctx.setActiveId(itemId)
      })(event)
    }

    if (asChild) {
      return (
        <ListItem
          {...ctx.itemChrome}
          {...props}
          ref={ref}
          asChild
          variant={resolvedVariant}
          size={resolvedSize}
          selected={resolvedActive}
          disabled={disabled}
          readOnly={readOnly}
          aria-current={ariaCurrent}
          className={className}
          onClick={handleSelect}
        >
          {children}
        </ListItem>
      )
    }

    if (href != null) {
      const safeHref = sanitizeHref(href)
      if (safeHref != null) {
        return (
          <ListItem
            {...ctx.itemChrome}
            {...props}
            ref={ref}
            asChild
            variant={resolvedVariant}
            size={resolvedSize}
            selected={resolvedActive}
            disabled={disabled}
            readOnly={readOnly}
            aria-current={ariaCurrent}
            className={className}
            onClick={handleSelect}
          >
            <a href={safeHref}>{children}</a>
          </ListItem>
        )
      }
    }

    return (
      <ListItem
        {...ctx.itemChrome}
        {...props}
        ref={ref}
        variant={resolvedVariant}
        size={resolvedSize}
        selected={resolvedActive}
        disabled={disabled}
        readOnly={readOnly}
        aria-current={ariaCurrent}
        className={className}
        onClick={handleSelect}
      >
        {children}
      </ListItem>
    )
  }
)

function ContentsNavSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-df="contents-nav-separator"
      role="presentation"
      className={cn(className)}
      {...props}
    />
  )
}

function ContentsNavBranch({
  item,
  depth,
}: {
  item: ContentsNavItemData
  depth: number
}) {
  const ctx = useContentsNav()
  const children = item.children ?? []
  const hasChildren = children.length > 0
  const active = ctx.activeId === item.id
  const size = depth > 0 ? ctx.nestItemSize : ctx.itemSize
  const href =
    item.href === null
      ? undefined
      : (item.href ?? (ctx.variant === "toc" ? `#${item.id}` : undefined))

  let row: React.ReactNode
  if (ctx.renderItem) {
    const custom = ctx.renderItem(item, { active, depth })
    const blockInteraction = Boolean(item.disabled || item.readOnly)
    row = (
      <ListItem
        {...ctx.itemChrome}
        asChild
        variant={ctx.itemVariant}
        size={size}
        selected={active}
        disabled={item.disabled}
        readOnly={item.readOnly}
        aria-current={
          active ? (ctx.variant === "index" ? "page" : "true") : undefined
        }
        onClick={(event) => {
          if (blockInteraction) {
            event.preventDefault()
            return
          }
          ctx.setActiveId(item.id)
        }}
      >
        {custom}
      </ListItem>
    )
  } else {
    row = (
      <ContentsNavItem
        itemId={item.id}
        active={active}
        size={size}
        href={href}
        disabled={item.disabled}
        readOnly={item.readOnly}
      >
        {item.title}
      </ContentsNavItem>
    )
  }

  return (
    <div data-df="contents-nav-branch">
      {row}
      {hasChildren ? (
        <ListItemNest
          {...ctx.nestChrome}
          line={ctx.nestLine}
          role="group"
          aria-label={
            typeof item.title === "string" ? item.title : undefined
          }
        >
          {children.map((child) => (
            <ContentsNavBranch key={child.id} item={child} depth={depth + 1} />
          ))}
        </ListItemNest>
      ) : null}
    </div>
  )
}

function ContentsNav({
  className,
  variant = "toc",
  title,
  items,
  sections,
  layout = "grouped",
  nestLine,
  scrollSpy,
  scrollRoot,
  spyRatio = 0.25,
  activeId: activeIdProp,
  defaultActiveId,
  onActiveIdChange,
  itemVariant = "muted",
  itemSize: itemSizeProp,
  nestItemSize: nestItemSizeProp,
  itemChrome,
  nestChrome,
  renderItem,
  children,
  "aria-label": ariaLabel,
  ...props
}: ContentsNavProps) {
  const s = useDfStrings()
  const resolvedNestLine = nestLine ?? variant === "toc"
  const resolvedScrollSpy = scrollSpy ?? variant === "toc"
  const itemSize = itemSizeProp ?? (variant === "toc" ? "sm" : "md")
  const nestItemSize = nestItemSizeProp ?? "xs"

  const spyItems = React.useMemo(() => {
    if (items?.length) return items
    if (sections?.length) {
      return sections.flatMap((section) => section.items)
    }
    return []
  }, [items, sections])

  const flatIds = React.useMemo(
    () => flattenContentsNavIds(spyItems),
    [spyItems]
  )

  const [activeId, setActiveId] = useControllableState({
    value: activeIdProp,
    defaultValue: defaultActiveId ?? flatIds[0] ?? "",
    onChange: onActiveIdChange,
  })

  React.useEffect(() => {
    if (!resolvedScrollSpy || flatIds.length === 0) return

    const update = () => {
      const root = resolveScrollRoot(scrollRoot)
      if (!root) return
      setActiveId(activeIdFromScroll(flatIds, root, spyRatio))
    }

    update()
    const root = resolveScrollRoot(scrollRoot)
    if (!root) return

    root.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(root)
    return () => {
      root.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [flatIds, resolvedScrollSpy, scrollRoot, setActiveId, spyRatio])

  const contextValue = React.useMemo<ContentsNavContextValue>(
    () => ({
      variant,
      nestLine: resolvedNestLine,
      itemVariant,
      itemSize,
      nestItemSize,
      itemChrome,
      nestChrome,
      activeId,
      setActiveId,
      renderItem,
    }),
    [
      activeId,
      itemChrome,
      itemSize,
      itemVariant,
      nestChrome,
      nestItemSize,
      renderItem,
      resolvedNestLine,
      setActiveId,
      variant,
    ]
  )

  const hasData = Boolean(items?.length || sections?.length)
  if (!hasData && children == null) return null

  let body: React.ReactNode = children
  if (children == null && hasData) {
    if (variant === "index" && layout === "grouped" && sections?.length) {
      body = sections.map((section, index) => (
        <ContentsNavSection
          key={section.id ?? String(section.label)}
          label={section.label}
          divided={section.divided ?? index > 0}
        >
          {section.items.map((item) => (
            <ContentsNavBranch key={item.id} item={item} depth={0} />
          ))}
        </ContentsNavSection>
      ))
    } else {
      body = (items ?? []).map((item) => (
        <ContentsNavBranch key={item.id} item={item} depth={0} />
      ))
    }
  }

  return (
    <ContentsNavContext.Provider value={contextValue}>
      <nav
        data-df="contents-nav"
        data-variant={variant}
        aria-label={
          ariaLabel ??
          (variant === "toc" ? s.contentsNavToc : s.contentsNavIndex)
        }
        className={cn(className)}
        {...props}
      >
        {title != null ? <ContentsNavHeading>{title}</ContentsNavHeading> : null}
        {body}
      </nav>
    </ContentsNavContext.Provider>
  )
}

export {
  ContentsNav,
  ContentsNavHeading,
  ContentsNavItem,
  ContentsNavSection,
  ContentsNavSeparator,
  useContentsNav,
}
export type {
  ContentsNavItemData,
  ContentsNavLayout,
  ContentsNavProps,
  ContentsNavScrollRoot,
  ContentsNavSectionData,
  ContentsNavSectionProps,
  ContentsNavItemProps,
  ContentsNavVariant,
}
