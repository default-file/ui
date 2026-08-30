import * as React from "react"

import { cn } from "../lib/utils"

type FeaturedIconVariant =
  | "soft"
  | "halo"
  | "filled"
  | "outline"
  | "surface"
  | "plate"
  | "plain"

type FeaturedIconSize =
  | "2xs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"

type FeaturedIconColor =
  | "brand"
  | "muted"
  | "success"
  | "warning"
  | "destructive"

type FeaturedIconShape = "circle" | "square"

type FeaturedIconRadius =
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

type FeaturedIconProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: FeaturedIconVariant
  size?: FeaturedIconSize
  color?: FeaturedIconColor
  shape?: FeaturedIconShape
  /** Square and radius overrides. Ignored for plain. Circle defaults to full when omitted. */
  radius?: FeaturedIconRadius
  /** Elevation shadow for filled, surface, and plate. Default true. */
  shadow?: boolean
  /** Container fill. CSS color; overrides the variant recipe. */
  background?: string
  /** Border and ring stroke. CSS color; overrides the variant recipe. */
  borderColor?: string
  /** Glyph color. CSS color; overrides the variant recipe. */
  iconColor?: string
  /**
   * Glyph size step. Same scale as size. When omitted, the glyph follows size.
   * Container footprint stays on size; only the icon drawing size changes.
   */
  iconSize?: FeaturedIconSize
  /**
   * Plain only. When true, apply the glyph drop shadow for busy surfaces.
   * Set false to turn the shadow off. Customize the filter with
   * --df-featured-icon-plain-glyph-filter when the shadow is on.
   */
  glyphShadow?: boolean
  children?: React.ReactNode
}

const SQUARE_DEFAULT_VARIANTS: ReadonlySet<FeaturedIconVariant> = new Set([
  "filled",
  "surface",
  "plate",
])

const ELEVATED_VARIANTS: ReadonlySet<FeaturedIconVariant> = new Set([
  "filled",
  "surface",
  "plate",
])

function resolveShape(
  variant: FeaturedIconVariant,
  shape?: FeaturedIconShape
): FeaturedIconShape | undefined {
  if (variant === "plain") return undefined
  if (shape) return shape
  return SQUARE_DEFAULT_VARIANTS.has(variant) ? "square" : "circle"
}

function chromeStyle(options: {
  background?: string | undefined
  borderColor?: string | undefined
  iconColor?: string | undefined
  style?: React.CSSProperties | undefined
}): React.CSSProperties | undefined {
  const { background, borderColor, iconColor, style } = options
  if (
    background == null &&
    borderColor == null &&
    iconColor == null &&
    style == null
  ) {
    return undefined
  }
  return {
    ...(background != null ? { "--df-featured-icon-bg": background } : null),
    ...(borderColor != null
      ? {
          "--df-featured-icon-border": borderColor,
          "--df-featured-icon-border-soft": borderColor,
        }
      : null),
    ...(iconColor != null
      ? {
          "--df-featured-icon-icon": iconColor,
          color: iconColor,
        }
      : null),
    ...style,
  } as React.CSSProperties
}

const FeaturedIcon = React.forwardRef<HTMLDivElement, FeaturedIconProps>(
  function FeaturedIcon(
    {
      className,
      style,
      variant = "soft",
      size = "md",
      color = "brand",
      shape: shapeProp,
      radius,
      shadow = true,
      background,
      borderColor,
      iconColor,
      iconSize,
      glyphShadow = true,
      children,
      ...props
    },
    ref
  ) {
    const shape = resolveShape(variant, shapeProp)
    const plain = variant === "plain"
    const elevated = ELEVATED_VARIANTS.has(variant)
    const mergedStyle = chromeStyle({
      background,
      borderColor,
      iconColor,
      style,
    })

    return (
      <div
        ref={ref}
        data-df="featured-icon"
        data-variant={variant}
        data-size={size}
        data-icon-size={iconSize}
        data-color={color}
        data-shape={shape}
        data-radius={plain ? undefined : radius}
        data-shadow={elevated && !shadow ? "off" : undefined}
        data-glyph-shadow={plain && !glyphShadow ? "off" : undefined}
        data-icon-override={iconColor != null ? "" : undefined}
        className={cn(className)}
        style={mergedStyle}
        {...props}
      >
        <span data-slot="glyph" aria-hidden>
          {children}
        </span>
      </div>
    )
  }
)

export { FeaturedIcon }
export type {
  FeaturedIconProps,
  FeaturedIconVariant,
  FeaturedIconSize,
  FeaturedIconColor,
  FeaturedIconShape,
  FeaturedIconRadius,
}
