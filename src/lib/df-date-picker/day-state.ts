import { formatUtcDate, startOfUtcDay } from "../df-date/index"

import {
  isIsoInInclusiveRange,
  type DateRangeValue,
  type RangeDraft,
  resolveRangePreview,
} from "./range"
import {
  compareIsoDays,
  isDayDisabled,
  todayIsoDay,
} from "./month"

export type DayVisualState = {
  iso: string
  inMonth: boolean
  isToday: boolean
  isDisabled: boolean
  isSelected: boolean
  isRangeStart: boolean
  isRangeEnd: boolean
  isInRange: boolean
  isPreview: boolean
}

export type ClassifyDayInput = {
  iso: string
  inMonth: boolean
  mode: "single" | "range"
  value?: string | null | undefined
  rangeValue?: DateRangeValue | null | undefined
  draft?: RangeDraft | undefined
  hover?: string | null | undefined
  min?: string | null | undefined
  max?: string | null | undefined
  disabledDates?: ((dayIso: string) => boolean) | null | undefined
  today?: string | undefined
}

/** Classify a calendar day for selected, today, range, and disabled chrome. */
export function classifyDay(input: ClassifyDayInput): DayVisualState {
  const iso = formatUtcDate(startOfUtcDay(input.iso))
  const today = input.today ?? todayIsoDay()
  const isDisabled = isDayDisabled(iso, {
    min: input.min,
    max: input.max,
    disabledDates: input.disabledDates,
  })

  if (input.mode === "single") {
    return {
      iso,
      inMonth: input.inMonth,
      isToday: iso === today,
      isDisabled,
      isSelected: input.value != null && iso === input.value,
      isRangeStart: false,
      isRangeEnd: false,
      isInRange: false,
      isPreview: false,
    }
  }

  const draft = input.draft ?? {
    start: input.rangeValue?.start ?? null,
    end: input.rangeValue?.end ?? null,
  }
  const preview = resolveRangePreview(draft, input.hover ?? null)
  const committed =
    draft.start != null && draft.end != null
      ? { start: draft.start, end: draft.end }
      : input.rangeValue ?? null

  const active = preview ?? committed
  const isInRange =
    active != null && isIsoInInclusiveRange(iso, active.start, active.end)
  const isRangeStart = active != null && iso === active.start
  const isRangeEnd = active != null && iso === active.end
  const isPreview =
    draft.start != null &&
    draft.end == null &&
    preview != null &&
    isInRange

  return {
    iso,
    inMonth: input.inMonth,
    isToday: iso === today,
    isDisabled,
    isSelected: isRangeStart || isRangeEnd,
    isRangeStart,
    isRangeEnd,
    isInRange,
    isPreview,
  }
}

export function sameIsoDay(a: string | null | undefined, b: string): boolean {
  if (a == null) return false
  return compareIsoDays(a, b) === 0
}
