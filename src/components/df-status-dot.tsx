import * as React from "react"

import { cn } from "../lib/utils"

type StatusDotSize = "xs" | "sm" | "md" | "lg" | "xl"

type StatusDotProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Diameter step. Omit inside Badge to follow the badge size. */
  size?: StatusDotSize
}

function StatusDot({ className, size, ...props }: StatusDotProps) {
  return (
    <span
      data-df="status-dot"
      data-size={size}
      aria-hidden
      className={cn(className)}
      {...props}
    />
  )
}

export { StatusDot }
export type { StatusDotProps, StatusDotSize }
