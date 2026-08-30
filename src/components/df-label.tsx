"use client"

import * as React from "react"

import { useDfStrings } from "../lib/df-intl"
import { sanitizeCssColor, sanitizeCssLength } from "../lib/df-css-value"
import { cn } from "../lib/utils"

type LabelMarkVariant = "asterisk" | "text"
type LabelAs = "label" | "div"
type LabelInsetAlign = "left" | "content" | "custom"

type LabelProps = Omit<React.ComponentPropsWithoutRef<"div">, "color"> & {
  as?: LabelAs | undefined
  htmlFor?: string | undefined
  required?: boolean | undefined
  optional?: boolean | undefined
  requiredVariant?: LabelMarkVariant | undefined
  optionalVariant?: LabelMarkVariant | undefined
  requiredColor?: string | undefined
  subtext?: React.ReactNode | undefined
  leading?: React.ReactNode | undefined
  trailing?: React.ReactNode | undefined
  color?: string | undefined
  fontFamily?: string | undefined
  fontSize?: string | undefined
  fontWeight?: string | undefined
  insetAlign?: LabelInsetAlign | undefined
  insetSize?: string | undefined
}

function Label({
  as = "label",
  className,
  style,
  children,
  htmlFor,
  required = false,
  optional = false,
  requiredVariant = "asterisk",
  optionalVariant = "text",
  requiredColor,
  subtext,
  leading,
  trailing,
  color,
  fontFamily,
  fontSize,
  fontWeight,
  insetAlign = "left",
  insetSize,
  ...props
}: LabelProps) {
  const s = useDfStrings()
  const showOptional = optional && !required
  const safeRequiredColor =
    requiredColor != null ? sanitizeCssColor(requiredColor) : null
  const safeColor = color != null ? sanitizeCssColor(color) : null
  const safeFontSize = fontSize != null ? sanitizeCssLength(fontSize) : null
  const safeInsetSize = insetSize != null ? sanitizeCssLength(insetSize) : null
  const rootProps = {
    "data-df": "label",
    "data-required": required ? "" : undefined,
    "data-optional": showOptional ? "" : undefined,
    "data-inset": insetAlign,
    className: cn(className),
    style: {
      ...(safeRequiredColor != null
        ? { "--label-required": safeRequiredColor }
        : null),
      ...(safeColor != null ? { "--df-label-color": safeColor } : null),
      ...(fontFamily != null ? { "--df-label-font": fontFamily } : null),
      ...(safeFontSize != null ? { "--df-label-size": safeFontSize } : null),
      ...(fontWeight != null ? { "--df-label-weight": fontWeight } : null),
      ...(insetAlign === "custom" && safeInsetSize != null
        ? { "--df-label-inset-custom": safeInsetSize }
        : null),
      ...style,
    } as React.CSSProperties,
    ...props,
  }

  const content = (
    <>
      <span data-df="label-row">
        <span data-df="label-title">
          {leading != null ? (
            <span data-df="label-leading">{leading}</span>
          ) : null}
          <span data-df="label-text">{children}</span>
          {required ? (
            <span
              data-df="label-required"
              data-variant={requiredVariant}
              aria-hidden="true"
            >
              {requiredVariant === "text" ? s.labelRequired : s.labelAsterisk}
            </span>
          ) : null}
          {showOptional ? (
            <span
              data-df="label-optional"
              data-variant={optionalVariant}
              aria-hidden="true"
            >
              {optionalVariant === "asterisk"
                ? s.labelAsterisk
                : s.labelOptional}
            </span>
          ) : null}
        </span>
        {trailing != null ? (
          <span data-df="label-trailing">{trailing}</span>
        ) : null}
      </span>
      {subtext != null ? (
        <span data-df="label-subtext">{subtext}</span>
      ) : null}
    </>
  )

  return React.createElement(
    as === "div" ? "div" : "label",
    {
      ...rootProps,
      ...(as !== "div" ? { htmlFor } : null),
    },
    content
  )
}

export { Label }
export type { LabelAs, LabelInsetAlign, LabelMarkVariant, LabelProps }
