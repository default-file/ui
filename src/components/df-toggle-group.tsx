"use client"

import * as React from "react"

import { useControllableState, useRovingTabIndex } from "../hooks"
import type { RovingItemProps } from "../hooks"
import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import { cn, composeEventHandlers } from "../lib/utils"

type ToggleVariant = "default" | "outline"
type ToggleSize = "default" | "sm" | "lg"
type ToggleRadius =
  | "xxs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "full"

type ToggleGroupContextValue = {
  variant: ToggleVariant
  size: ToggleSize
  spacing: number
  orientation: "horizontal" | "vertical"
  disabled: boolean
  value: string[]
  onItemToggle: (itemValue: string) => void
  getRovingProps: (itemValue: string) => RovingItemProps | null
  setActiveForValue: (itemValue: string) => void
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(
  null
)

const sizeClass: Record<ToggleSize, string> = {
  default: "df-toggle-item-default",
  sm: "df-toggle-item-sm",
  lg: "df-toggle-item-lg",
}

const radiusVar: Record<ToggleRadius, string> = {
  xxs: "var(--radius-xxs)",
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  "3xl": "var(--radius-3xl)",
  "4xl": "var(--radius-4xl)",
  full: "var(--radius-full)",
}

type ToggleGroupProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> & {
  variant?: ToggleVariant
  size?: ToggleSize
  spacing?: number
  radius?: ToggleRadius
  cornerShape?: DfCornerShape
  orientation?: "horizontal" | "vertical"
  multiple?: boolean
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  disabled?: boolean
}

function isToggleGroupItemElement(
  node: React.ReactNode
): node is React.ReactElement<ToggleGroupItemProps> {
  return React.isValidElement(node) && node.type === ToggleGroupItem
}

function ToggleGroup({
  className,
  style,
  variant = "default",
  size = "default",
  spacing = 2,
  radius,
  cornerShape,
  orientation = "horizontal",
  multiple = false,
  value,
  defaultValue = [],
  onValueChange,
  disabled = false,
  children,
  ...props
}: ToggleGroupProps) {
  const [current, setCurrent] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  })

  const onItemToggle = (itemValue: string) => {
    if (disabled) return

    if (multiple) {
      if (current.includes(itemValue)) {
        setCurrent(current.filter((v) => v !== itemValue))
      } else {
        setCurrent([...current, itemValue])
      }
      return
    }

    if (current.includes(itemValue)) {
      setCurrent([])
      return
    }
    setCurrent([itemValue])
  }

  const childArray = React.Children.toArray(children)
  const itemNodes: React.ReactElement<ToggleGroupItemProps>[] = []
  for (const child of childArray) {
    if (isToggleGroupItemElement(child)) itemNodes.push(child)
  }
  const itemValues = itemNodes.map((child) => child.props.value)

  const selectedIndex = itemNodes.findIndex((child) =>
    current.includes(child.props.value)
  )
  const defaultRovingIndex =
    selectedIndex >= 0
      ? selectedIndex
      : itemNodes.findIndex((child) => !child.props.disabled)

  const { getItemProps, setActiveIndex } = useRovingTabIndex({
    count: itemNodes.length,
    orientation,
    defaultActiveIndex: defaultRovingIndex >= 0 ? defaultRovingIndex : 0,
    isItemDisabled: (index) =>
      Boolean(disabled || itemNodes[index]?.props.disabled),
  })

  const getRovingProps = React.useCallback(
    (itemValue: string) => {
      const index = itemValues.indexOf(itemValue)
      if (index < 0) return null
      return getItemProps(index)
    },
    [getItemProps, itemValues]
  )

  const setActiveForValue = React.useCallback(
    (itemValue: string) => {
      const index = itemValues.indexOf(itemValue)
      if (index < 0) return
      setActiveIndex(index)
    },
    [itemValues, setActiveIndex]
  )

  return (
    <ToggleGroupContext.Provider
      value={{
        variant,
        size,
        spacing,
        orientation,
        disabled,
        value: current,
        onItemToggle,
        getRovingProps,
        setActiveForValue,
      }}
    >
      <div
        role="group"
        data-df="toggle-group"
        data-variant={variant}
        data-size={size}
        data-spacing={spacing}
        data-radius={radius}
        data-corner-shape={cornerShape}
        data-orientation={orientation}
        data-disabled={disabled ? "" : undefined}
        style={
          {
            "--gap": spacing,
            ...(radius ? { "--df-toggle-radius": radiusVar[radius] } : {}),
            ...dfCornerShapeStyle(cornerShape),
            ...style,
          } as React.CSSProperties
        }
        className={cn("df-toggle-group", className)}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}

type ToggleGroupItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string
  variant?: ToggleVariant
  size?: ToggleSize
}

function ToggleGroupItem({
  className,
  children,
  value,
  variant,
  size,
  disabled,
  type = "button",
  onClick,
  onFocus,
  onKeyDown,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext)
  if (!context) {
    throw new Error("ToggleGroupItem must be used within ToggleGroup")
  }

  const itemVariant = context.variant || variant || "default"
  const itemSize = context.size || size || "default"
  const pressed = context.value.includes(value)
  const isDisabled = Boolean(disabled || context.disabled)
  const roving = context.getRovingProps(value)

  return (
    <button
      type={type}
      ref={roving?.ref}
      tabIndex={context.disabled ? -1 : (roving?.tabIndex ?? -1)}
      aria-pressed={pressed}
      disabled={isDisabled}
      data-df="toggle-group-item"
      data-variant={itemVariant}
      data-size={itemSize}
      data-spacing={context.spacing}
      data-state={pressed ? "on" : "off"}
      className={cn(
        "df-toggle-item",
        itemVariant === "outline" && "df-toggle-item-outline",
        sizeClass[itemSize],
        className
      )}
      {...props}
      onFocus={composeEventHandlers(onFocus, (event) => {
        roving?.onFocus(event)
      })}
      onKeyDown={composeEventHandlers(onKeyDown, (event) => {
        roving?.onKeyDown(event)
        if (event.defaultPrevented) return
        if (event.key !== " " && event.key !== "Enter") return
        if (isDisabled) return
        event.preventDefault()
        context.setActiveForValue(value)
        context.onItemToggle(value)
      })}
      onClick={composeEventHandlers(onClick, () => {
        if (!isDisabled) {
          context.setActiveForValue(value)
          context.onItemToggle(value)
        }
      })}
    >
      {children}
    </button>
  )
}

export { ToggleGroup, ToggleGroupItem }
export type {
  ToggleGroupProps,
  ToggleGroupItemProps,
  ToggleVariant,
  ToggleSize,
  ToggleRadius,
  DfCornerShape,
}
