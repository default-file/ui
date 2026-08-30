export type ComboboxOption = {
  value: string
  label: string
  disabled?: boolean
  readOnly?: boolean
}

export function isComboboxOptionInteractive(option: ComboboxOption): boolean {
  return !option.disabled && !option.readOnly
}

/** Case insensitive substring filter that preserves source order. */
export function filterComboboxOptions(
  options: readonly ComboboxOption[],
  query: string
): ComboboxOption[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length === 0) return [...options]
  return options.filter((option) => {
    const label = option.label.toLowerCase()
    const value = option.value.toLowerCase()
    return label.includes(trimmed) || value.includes(trimmed)
  })
}

/** Merge static options with async results, preferring earlier value keys. */
export function mergeComboboxOptions(
  primary: readonly ComboboxOption[],
  secondary: readonly ComboboxOption[]
): ComboboxOption[] {
  const seen = new Set<string>()
  const result: ComboboxOption[] = []
  for (const option of [...primary, ...secondary]) {
    if (seen.has(option.value)) continue
    seen.add(option.value)
    result.push(option)
  }
  return result
}

/** Move the active index through enabled options, wrapping at the edges. */
export function moveComboboxActiveIndex(
  current: number | null,
  delta: number,
  enabledIndexes: readonly number[]
): number | null {
  if (enabledIndexes.length === 0) return null
  if (current == null) {
    return delta >= 0
      ? (enabledIndexes[0] ?? null)
      : (enabledIndexes[enabledIndexes.length - 1] ?? null)
  }
  const position = enabledIndexes.indexOf(current)
  if (position === -1) {
    return delta >= 0
      ? (enabledIndexes[0] ?? null)
      : (enabledIndexes[enabledIndexes.length - 1] ?? null)
  }
  const next =
    enabledIndexes[
      (position + delta + enabledIndexes.length * 10) % enabledIndexes.length
    ]
  return next ?? null
}

/** Collect indexes of options that can receive keyboard focus. */
export function enabledComboboxIndexes(
  options: readonly ComboboxOption[]
): number[] {
  const indexes: number[] = []
  options.forEach((option, index) => {
    if (isComboboxOptionInteractive(option)) indexes.push(index)
  })
  return indexes
}

export type ComboboxCommitResult =
  | { kind: "option"; option: ComboboxOption }
  | { kind: "custom"; value: string }
  | { kind: "none" }

/** Map a committed option value to the input display string. */
export function resolveComboboxDisplayText(
  committed: string,
  options: readonly ComboboxOption[],
  allowCustomValue: boolean
): string {
  if (committed.length === 0) return ""
  const match = options.find((option) => option.value === committed)
  if (match != null) return match.label
  if (allowCustomValue) return committed
  return ""
}

/** Resolve Enter: active option, optional custom text, or no commit. */
export function resolveComboboxCommit(options: {
  activeIndex: number | null
  filtered: readonly ComboboxOption[]
  query: string
  allowCustomValue: boolean
}): ComboboxCommitResult {
  const { activeIndex, filtered, query, allowCustomValue } = options
  if (activeIndex != null) {
    const option = filtered[activeIndex]
    if (option != null && isComboboxOptionInteractive(option)) {
      return { kind: "option", option }
    }
  }
  const trimmed = query.trim()
  if (allowCustomValue && trimmed.length > 0) {
    return { kind: "custom", value: trimmed }
  }
  return { kind: "none" }
}
