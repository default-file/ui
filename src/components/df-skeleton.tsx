import * as React from "react"

import { cn } from "../lib/utils"

type SkeletonShape = "text" | "block" | "circle"

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  shape?: SkeletonShape
  width?: string
  height?: string
}

function Skeleton({
  className,
  shape = "text",
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      data-df="skeleton"
      data-shape={shape}
      aria-hidden
      className={cn(className)}
      style={{
        ...(width != null ? { width } : null),
        ...(height != null ? { height } : null),
        ...style,
      }}
      {...props}
    />
  )
}

export { Skeleton }
export type { SkeletonProps, SkeletonShape }
