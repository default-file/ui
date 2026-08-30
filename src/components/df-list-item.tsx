"use client"

import * as React from "react"
import { Check, ChevronRight } from "lucide-react"

import {
  dfPaddingChromeStyle,
  resolvePaddingSides,
  type PaddingChromeProps,
} from "../lib/padding-chrome"
import { cn } from "../lib/utils"

function assignRef<T>(ref: React.Ref<T> | undefined | null, value: T | null) {
  if (typeof ref === "function") ref(value)
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value
}

type ListItemSize = "xs" | "sm" | "md" | "lg"
type ListItemVariant = "accent" | "muted"
type ListItemLabelVariant = "menu" | "nav"
type ListItemLayout = "inline" | "stacked" | "columns"
type ListItemLeading = "checkbox" | "check" | React.ReactNode | false
type ListItemLeadingFit = "icon" | "content"
type ListItemAs = "div" | "button"

const LIST_ITEM_HOST_SELECTOR = '[data-df="list-item"]'
const LIST_ITEM_INTERACTIVE_HOST_SELECTOR = `${LIST_ITEM_HOST_SELECTOR}:not([data-disabled]):not([data-readonly])`

/** stacked requires secondary; otherwise keep the requested layout. */
function resolveListItemLayout(
  layout: ListItemLayout,
  secondary: React.ReactNode | null | undefined
): ListItemLayout {
  return layout === "stacked" && secondary == null ? "inline" : layout
}

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " "
}

function blockListItemKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  disabled: boolean,
  readOnly: boolean
): boolean {
  if (disabled) {
    event.preventDefault()
    return true
  }
  if (readOnly) {
    if (isActivationKey(event.key)) event.preventDefault()
    return true
  }
  return false
}

type ListItemChromeProps = PaddingChromeProps & {
  gap?: string | undefined
  fontSize?: string | undefined
  fontFamily?: string | undefined
  fontWeight?: string | undefined
  background?: string | undefined
  foreground?: string | undefined
  hoverBackground?: string | undefined
  hoverForeground?: string | undefined
  selectedBackground?: string | undefined
  selectedForeground?: string | undefined
  selectedHoverBackground?: string | undefined
  activeBackground?: string | undefined
  radius?: string | undefined
  borderWidth?: string | undefined
  borderColor?: string | undefined
  borderStyle?: string | undefined
}

type ListItemHostProps = React.HTMLAttributes<HTMLElement> & {
  ref?: React.Ref<HTMLElement | null>
  style?: React.CSSProperties
}

type ListItemProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> &
  ListItemChromeProps & {
    size?: ListItemSize | undefined
    variant?: ListItemVariant | undefined
    selected?: boolean | undefined
    highlighted?: boolean | undefined
    disabled?: boolean | undefined
    /** Presentational row: no hover, press, focus, or activation. Keeps resting and selected chrome. */
    readOnly?: boolean | undefined
    open?: boolean | undefined
    leading?: ListItemLeading | undefined
    /**
     * Track size for custom leading nodes. icon is the default mark box.
     * Use content for Avatar, text marks, or other nodes wider than the icon track.
     */
    leadingFit?: ListItemLeadingFit | undefined
    secondary?: React.ReactNode | undefined
    layout?: ListItemLayout | undefined
    trailing?: React.ReactNode | undefined
    indicator?: boolean | undefined
    /** Native host when not using asChild. Ignored when asChild is true. */
    as?: ListItemAs | undefined
    /**
     * When true, do not render a wrapper. Pass one child element (usually a link).
     * That element becomes the row and keeps its own href or routing.
     */
    asChild?: boolean | undefined
    children?: React.ReactNode | undefined
    "data-highlighted"?: string | undefined
  }

function resolveLeadingAttr(
  leading: ListItemLeading | undefined
): "checkbox" | "check" | "custom" | undefined {
  if (leading === "checkbox") return "checkbox"
  if (leading === "check") return "check"
  if (leading != null && leading !== false) return "custom"
  return undefined
}

function resolveLeadingFitAttr(
  leading: ListItemLeading | undefined,
  leadingFit: ListItemLeadingFit
): ListItemLeadingFit | undefined {
  return resolveLeadingAttr(leading) === "custom" ? leadingFit : undefined
}

