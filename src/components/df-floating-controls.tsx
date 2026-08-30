"use client"

import * as React from "react"

import { useRovingTabIndex, type RovingItemProps } from "../hooks"
import { Separator } from "./df-separator"
import { cn, composeEventHandlers, composeRefs } from "../lib/utils"

type FloatingControlsVariant = "surface" | "overlay"
type FloatingControlsPadding = "none" | "sm" | "default" | "lg" | "2xl"
type FloatingControlsRadius =
  | "none"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "full"

type FloatingControlsItemEntry = {
  type?: "item"
  key?: string
  label?: React.ReactNode
  children?: React.ReactNode
  leading?: React.ReactNode
  trailing?: React.ReactNode
  tone?: "ghost" | "solid"
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

type FloatingControlsDividerEntry = {
  type: "divider"
  key?: string
  children?: React.ReactNode
  className?: string
}

type FloatingControlsSlotEntry = {
  type: "slot"
  key?: string
  children: React.ReactNode
  className?: string
}

type FloatingControlsEntry =
  | FloatingControlsItemEntry
  | FloatingControlsDividerEntry
  | FloatingControlsSlotEntry

type FloatingControlsProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: FloatingControlsVariant
  padding?: FloatingControlsPadding
  radius?: FloatingControlsRadius
  items?: FloatingControlsEntry[]
}

type FloatingControlsItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  leading?: React.ReactNode | undefined
  trailing?: React.ReactNode | undefined
  tone?: "ghost" | "solid" | undefined
}

type FloatingControlsRovingContextValue = {
  getItemProps: (index: number) => RovingItemProps
}

const FloatingControlsRovingContext =
  React.createContext<FloatingControlsRovingContextValue | null>(null)

const FloatingControlsItemIndexContext = React.createContext<number | null>(
  null
)

const FloatingControlsItem = React.forwardRef<
  HTMLButtonElement,
  FloatingControlsItemProps
>(function FloatingControlsItem(
  {
    className,
    leading,
    trailing,
    tone = "ghost",
    type = "button",
    children,
    onFocus,
    onKeyDown,
    ...props
  },
  ref
) {
  const roving = React.useContext(FloatingControlsRovingContext)
  const rovingIndex = React.useContext(FloatingControlsItemIndexContext)
  const itemProps =
    roving != null && rovingIndex != null
      ? roving.getItemProps(rovingIndex)
      : null

  return (
    <button
      type={type}
      ref={composeRefs(ref, itemProps?.ref)}
      data-df="floating-controls-item"
      data-tone={tone}
      className={cn("df-floating-controls-item", className)}
      tabIndex={itemProps?.tabIndex}
      {...props}
      onFocus={(event) => {
        if (itemProps) {
          composeEventHandlers(onFocus, itemProps.onFocus)(event)
          return
        }
        onFocus?.(event)
      }}
      onKeyDown={(event) => {
        if (itemProps) {
          composeEventHandlers(onKeyDown, itemProps.onKeyDown)(event)
          return
        }
        onKeyDown?.(event)
      }}
    >
      {leading != null && (
        <span
          className="df-floating-controls-item-slot"
          data-df="floating-controls-item-slot"
          data-slot="leading"
          data-icon="inline-start"
        >
          {leading}
        </span>
      )}
      {children}
      {trailing != null && (
        <span
          className="df-floating-controls-item-slot"
          data-df="floating-controls-item-slot"
          data-slot="trailing"
          data-icon="inline-end"
        >
          {trailing}
        </span>
      )}
    </button>
  )
})

function isFloatingControlsItemElement(
  node: React.ReactNode
): node is React.ReactElement<FloatingControlsItemProps> {
  return React.isValidElement(node) && node.type === FloatingControlsItem
}

function FloatingControls({
  className,
  variant = "surface",
  padding = "default",
  radius = "xl",
  items,
  children,
  ...props
}: FloatingControlsProps) {
  const content =
    children ??
    (items?.map((entry, index) => {
      const key =
        ("key" in entry && entry.key) || `${entry.type ?? "item"}-${index}`

      if (entry.type === "divider") {
        return (
          <FloatingControlsDivider key={key} className={entry.className}>
            {entry.children}
          </FloatingControlsDivider>
        )
      }

      if (entry.type === "slot") {
        return (
          <FloatingControlsSlot key={key} className={entry.className}>
            {entry.children}
          </FloatingControlsSlot>
        )
      }

      const {
        label,
        children: itemChildren,
        leading,
        trailing,
        tone,
        onClick,
        disabled,
        className: itemClassName,
        "aria-label": ariaLabel,
      } = entry

      return (
        <FloatingControlsItem
          key={key}
          leading={leading}
          trailing={trailing}
          tone={tone}
          onClick={onClick}
          disabled={disabled}
          className={itemClassName}
          aria-label={ariaLabel}
        >
          {label ?? itemChildren}
        </FloatingControlsItem>
      )
    }))

  const childArray = React.Children.toArray(content)
  const itemDisabledFlags: boolean[] = []
  for (const child of childArray) {
    if (isFloatingControlsItemElement(child)) {
      itemDisabledFlags.push(Boolean(child.props.disabled))
    }
  }

  const { getItemProps } = useRovingTabIndex({
    count: itemDisabledFlags.length,
    orientation: "horizontal",
    isItemDisabled: (index) => itemDisabledFlags[index] ?? false,
  })

  let nextItemIndex = 0
  const indexedContent = childArray.map((child) => {
    if (!isFloatingControlsItemElement(child)) return child
    const index = nextItemIndex++
    return (
      <FloatingControlsItemIndexContext.Provider
        key={child.key ?? `item-${index}`}
        value={index}
      >
        {child}
      </FloatingControlsItemIndexContext.Provider>
    )
  })

  const rovingValue: FloatingControlsRovingContextValue = {
    getItemProps,
  }

  return (
    <FloatingControlsRovingContext.Provider value={rovingValue}>
      <div
        role="toolbar"
        aria-orientation="horizontal"
        data-df="floating-controls"
        data-variant={variant}
        data-padding={padding}
        data-radius={radius}
        className={cn("df-floating-controls", className)}
        {...props}
      >
        {indexedContent}
      </div>
    </FloatingControlsRovingContext.Provider>
  )
}

type FloatingControlsDividerProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode
}

function FloatingControlsDivider({
  className,
  children,
  ...props
}: FloatingControlsDividerProps) {
  if (children != null) {
    return (
      <div
        data-df="floating-controls-divider"
        data-custom=""
        className={cn("df-floating-controls-divider", className)}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <Separator
      orientation="vertical"
      data-df="floating-controls-divider"
      className={cn("df-floating-controls-divider", className)}
      {...props}
    />
  )
}

type FloatingControlsSlotProps = React.HTMLAttributes<HTMLDivElement>

function FloatingControlsSlot({
  className,
  children,
  ...props
}: FloatingControlsSlotProps) {
  return (
    <div
      data-df="floating-controls-slot"
      className={cn("df-floating-controls-slot", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  FloatingControls,
  FloatingControlsItem,
  FloatingControlsDivider,
  FloatingControlsSlot,
}
export type {
  FloatingControlsProps,
  FloatingControlsItemProps,
  FloatingControlsDividerProps,
  FloatingControlsSlotProps,
  FloatingControlsVariant,
  FloatingControlsPadding,
  FloatingControlsRadius,
  FloatingControlsEntry,
  FloatingControlsItemEntry,
  FloatingControlsDividerEntry,
  FloatingControlsSlotEntry,
}
