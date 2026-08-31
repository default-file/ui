import * as React from "react"

import {
  resolvePaddingSides,
  type PaddingChromeProps,
} from "../lib/padding-chrome"
import { cn } from "../lib/utils"
import { Badge, type BadgeVariant } from "./df-badge"
import { Spinner, type SpinnerSize } from "./df-spinner"

/** Visual style. plain is icon only with no resting plate. */
type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"
  | "plain"

type TextButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "xl"
  | "2xl"

/** Square icon control sizes. Prefer with variant plain for overlay chrome. */
type IconButtonSize =
  | "icon"
  | "icon-2xs"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg"
  | "icon-xl"
  | "icon-2xl"

type ButtonSize = TextButtonSize | IconButtonSize

type ButtonLoadingAppearance = "muted" | "solid"
type ButtonBadgePosition = "edge" | "inset"
type ButtonBadgeSide = "start" | "end"

type ButtonChromeProps = PaddingChromeProps & {
  height?: string | undefined
  width?: string | undefined
  fontSize?: string | undefined
  lineHeight?: string | undefined
  fontFamily?: string | undefined
  fontWeight?: string | undefined
  radius?: string | undefined
}

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "height" | "width"
> &
  ButtonChromeProps & {
  /** Visual style. plain requires an icon size and an accessible name. */
  variant?: ButtonVariant
  /**
   * Text sizes use padding, type size, and line height. Icon sizes are square.
   * plain with a text size resolves to icon-xs.
   */
  size?: ButtonSize
  underline?: boolean
  /** Outline only. When true, drop the resting fill (data-transparent). */
  transparent?: boolean
  leading?: React.ReactNode
  trailing?: React.ReactNode
  loading?: boolean
  loadingPlacement?: "leading" | "trailing"
  loadingAppearance?: ButtonLoadingAppearance
  badge?: number | string
  badgeVariant?: BadgeVariant
  badgePosition?: ButtonBadgePosition
  badgeSide?: ButtonBadgeSide
}

const sizeClass: Record<ButtonSize, string> = {
  default: "df-btn-default-size",
  xs: "df-btn-xs",
  sm: "df-btn-sm",
  lg: "df-btn-lg",
  xl: "df-btn-xl",
  "2xl": "df-btn-2xl",
  icon: "df-btn-icon",
  "icon-2xs": "df-btn-icon-2xs",
  "icon-xs": "df-btn-icon-xs",
  "icon-sm": "df-btn-icon-sm",
  "icon-lg": "df-btn-icon-lg",
  "icon-xl": "df-btn-icon-xl",
  "icon-2xl": "df-btn-icon-2xl",
}

function isIconButtonSize(size: ButtonSize): boolean {
  return size.startsWith("icon")
}

function resolveButtonSize(
  variant: ButtonVariant,
  size: ButtonSize
): ButtonSize {
  if (variant === "plain" && !isIconButtonSize(size)) return "icon-xs"
  return size
}

function spinnerSizeForButton(size: ButtonSize): SpinnerSize {
  if (
    size === "xs" ||
    size === "sm" ||
    size === "icon-2xs" ||
    size === "icon-xs" ||
    size === "icon-sm"
  ) {
    return "xs"
  }
  if (
    size === "lg" ||
    size === "xl" ||
    size === "2xl" ||
    size === "icon-lg" ||
    size === "icon-xl" ||
    size === "icon-2xl"
  ) {
    return "md"
  }
  return "sm"
}

function shouldShowBadge(badge: number | string | undefined): boolean {
  if (badge == null || badge === "") return false
  if (typeof badge === "number" && badge <= 0) return false
  return true
}

function resolveButtonBadgeVariant(
  buttonVariant: ButtonVariant,
  badgeVariant?: BadgeVariant
): BadgeVariant {
  if (badgeVariant) return badgeVariant
  if (buttonVariant === "default") return "secondary"
  return "default"
}

function dfButtonClass({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  className?: string | undefined
} = {}) {
  return cn(
    "df-btn",
    `df-btn-${variant}`,
    sizeClass[resolveButtonSize(variant, size)],
    className
  )
}

