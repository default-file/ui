"use client"

import * as React from "react"

import { useControllableState, useRovingTabIndex } from "../hooks"
import type { RovingItemProps } from "../hooks"
import { cn, composeEventHandlers } from "../lib/utils"

type ContentSwitcherSize = "default" | "sm" | "xs"

type ContentSwitcherContextValue = {
  value: string
  setValue: (value: string) => void
  orientation: "horizontal" | "vertical"
  fullWidth: boolean
  size: ContentSwitcherSize
  deselectable: boolean
  getRovingProps: (itemValue: string) => RovingItemProps | null
  setActiveForValue: (itemValue: string) => void
}

const ContentSwitcherContext =
  React.createContext<ContentSwitcherContextValue | null>(null)

function useContentSwitcherContext() {
  const ctx = React.useContext(ContentSwitcherContext)
  if (!ctx) {
    throw new Error(
      "ContentSwitcherItem must be used within ContentSwitcher"
    )
  }
  return ctx
}

type ContentSwitcherProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
  fullWidth?: boolean
  size?: ContentSwitcherSize
  deselectable?: boolean
}

function isContentSwitcherItemElement(
  node: React.ReactNode
): node is React.ReactElement<ContentSwitcherItemProps> {
  return React.isValidElement(node) && node.type === ContentSwitcherItem
}

function ContentSwitcher({
  className,
  value,
  defaultValue = "",
  onValueChange,
  orientation = "horizontal",
  fullWidth = false,
  size = "default",
  deselectable = false,
  children,
  ...props
}: ContentSwitcherProps) {
  const [current, setCurrent] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  })

  const childArray = React.Children.toArray(children)
  const itemNodes: React.ReactElement<ContentSwitcherItemProps>[] = []
  for (const child of childArray) {
    if (isContentSwitcherItemElement(child)) itemNodes.push(child)
  }
  const itemValues = itemNodes.map((child) => child.props.value)

  const selectedIndex = itemNodes.findIndex(
    (child) => child.props.value === current
  )
  const defaultRovingIndex =
    selectedIndex >= 0
      ? selectedIndex
      : itemNodes.findIndex((child) => !child.props.disabled)

  const selectOnRoveRef = React.useRef(false)

  const { getItemProps, setActiveIndex } = useRovingTabIndex({
    count: itemNodes.length,
    orientation,
    defaultActiveIndex: defaultRovingIndex >= 0 ? defaultRovingIndex : 0,
    isItemDisabled: (index) => Boolean(itemNodes[index]?.props.disabled),
    onActiveIndexChange: (index) => {
      if (!selectOnRoveRef.current) return
      const next = itemNodes[index]
      if (next == null || next.props.disabled) return
      if (next.props.value === current) return
      setCurrent(next.props.value)
    },
  })

  const getRovingProps = React.useCallback(
    (itemValue: string) => {
      const index = itemValues.indexOf(itemValue)
      if (index < 0) return null
      const roving = getItemProps(index)
      return {
        ...roving,
        onKeyDown: (event: React.KeyboardEvent) => {
          const isRoveKey =
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown" ||
            event.key === "Home" ||
            event.key === "End"
          if (isRoveKey) selectOnRoveRef.current = true
          try {
            roving.onKeyDown(event)
          } finally {
            selectOnRoveRef.current = false
          }
        },
      }
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
    <ContentSwitcherContext.Provider
      value={{
        value: current,
        setValue: setCurrent,
        orientation,
        fullWidth,
        size,
        deselectable,
        getRovingProps,
        setActiveForValue,
      }}
    >
      <div
        role="radiogroup"
        data-df="content-switcher"
        data-orientation={orientation}
        data-full-width={fullWidth ? "" : undefined}
        data-size={size}
        data-deselectable={deselectable ? "" : undefined}
        className={cn("df-content-switcher", className)}
        {...props}
      >
        {children}
      </div>
    </ContentSwitcherContext.Provider>
  )
}

type ContentSwitcherItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string
}

function ContentSwitcherItem({
  className,
  value,
  children,
  disabled,
  type = "button",
  onClick,
  onFocus,
  onKeyDown,
  ...props
}: ContentSwitcherItemProps) {
  const {
    value: current,
    setValue,
    fullWidth,
    size,
    deselectable,
    getRovingProps,
    setActiveForValue,
  } = useContentSwitcherContext()
  const selected = current === value
  const roving = getRovingProps(value)

  return (
    <button
      type={type}
      ref={roving?.ref}
      tabIndex={roving?.tabIndex ?? -1}
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      data-df="content-switcher-item"
      data-state={selected ? "on" : "off"}
      data-full-width={fullWidth ? "" : undefined}
      data-size={size}
      className={cn("df-content-switcher-item", className)}
      {...props}
      onFocus={composeEventHandlers(onFocus, (event) => {
        roving?.onFocus(event)
      })}
      onKeyDown={composeEventHandlers(onKeyDown, (event) => {
        roving?.onKeyDown(event)
        if (event.defaultPrevented) return
        if (event.key !== " " && event.key !== "Enter") return
        if (disabled) return
        event.preventDefault()
        setActiveForValue(value)
        if (deselectable && selected) {
          setValue("")
          return
        }
        setValue(value)
      })}
      onClick={composeEventHandlers(onClick, () => {
        if (disabled) return
        setActiveForValue(value)
        if (deselectable && selected) {
          setValue("")
          return
        }
        setValue(value)
      })}
    >
      {children}
    </button>
  )
}

export { ContentSwitcher, ContentSwitcherItem }
export type {
  ContentSwitcherProps,
  ContentSwitcherItemProps,
  ContentSwitcherSize,
}
