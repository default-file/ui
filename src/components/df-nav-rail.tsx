"use client"

import * as React from "react"

import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import {
  resolveDfShadowIntensity,
  type DfShadowIntensity,
  type DfShadowIntensityStep,
} from "../lib/shadow-intensity"
import { cn } from "../lib/utils"

type NavRailSide = "left" | "right" | "top" | "bottom"

type NavRailRadius =
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

type NavRailShadowIntensityStep = DfShadowIntensityStep
type NavRailShadowIntensity = DfShadowIntensity

type NavRailProps = Omit<React.ComponentProps<"nav">, "color"> & {
  /** Edge the rail sits on. Controls inner border side and axis (vertical or horizontal). */
  side?: NavRailSide
  /**
   * Cross axis size of the rail. Prefer tokens such as var(--df-nav-rail-width).
   * On left or right this is the rail width. On top or bottom this is the rail height.
   * Sets --df-nav-rail-width.
   */
  width?: string
  /** Corner radius of the rail shell. */
  radius?: NavRailRadius
  /** Corner radius of item icon plates. Defaults to lg. */
  itemRadius?: NavRailRadius
  cornerShape?: DfCornerShape
  /** Rail background. Prefer tokens such as var(--background). Sets --df-nav-rail-bg. */
  background?: string
  /** Inner edge border color. Prefer tokens such as var(--border). Sets --df-nav-rail-border. */
  borderColor?: string
  /**
   * Resting icon and label color. Prefer tokens such as var(--muted-foreground).
   * Sets --df-nav-rail-fg.
   */
  iconColor?: string
  /**
   * Active icon plate fill. Prefer tokens such as var(--df-nav-rail-item-active-bg).
   * Sets --df-nav-rail-item-active-bg on this instance.
   */
  activeBackground?: string
  /**
   * Active icon and label color. Prefer tokens such as var(--df-nav-rail-item-active-fg).
   * Sets --df-nav-rail-item-active-fg on this instance.
   */
  activeForeground?: string
  /**
   * Box shadow. Prefer var(--df-nav-rail-shadow-edge-*) for an edge cast toward
   * the workspace, or none. Overrides edgeShadow when set. Sets --df-nav-rail-shadow.
   */
  shadow?: string
  /**
   * When true and shadow is omitted, applies the side matched edge shadow token.
   */
  edgeShadow?: boolean
  /**
   * Edge shadow strength. Prefer kit steps 2xs to 4xl. subtle, default, and strong
   * alias xs, lg, and 2xl. Pass 0 to 1 only for a custom strength. Sets
   * --df-nav-rail-shadow-intensity (defaults to --df-shadow-intensity-default).
   */
  shadowIntensity?: NavRailShadowIntensity
}

const EDGE_SHADOW_BY_SIDE: Record<NavRailSide, string> = {
  left: "var(--df-nav-rail-shadow-edge-left)",
  right: "var(--df-nav-rail-shadow-edge-right)",
  top: "var(--df-nav-rail-shadow-edge-top)",
  bottom: "var(--df-nav-rail-shadow-edge-bottom)",
}

function NavRail({
  className,
  style,
  side = "left",
  width,
  radius = "none",
  itemRadius = "lg",
  cornerShape,
  background,
  borderColor,
  iconColor,
  activeBackground,
  activeForeground,
  shadow,
  edgeShadow = false,
  shadowIntensity,
  children,
  ...props
}: NavRailProps) {
  const resolvedShadow =
    shadow != null
      ? shadow
      : edgeShadow
        ? EDGE_SHADOW_BY_SIDE[side]
        : undefined
  const resolvedIntensity = resolveDfShadowIntensity(shadowIntensity)

  const railStyle = {
    ...(width != null ? { "--df-nav-rail-width": width } : null),
    ...(background != null ? { "--df-nav-rail-bg": background } : null),
    ...(borderColor != null ? { "--df-nav-rail-border": borderColor } : null),
    ...(iconColor != null ? { "--df-nav-rail-fg": iconColor } : null),
    ...(activeBackground != null
      ? { "--df-nav-rail-item-active-bg": activeBackground }
      : null),
    ...(activeForeground != null
      ? { "--df-nav-rail-item-active-fg": activeForeground }
      : null),
    ...(resolvedShadow != null
      ? { "--df-nav-rail-shadow": resolvedShadow }
      : null),
    ...(resolvedIntensity != null
      ? { "--df-nav-rail-shadow-intensity": resolvedIntensity }
      : null),
    ...dfCornerShapeStyle(cornerShape),
    ...style,
  } as React.CSSProperties

  return (
    <nav
      data-df="nav-rail"
      data-side={side}
      data-radius={radius}
      data-item-radius={itemRadius}
      data-corner-shape={cornerShape}
      className={cn("df-nav-rail", className)}
      style={railStyle}
      {...props}
    >
      {children}
    </nav>
  )
}

