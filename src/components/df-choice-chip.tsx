import * as React from "react"

import { cn } from "../lib/utils"

type ChoiceChipSize = "sm" | "md" | "lg"

type ChoiceChipProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "size"
> & {
  selected?: boolean
  size?: ChoiceChipSize
}

function ChoiceChip({
  className,
  selected,
  size = "md",
  ...props
}: ChoiceChipProps) {
  return (
    <button
      type="button"
      data-df="choice-chip"
      data-size={size}
      data-selected={selected ? "true" : undefined}
      aria-pressed={selected == null ? undefined : selected}
      className={cn(className)}
      {...props}
    />
  )
}

export { ChoiceChip }
export type { ChoiceChipProps, ChoiceChipSize }