function dfButtonChromeStyle({
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  height,
  width,
  fontSize,
  lineHeight,
  fontFamily,
  fontWeight,
  radius,
}: ButtonChromeProps): React.CSSProperties {
  const sides = resolvePaddingSides({
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  })
  return {
    ...(sides.top != null
      ? { "--df-button-padding-block-start": sides.top }
      : null),
    ...(sides.bottom != null
      ? { "--df-button-padding-block-end": sides.bottom }
      : null),
    ...(sides.left != null
      ? { "--df-button-padding-inline-start": sides.left }
      : null),
    ...(sides.right != null
      ? { "--df-button-padding-inline-end": sides.right }
      : null),
    ...(height != null ? { "--df-button-height": height } : null),
    ...(width != null ? { "--df-button-width": width } : null),
    ...(fontSize != null ? { "--df-button-font-size": fontSize } : null),
    ...(lineHeight != null ? { "--df-button-line-height": lineHeight } : null),
    ...(fontFamily != null
      ? { "--df-button-font-family": fontFamily }
      : null),
    ...(fontWeight != null
      ? { "--df-button-font-weight": fontWeight }
      : null),
    ...(radius != null ? { "--df-button-radius": radius } : null),
  } as React.CSSProperties
}

function Button({
  className,
  variant = "default",
  size = "default",
  underline = true,
  transparent = false,
  type = "button",
  leading,
  trailing,
  loading = false,
  loadingPlacement = "leading",
  loadingAppearance = "muted",
  badge,
  badgeVariant,
  badgePosition = "edge",
  badgeSide = "end",
  disabled,
  children,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  height,
  width,
  fontSize,
  lineHeight,
  fontFamily,
  fontWeight,
  radius,
  style,
  ...props
}: ButtonProps) {
  const resolvedSize = resolveButtonSize(variant, size)
  const supportsLoading = variant !== "link"
  const isLoading = Boolean(loading) && supportsLoading
  const spinner = isLoading ? (
    <Spinner size={spinnerSizeForButton(resolvedSize)} aria-hidden />
  ) : null

  const iconOnly = isIconButtonSize(resolvedSize)
  const outlineTransparent = variant === "outline" && transparent
  let resolvedLeading = leading
  let resolvedTrailing = trailing
  let resolvedChildren = children

  if (isLoading && spinner) {
    if (iconOnly) {
      resolvedLeading = undefined
      resolvedTrailing = undefined
      resolvedChildren = spinner
    } else if (loadingPlacement === "trailing") {
      resolvedTrailing = spinner
    } else {
      resolvedLeading = spinner
    }
  }

  const fadeLabel =
    isLoading &&
    loadingAppearance === "solid" &&
    !iconOnly &&
    resolvedChildren != null
  if (fadeLabel) {
    resolvedChildren = (
      <span data-df="button-slot" data-slot="label">
        {resolvedChildren}
      </span>
    )
  }

  const showBadge = shouldShowBadge(badge)
  const chromeStyle = dfButtonChromeStyle({
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    height,
    width,
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    radius,
  })

  return (
    <button
      type={type}
      data-df="button"
      data-variant={variant}
      data-size={resolvedSize}
      data-underline={
        variant === "link" ? (underline ? "hover" : "none") : undefined
      }
      data-transparent={outlineTransparent ? "" : undefined}
      data-loading={isLoading ? "" : undefined}
      data-loading-appearance={isLoading ? loadingAppearance : undefined}
      data-badge={showBadge ? "" : undefined}
      data-badge-position={showBadge ? badgePosition : undefined}
      data-badge-side={showBadge ? badgeSide : undefined}
      className={dfButtonClass({
        variant,
        size: resolvedSize,
        className,
      })}
      {...props}
      style={{ ...chromeStyle, ...style }}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {resolvedLeading != null && (
        <span
          className="df-btn-slot"
          data-df="button-slot"
          data-slot="leading"
          data-icon="inline-start"
        >
          {resolvedLeading}
        </span>
      )}
      {resolvedChildren}
      {resolvedTrailing != null && (
        <span
          className="df-btn-slot"
          data-df="button-slot"
          data-slot="trailing"
          data-icon="inline-end"
        >
          {resolvedTrailing}
        </span>
      )}
      {showBadge ? (
        <Badge
          data-slot="badge"
          variant={resolveButtonBadgeVariant(variant, badgeVariant)}
          size="xs"
          radius="full"
          aria-hidden
        >
          {badge}
        </Badge>
      ) : null}
    </button>
  )
}

export { Button, dfButtonClass, dfButtonChromeStyle }
export type {
  ButtonProps,
  ButtonChromeProps,
  ButtonVariant,
  ButtonSize,
  TextButtonSize,
  IconButtonSize,
  ButtonLoadingAppearance,
  ButtonBadgePosition,
  ButtonBadgeSide,
}
