"use client"

import * as React from "react"

import { cn } from "../lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      data-df="separator"
      data-orientation={orientation}
      data-vertical={orientation === "vertical" ? "" : undefined}
      data-horizontal={orientation === "horizontal" ? "" : undefined}
      className={cn(className)}
      {...props}
    />
  )
}

export { Separator }
