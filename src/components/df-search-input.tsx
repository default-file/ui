"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { Input, type InputProps } from "./df-input"
import { useControllableState } from "../hooks"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"

type SearchInputSize = "sm" | "md" | "lg"
type SearchInputIconPosition = "start" | "end"

type SearchInputProps = Omit<
  React.ComponentProps<"input">,
  "className" | "size" | "height"
> &
  Pick<InputProps, "background" | "hoverBorder" | "hoverBorderColor"> & {
    className?: string
    inputClassName?: string
    leadingIcon?: React.ReactNode | false
    iconPosition?: SearchInputIconPosition
    trailing?: React.ReactNode
    clearable?: boolean
    onClear?: () => void
    variant?: "default" | "pill"
    size?: SearchInputSize
  }

function SearchInput({
  className,
  inputClassName,
  leadingIcon,
  iconPosition = "start",
  trailing,
  clearable = true,
  onClear,
  variant = "default",
  size = "md",
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  ...props
}: SearchInputProps) {
  const s = useDfStrings()
  const [current, setCurrent] = useControllableState<string>({
    value: value === undefined ? undefined : String(value),
    defaultValue:
      defaultValue === undefined || defaultValue === null
        ? ""
        : String(defaultValue),
  })

  const filled = current.trim().length > 0
  const state = filled ? "filled" : "placeholder"
  const showIcon = leadingIcon !== false
  const iconNode = leadingIcon ?? <Search aria-hidden />
  const showClear = clearable && filled && !disabled
  const showTrailingActions = Boolean(trailing) || showClear

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setCurrent(event.target.value)
    onChange?.(event)
  }

  function handleClear() {
    setCurrent("")
    onClear?.()
    onChange?.({
      target: { value: "" },
      currentTarget: { value: "" },
    } as React.ChangeEvent<HTMLInputElement>)
  }

  const searchIcon = showIcon ? (
    <span data-df="search-input-icon" data-side={iconPosition} aria-hidden>
      {iconNode}
    </span>
  ) : null

  return (
    <div
      className={cn(className)}
      data-df="search-input"
      data-state={state}
      data-variant={variant}
      data-size={size}
      data-icon-position={iconPosition}
      data-clearable={clearable ? "" : undefined}
      data-has-icon={showIcon ? "" : undefined}
      data-has-trailing={showTrailingActions ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      {searchIcon}

      <Input
        {...props}
        disabled={disabled}
        placeholder={placeholder}
        value={current}
        onChange={handleChange}
        size={size}
        className={cn(inputClassName)}
      />

      {showTrailingActions ? (
        <div data-df="search-input-trailing">
          {showClear ? (
            <button
              type="button"
              data-df="search-input-clear"
              aria-label={s.searchInputClear}
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={handleClear}
            >
              <X aria-hidden />
            </button>
          ) : null}
          {trailing}
        </div>
      ) : null}
    </div>
  )
}

const SearchBar = SearchInput

export { SearchInput, SearchBar }
export type { SearchInputProps, SearchInputSize, SearchInputIconPosition }
