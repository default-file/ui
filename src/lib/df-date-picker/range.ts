import { compareIsoDays, isDayDisabled, type DayBounds } from "./month"

export type DateRangeValue = {
  start: string
  end: string
}

export type RangeDraft = {
  start: string | null
  end: string | null
}

/**
 * Apply a day click to a range draft.
 * A complete range or empty draft starts a new selection.
 * Clicking before the start while choosing the end restarts at the click.
 */
export function applyRangeClick(
  draft: RangeDraft,
  clicked: string
): RangeDraft {
  if (draft.start == null || draft.end != null) {
    return { start: clicked, end: null }
  }
  if (compareIsoDays(clicked, draft.start) < 0) {
    return { start: clicked, end: null }
  }
  return { start: draft.start, end: clicked }
}

/**
 * Same as pointer clicks: reject out of range and disabled days without
 * mutating the draft.
 */
export function applyBoundedRangeClick(
  draft: RangeDraft,
  clicked: string,
  bounds: DayBounds = {}
): RangeDraft {
  if (isDayDisabled(clicked, bounds)) return draft
  return applyRangeClick(draft, clicked)
}

/** Resolve the inclusive highlight span for a draft plus optional hover. */
export function resolveRangePreview(
  draft: RangeDraft,
  hover: string | null
): DateRangeValue | null {
  if (draft.start == null) return null
  if (draft.end != null) {
    return orderRange(draft.start, draft.end)
  }
  if (hover == null) {
    return { start: draft.start, end: draft.start }
  }
  return orderRange(draft.start, hover)
}

export function orderRange(a: string, b: string): DateRangeValue {
  return compareIsoDays(a, b) <= 0
    ? { start: a, end: b }
    : { start: b, end: a }
}

export function isIsoInInclusiveRange(
  iso: string,
  start: string,
  end: string
): boolean {
  const range = orderRange(start, end)
  return (
    compareIsoDays(iso, range.start) >= 0 &&
    compareIsoDays(iso, range.end) <= 0
  )
}

/** Convert a committed value into a draft used while the panel is open. */
export function draftFromValue(
  value: DateRangeValue | null | undefined
): RangeDraft {
  if (value == null) return { start: null, end: null }
  return { start: value.start, end: value.end }
}
