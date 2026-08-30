import * as React from "react"

import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import { cn } from "../lib/utils"

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"

type BadgeSize = "xs" | "sm" | "md" | "lg" | "xl"

type BadgeRadius =
  | "none"
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

/** Design scale units for space between leading, label, trailing, and count. */
type BadgeGap = number | "none"

type BadgeProps = React.HTMLAttributes<HTMLElement> & {
  variant?: BadgeVariant
  size?: BadgeSize
  radius?: BadgeRadius
  cornerShape?: DfCornerShape
  /**
   * Space between leading, label, trailing, and count.
   * Design scale units (one unit = --spacing-unit). Omit to use the size default.
   */
  gap?: BadgeGap
  /** Content before the label, such as a status icon. */
  leading?: React.ReactNode
  /** Content after the label, such as a close control or chevron. */
  trailing?: React.ReactNode
  count?: number | string
  render?: React.ReactElement<{
    className?: string
    children?: React.ReactNode
    style?: React.CSSProperties
  }>
}

function resolveCounterVariant(variant: BadgeVariant): BadgeVariant {
  return variant === "default" ? "secondary" : "default"
}

function badgeGapStyle(gap: BadgeGap | undefined): React.CSSProperties | undefined {
  if (gap == null) return undefined
  return {
    "--df-badge-gap": gap === "none" ? 0 : gap,
  } as React.CSSProperties
}

const Badge = React.forwardRef<HTMLElement, BadgeProps>(function Badge(
  {
    className,
    style,
    variant = "default",
    size = "md",
    radius = "4xl",
    cornerShape,
    gap,
    leading,
    trailing,
    count,
    render,
    children,
    ...props
  },
  ref
) {
  const classes = cn(className)
  const cornerStyle = dfCornerShapeStyle(cornerShape)
  const gapStyle = badgeGapStyle(gap)
  const mergedStyle = (
    cornerStyle || gapStyle || style
      ? { ...cornerStyle, ...gapStyle, ...style }
      : undefined
  ) as React.CSSProperties | undefined
  const hasCount = count != null && count !== ""
  const hasContent =
    leading != null || children != null || trailing != null || hasCount
  const content = hasContent ? (
    <>
      {leading != null ? (
        <span
          data-df="badge-slot"
          data-slot="leading"
          data-icon="inline-start"
        >
          {leading}
        </span>
      ) : null}
      {children}
      {trailing != null ? (
        <span
          data-df="badge-slot"
          data-slot="trailing"
          data-icon="inline-end"
        >
          {trailing}
        </span>
      ) : null}
      {hasCount ? (
        <span
          data-df="badge"
          data-slot="counter"
          data-variant={resolveCounterVariant(variant)}
          data-size="xs"
          data-radius="full"
        >
          {count}
        </span>
      ) : null}
    </>
  ) : undefined
  const gapAttr = gap === "none" ? "none" : gap

  if (render) {
    return React.cloneElement(render, {
      ...props,
      ref,
      "data-df": "badge",
      "data-variant": variant,
      "data-size": size,
      "data-radius": radius,
      "data-corner-shape": cornerShape,
      "data-gap": gapAttr,
      style: {
        ...cornerStyle,
        ...gapStyle,
        ...render.props.style,
        ...style,
      },
      className: cn(classes, render.props.className),
      children: content ?? render.props.children,
    } as never)
  }

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      data-df="badge"
      data-variant={variant}
      data-size={size}
      data-radius={radius}
      data-corner-shape={cornerShape}
      data-gap={gapAttr}
      className={classes}
      style={mergedStyle}
      {...props}
    >
      {content}
    </span>
  )
})

export { Badge }
export type {
  BadgeProps,
  BadgeGap,
  BadgeRadius,
  BadgeSize,
  BadgeVariant,
  DfCornerShape,
}