type NavRailItemHostProps = {
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

type NavRailItemProps = Omit<React.ComponentProps<"button">, "children"> & {
  active?: boolean
  /** Glyph shown above the label. Swap freely per item. */
  icon: React.ReactNode
  children: React.ReactNode
  /** Merge item props onto a single child element (for example a link). */
  asChild?: boolean
  /** When true, the item is not rendered. */
  hidden?: boolean
  /**
   * Resting icon and label color for this item. Prefer tokens.
   * Sets --df-nav-rail-item-fg.
   */
  iconColor?: string
  /**
   * Active icon plate fill for this item. Prefer tokens.
   * Sets --df-nav-rail-item-active-bg.
   */
  activeBackground?: string
  /**
   * Active icon and label color for this item. Prefer tokens.
   * Sets --df-nav-rail-item-active-fg.
   */
  activeForeground?: string
}

function NavRailItemIconLabel({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: React.ReactNode
}) {
  return (
    <>
      <span data-df="nav-rail-item-icon" className="df-nav-rail-item-icon">
        {icon}
      </span>
      <span data-df="nav-rail-item-label" className="df-nav-rail-item-label">
        {label}
      </span>
    </>
  )
}

function NavRailItem({
  className,
  style,
  active = false,
  icon,
  children,
  asChild = false,
  hidden = false,
  disabled = false,
  iconColor,
  activeBackground,
  activeForeground,
  type = "button",
  ...props
}: NavRailItemProps) {
  if (hidden) return null

  const sharedClassName = cn("df-nav-rail-item", className)
  const state = active ? "active" : "inactive"
  const itemStyle = {
    ...(iconColor != null ? { "--df-nav-rail-item-fg": iconColor } : null),
    ...(activeBackground != null
      ? { "--df-nav-rail-item-active-bg": activeBackground }
      : null),
    ...(activeForeground != null
      ? { "--df-nav-rail-item-active-fg": activeForeground }
      : null),
    ...style,
  } as React.CSSProperties

  if (asChild) {
    const child = React.Children.only(children)
    if (!React.isValidElement<NavRailItemHostProps>(child)) {
      throw new Error(
        "NavRailItem asChild requires a single React element child."
      )
    }

    return React.cloneElement(child, {
      ...props,
      "data-df": "nav-rail-item",
      "data-state": state,
      "data-disabled": disabled ? "" : undefined,
      "aria-current": active && !disabled ? "page" : undefined,
      "aria-disabled": disabled || undefined,
      className: cn(sharedClassName, child.props.className),
      style: { ...itemStyle, ...child.props.style },
      children: (
        <NavRailItemIconLabel icon={icon} label={child.props.children} />
      ),
      ...(disabled
        ? {
            onClick: (event: React.MouseEvent) => {
              event.preventDefault()
            },
            tabIndex: -1,
          }
        : null),
    } as NavRailItemHostProps)
  }

  return (
    <button
      type={type}
      data-df="nav-rail-item"
      data-state={state}
      aria-current={active && !disabled ? "page" : undefined}
      disabled={disabled}
      className={sharedClassName}
      style={itemStyle}
      {...props}
    >
      <NavRailItemIconLabel icon={icon} label={children} />
    </button>
  )
}

type NavRailSeparatorProps = Omit<React.ComponentProps<"div">, "color"> & {
  /** Separator color. Prefer tokens such as var(--border). Sets --df-nav-rail-separator. */
  color?: string
  /** When true, the separator is not rendered. */
  hidden?: boolean
}

function NavRailSeparator({
  className,
  style,
  color,
  hidden = false,
  ...props
}: NavRailSeparatorProps) {
  if (hidden) return null

  const separatorStyle = {
    ...(color != null ? { "--df-nav-rail-separator": color } : null),
    ...style,
  } as React.CSSProperties

  return (
    <div
      role="none"
      data-df="nav-rail-separator"
      className={cn("df-nav-rail-separator", className)}
      style={separatorStyle}
      {...props}
    />
  )
}

export { NavRail, NavRailItem, NavRailSeparator }
export type {
  NavRailProps,
  NavRailItemProps,
  NavRailSeparatorProps,
  NavRailSide,
  NavRailRadius,
  NavRailShadowIntensity,
  NavRailShadowIntensityStep,
}
