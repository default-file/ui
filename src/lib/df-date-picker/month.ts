import {
  addUtcDays,
  formatUtcDate,
  startOfUtcDay,
  toDate,
} from "../df-date/index"

export type DayBounds = {
  min?: string | null | undefined
  max?: string | null | undefined
  disabledDates?: ((dayIso: string) => boolean) | null | undefined
}

/** Shift a UTC calendar month, clamping the day into the target month. */
export function shiftUtcMonth(
  value: Date | string | number,
  months: number
): Date {
  const seed = startOfUtcDay(value)
  const target = new Date(
    Date.UTC(seed.getUTCFullYear(), seed.getUTCMonth() + months, 1)
  )
  const year = target.getUTCFullYear()
  const month = target.getUTCMonth()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(seed.getUTCDate(), daysInMonth)
  return new Date(Date.UTC(year, month, day))
}

/** `yyyy-mm` key for the UTC month containing `value`. */
export function monthKey(value: Date | string | number): string {
  const date = startOfUtcDay(value)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/** First day of the UTC month for `value` as `yyyy-mm-dd`. */
export function startOfUtcMonthIso(value: Date | string | number): string {
  const date = startOfUtcDay(value)
  return formatUtcDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  )
}

/** Locale month label for a UTC month (`July 2026`). */
export function formatUtcMonthLabel(
  value: Date | string | number,
  locale = "en-US"
): string {
  const date = startOfUtcDay(value)
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/** Compare two ISO day strings (`yyyy-mm-dd`). */
export function compareIsoDays(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Clamp an ISO day into an optional inclusive `[min, max]` window. */
export function clampIsoDay(
  iso: string,
  min?: string | null,
  max?: string | null
): string {
  let next = formatUtcDate(startOfUtcDay(iso))
  if (min != null && compareIsoDays(next, min) < 0) next = min
  if (max != null && compareIsoDays(next, max) > 0) next = max
  return next
}

/** True when `iso` falls outside optional min/max or a custom predicate. */
export function isDayDisabled(
  iso: string,
  options: DayBounds = {}
): boolean {
  const day = formatUtcDate(startOfUtcDay(iso))
  if (options.min != null && compareIsoDays(day, options.min) < 0) return true
  if (options.max != null && compareIsoDays(day, options.max) > 0) return true
  if (options.disabledDates?.(day)) return true
  return false
}

/**
 * Clamp `candidateIso` into min/max, then walk in `direction` until an
 * enabled day is found. Returns `fallbackIso` when none exists in range.
 */
export function resolveNearestEnabledDay(
  candidateIso: string,
  direction: 1 | -1,
  bounds: DayBounds = {},
  options: {
    limitIso?: string | undefined
    fallbackIso?: string | undefined
  } = {}
): string {
  const fallback =
    options.fallbackIso ?? formatUtcDate(startOfUtcDay(candidateIso))
  let day = clampIsoDay(candidateIso, bounds.min, bounds.max)

  for (let step = 0; step < 400; step += 1) {
    if (options.limitIso != null) {
      if (direction === 1 && compareIsoDays(day, options.limitIso) > 0) {
        return fallback
      }
      if (direction === -1 && compareIsoDays(day, options.limitIso) < 0) {
        return fallback
      }
    }
    if (!isDayDisabled(day, bounds)) return day

    const next = formatUtcDate(addUtcDays(day, direction))
    if (bounds.min != null && compareIsoDays(next, bounds.min) < 0) {
      return fallback
    }
    if (bounds.max != null && compareIsoDays(next, bounds.max) > 0) {
      return fallback
    }
    if (options.limitIso != null) {
      if (direction === 1 && compareIsoDays(next, options.limitIso) > 0) {
        return fallback
      }
      if (direction === -1 && compareIsoDays(next, options.limitIso) < 0) {
        return fallback
      }
    }
    day = next
  }

  return fallback
}

/** Today as a UTC ISO day string. */
export function todayIsoDay(now: Date | string | number = Date.now()): string {
  return formatUtcDate(startOfUtcDay(toDate(now)))
}
