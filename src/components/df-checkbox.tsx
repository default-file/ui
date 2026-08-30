"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"

import { useControllableState } from "../hooks"
import { cn } from "../lib/utils"

type CheckboxSize = "sm" | "md"

type CheckboxProps = Omit<
  React.ComponentProps<"input">,
  "size" | "type" | "checked" | "defaultChecked" | "onChange"
> & {
  checked?: boolean | "indeterminate"
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean | "indeterminate") => void
  size?: CheckboxSize
  invalid?: boolean
  label?: React.ReactNode
  description?: React.ReactNode
}

function Checkbox({
  className,
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  size = "md",
  invalid = false,
  disabled,
  id: idProp,
  label,
  description,
  name,
  value,
  required,
  ...props
}: CheckboxProps) {
  const reactId = React.useId()
  const inputId = idProp ?? `df-checkbox-${reactId}`
  const descriptionId =
    description != null ? `df-checkbox-desc-${reactId}` : undefined
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [checked, setChecked] = useControllableState<boolean | "indeterminate">({
    value: checkedProp,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  })

  const isIndeterminate = checked === "indeterminate"
  const isChecked = checked === true

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setChecked(event.target.checked)
  }

  const control = (
    <span
      data-df="checkbox"
      data-size={size}
      data-state={
        isIndeterminate ? "indeterminate" : isChecked ? "checked" : "unchecked"
      }
      data-invalid={invalid ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={label == null && description == null ? cn(className) : undefined}
    >
      <input
        {...props}
        ref={inputRef}
        id={inputId}
        type="checkbox"
        name={name}
        value={value}
        checked={isChecked}
        disabled={disabled}
        required={required}
        aria-checked={isIndeterminate ? "mixed" : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={descriptionId}
        data-df="checkbox-input"
        onChange={handleChange}
      />
      <span data-df="checkbox-box" aria-hidden>
        {isIndeterminate ? (
          <Minus data-df="checkbox-icon" />
        ) : isChecked ? (
          <Check data-df="checkbox-icon" />
        ) : null}
      </span>
    </span>
  )

  if (label == null && description == null) {
    return control
  }

  return (
    <label
      data-df="checkbox-field"
      data-size={size}
      data-invalid={invalid ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      htmlFor={inputId}
      className={cn(className)}
    >
      {control}
      <span data-df="checkbox-copy">
        {label != null ? (
          <span data-df="checkbox-label">{label}</span>
        ) : null}
        {description != null ? (
          <span data-df="checkbox-description" id={descriptionId}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export { Checkbox }
export type { CheckboxProps, CheckboxSize }
