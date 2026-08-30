"use client"

import * as React from "react"

import { useControllableState } from "../hooks"
import { cn } from "../lib/utils"

type RadioSize = "sm" | "md"

type RadioGroupContextValue = {
  name: string
  value: string | null
  setValue: (value: string) => void
  disabled: boolean
  invalid: boolean
  size: RadioSize
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null
)

function useRadioGroupContext() {
  const ctx = React.useContext(RadioGroupContext)
  if (!ctx) {
    throw new Error("RadioItem must be used within RadioGroup")
  }
  return ctx
}

type RadioGroupProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> & {
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
  name?: string
  disabled?: boolean
  invalid?: boolean
  size?: RadioSize
  label?: React.ReactNode
  description?: React.ReactNode
  orientation?: "vertical" | "horizontal"
}

function RadioGroup({
  className,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  name: nameProp,
  disabled = false,
  invalid = false,
  size = "md",
  label,
  description,
  orientation = "vertical",
  children,
  id: idProp,
  ...props
}: RadioGroupProps) {
  const reactId = React.useId()
  const name = nameProp ?? `df-radio-${reactId}`
  const labelId = label != null ? `df-radio-label-${reactId}` : undefined
  const descriptionId =
    description != null ? `df-radio-desc-${reactId}` : undefined
  const handleValueChange = React.useCallback(
    (next: string | null) => {
      if (next == null) return
      onValueChange?.(next)
    },
    [onValueChange]
  )
  const [value, setValue] = useControllableState<string | null>({
    value: valueProp,
    defaultValue,
    onChange: handleValueChange,
  })

  return (
    <RadioGroupContext.Provider
      value={{
        name,
        value,
        setValue: (next) => setValue(next),
        disabled,
        invalid,
        size,
      }}
    >
      <div
        {...props}
        id={idProp}
        role="radiogroup"
        data-df="radio-group"
        data-size={size}
        data-orientation={orientation}
        data-invalid={invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        className={cn(className)}
      >
        {label != null || description != null ? (
          <div data-df="radio-group-heading">
            {label != null ? (
              <div data-df="radio-group-label" id={labelId}>
                {label}
              </div>
            ) : null}
            {description != null ? (
              <div data-df="radio-group-description" id={descriptionId}>
                {description}
              </div>
            ) : null}
          </div>
        ) : null}
        <div data-df="radio-group-items">{children}</div>
      </div>
    </RadioGroupContext.Provider>
  )
}

type RadioItemProps = Omit<
  React.ComponentProps<"input">,
  "size" | "type" | "checked" | "defaultChecked" | "onChange" | "name"
> & {
  value: string
  label?: React.ReactNode
  description?: React.ReactNode
  size?: RadioSize
}

function RadioItem({
  className,
  value,
  label,
  description,
  disabled: disabledProp,
  id: idProp,
  size: sizeProp,
  ...props
}: RadioItemProps) {
  const ctx = useRadioGroupContext()
  const reactId = React.useId()
  const inputId = idProp ?? `df-radio-item-${reactId}`
  const descriptionId =
    description != null ? `df-radio-item-desc-${reactId}` : undefined
  const disabled = Boolean(disabledProp || ctx.disabled)
  const size = sizeProp ?? ctx.size
  const checked = ctx.value === value

  const control = (
    <span
      data-df="radio"
      data-size={size}
      data-state={checked ? "checked" : "unchecked"}
      data-invalid={ctx.invalid ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={label == null && description == null ? cn(className) : undefined}
    >
      <input
        {...props}
        id={inputId}
        type="radio"
        name={ctx.name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        data-df="radio-input"
        onChange={() => {
          if (disabled) return
          ctx.setValue(value)
        }}
      />
      <span data-df="radio-dot" aria-hidden />
    </span>
  )

  if (label == null && description == null) {
    return control
  }

  return (
    <label
      data-df="radio-field"
      data-size={size}
      data-invalid={ctx.invalid ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      htmlFor={inputId}
      className={cn(className)}
    >
      {control}
      <span data-df="radio-copy">
        {label != null ? <span data-df="radio-label">{label}</span> : null}
        {description != null ? (
          <span data-df="radio-description" id={descriptionId}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export { RadioGroup, RadioItem }
export type { RadioGroupProps, RadioItemProps, RadioSize }