function listItemChromeStyle({
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  gap,
  fontSize,
  fontFamily,
  fontWeight,
  background,
  foreground,
  hoverBackground,
  hoverForeground,
  selectedBackground,
  selectedForeground,
  selectedHoverBackground,
  activeBackground,
  radius,
  borderWidth,
  borderColor,
  borderStyle,
}: ListItemChromeProps): React.CSSProperties {
  return {
    ...dfPaddingChromeStyle(
      "--df-list-item-padding",
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
    ...(gap != null ? { "--df-list-item-gap": gap } : null),
    ...(fontSize != null ? { "--df-list-item-font-size": fontSize } : null),
    ...(fontFamily != null
      ? { "--df-list-item-font-family": fontFamily }
      : null),
    ...(fontWeight != null
      ? { "--df-list-item-font-weight": fontWeight }
      : null),
    ...(background != null ? { "--df-list-item-bg": background } : null),
    ...(foreground != null ? { "--df-list-item-fg": foreground } : null),
    ...(hoverBackground != null
      ? { "--df-list-item-hover-bg": hoverBackground }
      : null),
    ...(hoverForeground != null
      ? { "--df-list-item-hover-fg": hoverForeground }
      : null),
    ...(selectedBackground != null
      ? {
          "--df-list-item-selected-bg": selectedBackground,
          "--df-list-item-selected-hover-bg":
            selectedHoverBackground ?? selectedBackground,
        }
      : null),
    ...(selectedForeground != null
      ? { "--df-list-item-selected-fg": selectedForeground }
      : null),
    ...(selectedHoverBackground != null
      ? { "--df-list-item-selected-hover-bg": selectedHoverBackground }
      : null),
    ...(activeBackground != null
      ? { "--df-list-item-active-bg": activeBackground }
      : null),
    ...(radius != null ? { "--df-list-item-radius": radius } : null),
    ...(borderWidth != null
      ? { "--df-list-item-border-width": borderWidth }
      : null),
    ...(borderColor != null
      ? { "--df-list-item-border-color": borderColor }
      : null),
    ...(borderStyle != null
      ? { "--df-list-item-border-style": borderStyle }
      : null),
  } as React.CSSProperties
}

function ListItemSlots({
  label,
  leading,
  secondary,
  layout,
  trailing,
  indicator,
  selected,
}: {
  label: React.ReactNode
  leading?: ListItemLeading
  secondary?: React.ReactNode
  layout: ListItemLayout
  trailing?: React.ReactNode
  indicator?: boolean
  selected: boolean
}) {
  let leadingNode: React.ReactNode = null
  if (leading === "checkbox") {
    leadingNode = (
      <span
        data-df="list-item-checkbox"
        data-state={selected ? "checked" : "unchecked"}
        aria-hidden
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    )
  } else if (leading === "check") {
    leadingNode = (
      <span data-df="list-item-leading" aria-hidden>
        {selected ? (
          <Check className="size-4 shrink-0" />
        ) : (
          <span className="size-4 shrink-0" />
        )}
      </span>
    )
  } else if (leading != null && leading !== false) {
    leadingNode = <span data-df="list-item-leading">{leading}</span>
  }

  return (
    <>
      {leadingNode}
      <span data-df="list-item-copy" data-layout={layout}>
        <span data-df="list-item-title">{label}</span>
        {secondary != null ? (
          <span data-df="list-item-secondary">{secondary}</span>
        ) : null}
      </span>
      {trailing != null ? (
        <span data-df="list-item-trailing">{trailing}</span>
      ) : null}
      {indicator ? (
        <span data-df="list-item-indicator" aria-hidden>
          {selected ? <Check className="pointer-events-none" /> : null}
        </span>
      ) : null}
    </>
  )
}

const ListItem = React.forwardRef<HTMLElement, ListItemProps>(
  function ListItem(
    {
      className,
      style,
      children,
      size = "md",
      variant = "accent",
      selected = false,
      highlighted = false,
      disabled = false,
      readOnly = false,
      open = false,
      leading,
      leadingFit = "icon",
      secondary,
      layout = "inline",
      trailing,
      indicator = false,
      as: asProp = "div",
      asChild = false,
      onClick,
      onKeyDown,
      padding,
      paddingX,
      paddingY,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      gap,
      fontSize,
      fontFamily,
      fontWeight,
      background,
      foreground,
      hoverBackground,
      hoverForeground,
      selectedBackground,
      selectedForeground,
      selectedHoverBackground,
      activeBackground,
      radius,
      borderWidth,
      borderColor,
      borderStyle,
      "data-highlighted": dataHighlightedProp,
      ...props
    },
    ref
  ) {
    const copyLayout = resolveListItemLayout(layout, secondary)
    const dataState = selected ? "selected" : "idle"
    const blockInteraction = disabled || readOnly
    const dataHighlighted =
      !blockInteraction && (highlighted || dataHighlightedProp != null)

    const chromeStyle = listItemChromeStyle({
      padding,
      paddingX,
      paddingY,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      gap,
      fontSize,
      fontFamily,
      fontWeight,
      background,
      foreground,
      hoverBackground,
      hoverForeground,
      selectedBackground,
      selectedForeground,
      selectedHoverBackground,
      activeBackground,
      radius,
      borderWidth,
      borderColor,
      borderStyle,
    })
    const sharedClassName = cn(className)
    const sharedData = {
      "data-df": "list-item" as const,
      "data-size": size,
      "data-variant": variant,
      "data-state": dataState,
      "data-open": open ? ("" as const) : undefined,
      "data-layout": copyLayout,
      "data-disabled": disabled ? ("" as const) : undefined,
      "data-readonly": readOnly ? ("" as const) : undefined,
      "data-leading": resolveLeadingAttr(leading),
      "data-leading-fit": resolveLeadingFitAttr(leading, leadingFit),
      "data-trailing": trailing != null ? ("" as const) : undefined,
      "data-indicator": indicator ? ("" as const) : undefined,
      "data-highlighted": dataHighlighted ? ("" as const) : undefined,
      "aria-disabled": disabled || undefined,
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      if (blockInteraction) {
        event.preventDefault()
        return
      }
      onClick?.(event)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
      if (blockListItemKeyDown(event, disabled, readOnly)) return
      onKeyDown?.(event)
    }

    const asChildElement =
      asChild && React.isValidElement<ListItemHostProps>(children)
        ? children
        : null
    const childPropsRef = asChildElement?.props.ref
    const childOwnRef = asChildElement
      ? (asChildElement as { ref?: React.Ref<HTMLElement | null> }).ref
      : undefined

    const composedRef = React.useCallback(
      (node: HTMLElement | null) => {
        assignRef(ref, node)
        assignRef(childPropsRef, node)
        assignRef(childOwnRef, node)
      },
      [ref, childPropsRef, childOwnRef]
    )

    if (asChild) {
      const child = React.Children.only(children)
      if (!React.isValidElement<ListItemHostProps>(child)) {
        throw new Error("ListItem asChild requires a single React element child.")
      }

      return React.cloneElement(child, {
        ...props,
        ...sharedData,
        ref: composedRef,
        className: cn(sharedClassName, child.props.className),
        style: { ...chromeStyle, ...child.props.style, ...style },
        tabIndex: blockInteraction ? -1 : child.props.tabIndex,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          if (blockInteraction) {
            event.preventDefault()
            return
          }
          child.props.onClick?.(event)
          onClick?.(event)
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (blockListItemKeyDown(event, disabled, readOnly)) return
          child.props.onKeyDown?.(event)
          onKeyDown?.(event)
        },
        children: (
          <ListItemSlots
            label={child.props.children}
            leading={leading}
            secondary={secondary}
            layout={copyLayout}
            trailing={trailing}
            indicator={indicator}
            selected={selected}
          />
        ),
      } as ListItemHostProps)
    }

    const slots = (
      <ListItemSlots
        label={children}
        leading={leading}
        secondary={secondary}
        layout={copyLayout}
        trailing={trailing}
        indicator={indicator}
        selected={selected}
      />
    )

    if (asProp === "button") {
      const buttonProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>
      return (
        <button
          {...buttonProps}
          {...sharedData}
          ref={ref as React.Ref<HTMLButtonElement>}
          type={buttonProps.type ?? "button"}
          className={sharedClassName}
          style={{ ...chromeStyle, ...style }}
          disabled={disabled || undefined}
          tabIndex={readOnly ? -1 : buttonProps.tabIndex}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          {slots}
        </button>
      )
    }

    return (
      <div
        {...props}
        {...sharedData}
        ref={ref as React.Ref<HTMLDivElement>}
        className={sharedClassName}
        style={{ ...chromeStyle, ...style }}
        tabIndex={readOnly ? -1 : props.tabIndex}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {slots}
      </div>
    )
  }
)

