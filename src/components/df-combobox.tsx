"use client"

import * as React from "react"
import { X } from "lucide-react"

import { useControllableState, useIsomorphicLayoutEffect } from "../hooks"
import {
  enabledComboboxIndexes,
  filterComboboxOptions,
  isComboboxOptionInteractive,
  mergeComboboxOptions,
  moveComboboxActiveIndex,
  resolveComboboxCommit,
  resolveComboboxDisplayText,
  type ComboboxOption,
} from "../lib/df-combobox"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"
import type { ListItemChromeProps } from "./df-list-item"
import {
  OptionList,
  OptionListContent,
  OptionListItem,
  useOptionListContext,
} from "./df-option-list"

const ASYNC_DEBOUNCE_MS = 160

export type { ComboboxOption }

export type ComboboxProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options?: readonly ComboboxOption[]
  loadOptions?: (query: string) => Promise<ComboboxOption[]>
  allowCustomValue?: boolean
  clearable?: boolean
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  debounceMs?: number
  id?: string
  className?: string
  emptyContent?: React.ReactNode
  /** Default List Item chrome for every option row. Forwarded to OptionList. */
  itemChrome?: ListItemChromeProps
  "aria-label"?: string
  "aria-labelledby"?: string
}

function ComboboxField({
  text,
  setText,
  disabled,
  invalid,
  placeholder,
  id,
  clearable,
  inputRef,
  filtered,
  allowCustomValue,
  onClear,
  onCommitCustom,
  ariaLabel,
  ariaLabelledBy,
}: {
  text: string
  setText: (value: string) => void
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  placeholder?: string | undefined
  id?: string | undefined
  clearable?: boolean | undefined
  inputRef: React.RefObject<HTMLInputElement | null>
  filtered: ComboboxOption[]
  allowCustomValue: boolean
  onClear: () => void
  onCommitCustom: (value: string) => void
  ariaLabel?: string | undefined
  ariaLabelledBy?: string | undefined
}) {
  const s = useDfStrings()
  const {
    triggerRef,
    open,
    setOpen,
    listboxId,
    activeValue,
    setActiveValue,
    optionDomId,
    setValue,
  } = useOptionListContext()

  const enabledIndexes = enabledComboboxIndexes(filtered)
  const activeIndex =
    activeValue == null
      ? null
      : filtered.findIndex((option) => option.value === activeValue)

  function commit() {
    const result = resolveComboboxCommit({
      activeIndex: activeIndex === -1 ? null : activeIndex,
      filtered,
      query: text,
      allowCustomValue,
    })
    if (result.kind === "option") {
      setValue(result.option.value)
      setOpen(false)
      return
    }
    if (result.kind === "custom") {
      onCommitCustom(result.value)
      setOpen(false)
    }
  }

  return (
    <div
      ref={triggerRef as React.RefObject<HTMLDivElement>}
      data-df="combobox-field"
      data-disabled={disabled ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-clearable={clearable && text.length > 0 ? "" : undefined}
    >
      <input
        ref={inputRef}
        id={id}
        data-df="combobox-input"
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        aria-label={ariaLabelledBy == null ? ariaLabel : undefined}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={
          open && activeValue != null ? optionDomId(activeValue) : undefined
        }
        onChange={(event) => {
          setText(event.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          if (!disabled) setOpen(true)
        }}
        onKeyDown={(event) => {
          if (disabled) return

          if (event.key === "Escape") {
            if (open) {
              event.preventDefault()
              setOpen(false)
            }
            return
          }

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            if (!open) setOpen(true)
            const nextIndex = moveComboboxActiveIndex(
              activeIndex === -1 ? null : activeIndex,
              event.key === "ArrowDown" ? 1 : -1,
              enabledIndexes
            )
            setActiveValue(
              nextIndex == null ? null : (filtered[nextIndex]?.value ?? null)
            )
            return
          }

          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
        }}
      />
      {clearable && text.length > 0 && !disabled ? (
        <button
          type="button"
          data-df="combobox-clear"
          aria-label={s.comboboxClear}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={onClear}
        >
          <X aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

function ComboboxActiveSync({ filtered }: { filtered: ComboboxOption[] }) {
  const { open, activeValue, setActiveValue } = useOptionListContext()
  const valuesKey = filtered.map((option) => option.value).join("\0")

  React.useEffect(() => {
    if (!open) {
      if (activeValue != null) setActiveValue(null)
      return
    }
    if (activeValue == null) return
    const stillValid = filtered.some(
      (option) =>
        option.value === activeValue && isComboboxOptionInteractive(option)
    )
    if (!stillValid) setActiveValue(null)
  }, [activeValue, filtered, open, setActiveValue, valuesKey])

  return null
}

function Combobox({
  value,
  defaultValue = "",
  onValueChange,
  options = [],
  loadOptions,
  allowCustomValue = false,
  clearable = true,
  placeholder,
  disabled = false,
  invalid = false,
  open,
  defaultOpen = false,
  onOpenChange,
  debounceMs = ASYNC_DEBOUNCE_MS,
  id,
  className,
  emptyContent,
  itemChrome,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ComboboxProps) {
  const s = useDfStrings()
  const resolvedPlaceholder = placeholder ?? s.comboboxPlaceholder
  const [committed, setCommitted] = useControllableState<string>({
    value,
    defaultValue,
    onChange: onValueChange,
  })
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const [asyncOptions, setAsyncOptions] = React.useState<ComboboxOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const merged = React.useMemo(
    () => mergeComboboxOptions(options, asyncOptions),
    [asyncOptions, options]
  )
  const [text, setText] = React.useState(() =>
    resolveComboboxDisplayText(
      value ?? defaultValue,
      options,
      allowCustomValue
    )
  )
  const filtered = React.useMemo(
    () => filterComboboxOptions(merged, text),
    [merged, text]
  )
  const selectedValue = committed.length > 0 ? committed : null

  const requestIdRef = React.useRef(0)
  const lastSyncedCommittedRef = React.useRef(committed)

  useIsomorphicLayoutEffect(() => {
    if (lastSyncedCommittedRef.current !== committed) {
      lastSyncedCommittedRef.current = committed
      setText(resolveComboboxDisplayText(committed, merged, allowCustomValue))
      return
    }
    if (isOpen) return
    const resolved = resolveComboboxDisplayText(
      committed,
      merged,
      allowCustomValue
    )
    setText((current) => {
      if (current === resolved) return current
      if (current === committed || current.length === 0) return resolved
      return current
    })
  }, [allowCustomValue, committed, isOpen, merged])

  React.useEffect(() => {
    if (!isOpen || !loadOptions) return
    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(() => {
      setLoading(true)
      void loadOptions(text)
        .then((next) => {
          if (requestIdRef.current !== requestId) return
          setAsyncOptions(next)
          setLoading(false)
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return
          setAsyncOptions([])
          setLoading(false)
        })
    }, debounceMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [debounceMs, isOpen, loadOptions, text])

  function commitOption(option: ComboboxOption) {
    setCommitted(option.value)
    setText(option.label)
    lastSyncedCommittedRef.current = option.value
  }

  function commitCustom(next: string) {
    setCommitted(next)
    setText(next)
    lastSyncedCommittedRef.current = next
  }

  function handleClear() {
    setCommitted("")
    setText("")
    lastSyncedCommittedRef.current = ""
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div
      data-df="combobox"
      data-disabled={disabled ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-loading={loading ? "" : undefined}
      className={cn(className)}
    >
      <OptionList
        value={selectedValue}
        onValueChange={(next) => {
          if (next == null) return
          const option = filtered.find((entry) => entry.value === next)
          if (option == null || !isComboboxOptionInteractive(option)) return
          commitOption(option)
          setOpen(false)
          inputRef.current?.focus()
        }}
        open={isOpen && !disabled}
        onOpenChange={(next) => {
          if (disabled) {
            setOpen(false)
            return
          }
          setOpen(next)
        }}
        closeOnSelect
        width="fill"
        itemChrome={itemChrome}
      >
        <ComboboxActiveSync filtered={filtered} />
        <ComboboxField
          text={text}
          setText={setText}
          disabled={disabled}
          invalid={invalid}
          placeholder={resolvedPlaceholder}
          id={id}
          clearable={clearable}
          inputRef={inputRef}
          filtered={filtered}
          allowCustomValue={allowCustomValue}
          onClear={handleClear}
          onCommitCustom={commitCustom}
          ariaLabel={ariaLabel}
          ariaLabelledBy={ariaLabelledBy}
        />
        <OptionListContent
          side="bottom"
          align="start"
          portal
          dismissOnScroll={false}
          scrollable
        >
          {filtered.length === 0 ? (
            <div data-df="combobox-empty">
              {loading
                ? s.comboboxLoading
                : (emptyContent ?? s.comboboxEmpty)}
            </div>
          ) : (
            filtered.map((option) => (
              <OptionListItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                readOnly={option.readOnly}
              >
                {option.label}
              </OptionListItem>
            ))
          )}
        </OptionListContent>
      </OptionList>
    </div>
  )
}

export { Combobox }
