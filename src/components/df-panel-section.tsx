import * as React from "react"

import { cn } from "../lib/utils"

function PanelSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)} data-df="panel-section">
      <p className="text-11 font-semibold tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  )
}

export { PanelSection }