type ListItemLabelProps = React.ComponentProps<"div"> & {
  /** menu matches picker group headings. nav matches catalogue section headings. */
  variant?: ListItemLabelVariant
}

function ListItemLabel({
  className,
  variant = "menu",
  ...props
}: ListItemLabelProps) {
  return (
    <div
      data-df="list-item-section"
      data-variant={variant}
      className={cn(className)}
      {...props}
    />
  )
}

function ListItemSubmenuChevron({
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children">) {
  return (
    <span
      data-df="list-item-submenu-chevron"
      aria-hidden
      className={cn(className)}
      {...props}
    >
      <ChevronRight />
    </span>
  )
}

export { ListItemNest, useListItemNestScope } from "./df-list-item-nest"
export type {
  ListItemNestChromeProps,
  ListItemNestProps,
} from "./df-list-item-nest"

export {
  ListItem,
  ListItemLabel,
  ListItemSubmenuChevron,
  LIST_ITEM_HOST_SELECTOR,
  LIST_ITEM_INTERACTIVE_HOST_SELECTOR,
  resolveListItemLayout,
}
export type {
  ListItemAs,
  ListItemChromeProps,
  ListItemLabelProps,
  ListItemLabelVariant,
  ListItemLayout,
  ListItemLeading,
  ListItemLeadingFit,
  ListItemProps,
  ListItemSize,
  ListItemVariant,
}
