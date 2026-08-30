"use client"

import * as React from "react"

import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"

type ProgressSize = "sm" | "md"

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Completeness from 0 to 100. Omit for an indeterminate bar. */
  value?: number
  size?: ProgressSize
}

type ProgressIndicatorStyle = React.CSSProperties & {
  "--df-progress-value"?: string
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function Progress({
  className,
  value,
  size = "md",
  "aria-label": ariaLabel,
  ...props
}: ProgressProps) {
  const s = useDfStrings()
  const determinate = typeof value === "number"
  const pct = determinate ? clampProgress(value) : null
  const indicatorStyle: ProgressIndicatorStyle | undefined =
    pct == null
      ? undefined
      : {
          "--df-progress-value": `${pct}%`,
        }

  return (
    <div
      data-df="progress"
      data-size={size}
      data-state={determinate ? "determinate" : "indeterminate"}
      className={cn("df-progress", className)}
      role="progressbar"
      aria-label={ariaLabel ?? s.progressAriaLabel}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={pct == null ? undefined : Math.round(pct)}
      aria-valuetext={determinate ? undefined : s.progressIndeterminate}
      aria-busy={determinate ? undefined : true}
      {...props}
    >
      <div className="df-progress-indicator" style={indicatorStyle} />
    </div>
  )
}

export { Progress }
export type { ProgressProps, ProgressSize }
