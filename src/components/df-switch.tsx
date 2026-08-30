"use client"

import * as React from "react"

import { useControllableState } from "../hooks"
import { cn, composeEventHandlers } from "../lib/utils"

type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: "sm" | "default"
}

function Switch({
  className,
  checked,
  defaultChecked = false,
  onCheckedChange,
  size = "default",
  disabled,
  ...props
}: SwitchProps) {
  const [isChecked, setChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  })

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-df="switch"
      data-size={size}
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      className={cn(className)}
      {...props}
      onClick={composeEventHandlers(props.onClick, () => {
        if (disabled) return
        setChecked(!isChecked)
      })}
    >
      <span data-df="switch-thumb" />
    </button>
  )
}

export { Switch }
