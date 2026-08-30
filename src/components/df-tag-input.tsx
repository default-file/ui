"use client"

import * as React from "react"
import { X } from "lucide-react"

import { useControllableState } from "../hooks"
import {
  canCommitTag,
  commitTagBatch,
  filterTagSuggestions,
  type TagCommitRejectReason,
} from "../lib/df-tag-input"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"
import type { ListItemChromeProps } from "./df-list-item"
import {
  OptionList,
  OptionListContent,
  OptionListItem,
  useOptionListContext,
} from "./df-option-list"

const REJECT_SHAKE_MS = 180

export type TagInputProps = {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  suggestions?: readonly string[]
  maxTags?: number
  invalid?: boolean
  validation?: React.ReactNode
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
  "aria-label"?: string
  /** Default List Item chrome for suggestion rows. Forwarded to OptionList. */
  itemChrome?: ListItemChromeProps
  onReject?: (tag: string, reason: Exclude<TagCommitRejectReason, "empty">) => void
}

function moveActive(
  items: readonly string[],
  current: string | null,
  delta: number
): string | null {
  if (items.length === 0) return null
  const index = current == null ? -1 : items.indexOf(current)
  const base = index === -1 ? (delta > 0 ? -1 : 0) : index
  return items[(base + delta + items.length * 10) % items.length] ?? null
}

