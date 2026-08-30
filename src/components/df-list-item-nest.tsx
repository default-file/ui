"use client"

import * as React from "react"

import { cn } from "../lib/utils"

type ListItemNestChromeProps = {
  /** Outer inset before the nest group. Sets --df-list-item-nest-indent. */
  indent?: string | undefined
  /** Inner pad after the guide line. Sets --df-list-item-nest-pad. */
  pad?: string | undefined
  /** Gap between nested rows. Sets --df-list-item-nest-gap. */
  gap?: string | undefined
  /** Guide line thickness. Sets --df-list-item-nest-line-width. */
  lineWidth?: string | undefined
  /** Guide line color. Prefer var(--border). Sets --df-list-item-nest-line-color. */
  lineColor?: string | undefined
}

type ListItemNestProps = React.ComponentProps<"div"> &
  ListItemNestChromeProps & {
    /** When true, paints the nest guide line. */
    line?: boolean
  }

const ListItemNestScopeContext = React.createContext(false)

function useListItemNestScope() {
  return React.useContext(ListItemNestScopeContext)
}

function listItemNestChromeStyle({
  indent,
  pad,
  gap,
  lineWidth,
  lineColor,
}: ListItemNestChromeProps): React.CSSProperties {
  return {
    ...(indent != null ? { "--df-list-item-nest-indent": indent } : null),
    ...(pad != null ? { "--df-list-item-nest-pad": pad } : null),
    ...(gap != null ? { "--df-list-item-nest-gap": gap } : null),
    ...(lineWidth != null
      ? { "--df-list-item-nest-line-width": lineWidth }
      : null),
    ...(lineColor != null
      ? { "--df-list-item-nest-line-color": lineColor }
      : null),
  } as React.CSSProperties
}

function ListItemNest({
  className,
  style,
  line = true,
  indent,
  pad,
  gap,
  lineWidth,
  lineColor,
  ...props
}: ListItemNestProps) {
  return (
    <ListItemNestScopeContext.Provider value={true}>
      <div
        data-df="list-item-nest"
        data-line={line ? "true" : "false"}
        className={cn(className)}
        style={{
          ...listItemNestChromeStyle({
            indent,
            pad,
            gap,
            lineWidth,
            lineColor,
          }),
          ...style,
        }}
        {...props}
      />
    </ListItemNestScopeContext.Provider>
  )
}

export { ListItemNest, useListItemNestScope }
export type { ListItemNestChromeProps, ListItemNestProps }
