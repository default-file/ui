/**
 * Separators for paste and batch tokenization.
 * Includes whitespace so "a b c" becomes three tags.
 */
export const PASTE_SEPARATORS = /[,;\s]+/

/**
 * Typing commits only on Enter or comma.
 * Space is not a commit key, so multi word tags can be typed.
 */
export const TYPE_COMMIT_SEPARATORS = /[,;]+/

/** Split free text into tag candidates. Defaults to paste separators. */
export function tokenizeTagText(
  text: string,
  separators: RegExp = PASTE_SEPARATORS
): string[] {
  return text
    .split(separators)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/** Case insensitive identity key for duplicate checks. */
export function tagKey(tag: string): string {
  return tag.trim().toLowerCase()
}

/** Keep first occurrence of each tag, ignoring case and empty entries. */
export function dedupeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    const trimmed = raw.trim()
    if (trimmed.length === 0) continue
    const key = tagKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

export type TagCommitRejectReason = "empty" | "duplicate" | "max"

export type TagCommitResult =
  | { ok: true; tag: string }
  | { ok: false; reason: TagCommitRejectReason }

/** Decide whether a single tag can be appended to the current list. */
export function canCommitTag(
  tag: string,
  existing: readonly string[],
  maxTags?: number
): TagCommitResult {
  const trimmed = tag.trim()
  if (trimmed.length === 0) return { ok: false, reason: "empty" }
  if (maxTags != null && existing.length >= maxTags) {
    return { ok: false, reason: "max" }
  }
  const key = tagKey(trimmed)
  if (existing.some((item) => tagKey(item) === key)) {
    return { ok: false, reason: "duplicate" }
  }
  return { ok: true, tag: trimmed }
}

export type CommitTagBatchResult = {
  tags: string[]
  accepted: string[]
  rejected: Array<{ tag: string; reason: TagCommitRejectReason }>
}

/** Tokenize input, append valid unique tags, and stop at max when set. */
export function commitTagBatch(
  text: string,
  existing: readonly string[],
  options?: {
    maxTags?: number | undefined
    separators?: RegExp | undefined
  }
): CommitTagBatchResult {
  const candidates = tokenizeTagText(
    text,
    options?.separators ?? PASTE_SEPARATORS
  )
  const tags = [...existing]
  const accepted: string[] = []
  const rejected: Array<{ tag: string; reason: TagCommitRejectReason }> = []

  for (const candidate of candidates) {
    const result = canCommitTag(candidate, tags, options?.maxTags)
    if (!result.ok) {
      if (result.reason !== "empty") {
        rejected.push({ tag: candidate.trim(), reason: result.reason })
      }
      if (result.reason === "max") break
      continue
    }
    tags.push(result.tag)
    accepted.push(result.tag)
  }

  return { tags, accepted, rejected }
}

/** Filter suggestion labels by the current draft (case insensitive substring). */
export function filterTagSuggestions(
  suggestions: readonly string[],
  draft: string,
  existing: readonly string[]
): string[] {
  const query = draft.trim().toLowerCase()
  const taken = new Set(existing.map(tagKey))
  return suggestions.filter((item) => {
    const trimmed = item.trim()
    if (trimmed.length === 0) return false
    if (taken.has(tagKey(trimmed))) return false
    if (query.length === 0) return true
    return trimmed.toLowerCase().includes(query)
  })
}