function TagInputField({
  tags,
  draft,
  setDraft,
  disabled,
  invalid,
  placeholder,
  id,
  inputRef,
  filtered,
  shake,
  ariaLabel,
  onCommitDraft,
  onCommitSuggestion,
  onRemoveAt,
  onRemoveLast,
  onPasteText,
}: {
  tags: string[]
  draft: string
  setDraft: (value: string) => void
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  placeholder?: string | undefined
  id?: string | undefined
  inputRef: React.RefObject<HTMLInputElement | null>
  filtered: string[]
  shake: boolean
  ariaLabel?: string | undefined
  onCommitDraft: () => boolean
  onCommitSuggestion: (value: string) => void
  onRemoveAt: (index: number) => void
  onRemoveLast: () => void
  onPasteText: (text: string) => void
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
  } = useOptionListContext()

  return (
    <div
      ref={triggerRef as React.RefObject<HTMLDivElement>}
      data-df="tag-input-field"
      data-disabled={disabled ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-shake={shake ? "" : undefined}
      onMouseDown={(event) => {
        if (disabled) return
        if (event.target === event.currentTarget) {
          event.preventDefault()
          inputRef.current?.focus()
        }
      }}
    >
      {tags.map((tag, index) => (
        <span key={`${tag}-${index}`} data-df="tag-input-chip">
          <span data-df="tag-input-chip-label">{tag}</span>
          <button
            type="button"
            data-df="tag-input-chip-remove"
            aria-label={s.tagInputRemove(tag)}
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={() => onRemoveAt(index)}
          >
            <X aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        data-df="tag-input-control"
        type="text"
        role="combobox"
        value={draft}
        disabled={disabled}
        placeholder={tags.length === 0 ? placeholder : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={
          open && activeValue != null ? optionDomId(activeValue) : undefined
        }
        onChange={(event) => {
          setDraft(event.target.value)
          if (!open && filtered.length > 0) setOpen(true)
        }}
        onFocus={() => {
          if (!disabled && filtered.length > 0) setOpen(true)
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text")
          if (
            !text ||
            (!text.includes(",") && !text.includes(";") && !/\s/.test(text))
          ) {
            return
          }
          event.preventDefault()
          onPasteText(text)
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
            if (filtered.length === 0) return
            event.preventDefault()
            if (!open) setOpen(true)
            setActiveValue(
              moveActive(
                filtered,
                activeValue,
                event.key === "ArrowDown" ? 1 : -1
              )
            )
            return
          }

          if (event.key === "Enter") {
            event.preventDefault()
            if (open && activeValue != null && filtered.includes(activeValue)) {
              onCommitSuggestion(activeValue)
              return
            }
            onCommitDraft()
            return
          }

          if (event.key === ",") {
            event.preventDefault()
            onCommitDraft()
            return
          }

          if (event.key === "Backspace" && draft.length === 0) {
            event.preventDefault()
            onRemoveLast()
          }
        }}
      />
    </div>
  )
}

function TagInput({
  value,
  defaultValue = [],
  onValueChange,
  suggestions = [],
  maxTags,
  invalid = false,
  validation,
  disabled = false,
  placeholder,
  id,
  className,
  "aria-label": ariaLabel,
  itemChrome,
  onReject,
}: TagInputProps) {
  const s = useDfStrings()
  const resolvedPlaceholder = placeholder ?? s.tagInputPlaceholder
  const [tags, setTags] = useControllableState<string[]>({
    value,
    defaultValue,
    onChange: onValueChange,
  })
  const [draft, setDraft] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [shake, setShake] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const shakeTimerRef = React.useRef<number | null>(null)

  const filtered = React.useMemo(
    () => filterTagSuggestions(suggestions, draft, tags),
    [draft, suggestions, tags]
  )

  const atMax = maxTags != null && tags.length >= maxTags
  const listOpen = open && !disabled && !atMax && filtered.length > 0

  React.useEffect(() => {
    return () => {
      if (shakeTimerRef.current != null) {
        window.clearTimeout(shakeTimerRef.current)
      }
    }
  }, [])

  function triggerReject(
    tag: string,
    reason: Exclude<TagCommitRejectReason, "empty">
  ) {
    onReject?.(tag, reason)
    if (reason !== "duplicate") return
    setShake(true)
    if (shakeTimerRef.current != null) {
      window.clearTimeout(shakeTimerRef.current)
    }
    shakeTimerRef.current = window.setTimeout(() => {
      setShake(false)
      shakeTimerRef.current = null
    }, REJECT_SHAKE_MS)
  }

  function commitDraft(): boolean {
    const result = canCommitTag(draft, tags, maxTags)
    if (!result.ok) {
      if (result.reason === "empty") return false
      triggerReject(draft.trim(), result.reason)
      return false
    }
    setTags([...tags, result.tag])
    setDraft("")
    return true
  }

  function commitSuggestion(label: string) {
    const result = canCommitTag(label, tags, maxTags)
    if (!result.ok) {
      if (result.reason === "empty") return
      triggerReject(label.trim(), result.reason)
      return
    }
    setTags([...tags, result.tag])
    setDraft("")
    setOpen(false)
    inputRef.current?.focus()
  }

  function handlePasteText(text: string) {
    const batch = commitTagBatch(`${draft}${text}`, tags, { maxTags })
    for (const entry of batch.rejected) {
      if (entry.reason === "empty") continue
      triggerReject(entry.tag, entry.reason)
    }
    setTags(batch.tags)
    setDraft("")
  }

  return (
    <div
      data-df="tag-input"
      data-disabled={disabled ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      className={cn(className)}
    >
      <OptionList
        value={null}
        onValueChange={(next) => {
          if (next == null) return
          commitSuggestion(next)
        }}
        open={listOpen}
        onOpenChange={(next) => {
          if (disabled || atMax) {
            setOpen(false)
            return
          }
          setOpen(next)
        }}
        closeOnSelect
        width="fill"
        itemChrome={itemChrome}
      >
        <TagInputField
          tags={tags}
          draft={draft}
          setDraft={setDraft}
          disabled={disabled}
          invalid={invalid}
          placeholder={resolvedPlaceholder}
          id={id}
          inputRef={inputRef}
          filtered={filtered}
          shake={shake}
          ariaLabel={ariaLabel}
          onCommitDraft={commitDraft}
          onCommitSuggestion={commitSuggestion}
          onRemoveAt={(index) => setTags(tags.filter((_, i) => i !== index))}
          onRemoveLast={() => {
            if (tags.length === 0) return
            setTags(tags.slice(0, -1))
          }}
          onPasteText={handlePasteText}
        />
        <OptionListContent
          side="bottom"
          align="start"
          portal
          dismissOnScroll={false}
          scrollable
        >
          {filtered.map((item) => (
            <OptionListItem key={item} value={item}>
              {item}
            </OptionListItem>
          ))}
        </OptionListContent>
      </OptionList>
      {validation != null ? (
        <div data-df="tag-input-validation">{validation}</div>
      ) : null}
    </div>
  )
}

export { TagInput }
