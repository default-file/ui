"use client"

import * as React from "react"

import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"

type SpinnerSize = "xs" | "sm" | "md" | "lg"

type SpinnerProps = React.HTMLAttributes<HTMLSpanElement> & {
  size?: SpinnerSize
}

function Spinner({
  className,
  size = "md",
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  ...props
}: SpinnerProps) {
  const s = useDfStrings()
  const isHidden = ariaHidden === true || ariaHidden === "true"

  return (
    <span
      data-df="spinner"
      data-size={size}
      className={cn("df-spinner", className)}
      role={isHidden ? undefined : "status"}
      aria-label={isHidden ? undefined : (ariaLabel ?? s.spinnerLoading)}
      aria-hidden={isHidden ? true : undefined}
      {...props}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle className="df-spinner-track" cx="8" cy="8" r="6" />
        <circle className="df-spinner-indicator" cx="8" cy="8" r="6" />
      </svg>
    </span>
  )
}

export { Spinner }
export type { SpinnerProps, SpinnerSize }
