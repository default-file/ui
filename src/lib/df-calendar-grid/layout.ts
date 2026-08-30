import {
  addUtcDays,
  formatUtcDate,
  startOfUtcDay,
  toDate,
} from "../df-date/index"

export type CalendarCell = {
  date: string
  inMonth: boolean
  weekday: number
}

export type TimelineBar = {
  id: string
  /** Day offset from window start (0-based). */
  offsetDays: number
  /** Inclusive span in days. */
  spanDays: number
  /** Clipped when the bar starts before the window. */
  clippedStart: boolean
  /** Clipped when the bar ends after the window. */
  clippedEnd: boolean
}

export type GanttDependency = {
  fromId: string
  toId: string
}

/** Inclusive day count between two UTC dates (`yyyy-mm-dd` or Date). */
export function utcInclusiveDays(
  start: Date | string | number,
  end: Date | string | number
): number {
  const a = startOfUtcDay(start).getTime()
  const b = startOfUtcDay(end).getTime()
  if (b < a) throw new Error("End day must be on or after start day")
  return Math.floor((b - a) / 86_400_000) + 1
}

/** Day index of `date` relative to `windowStart` (may be negative). */
export function dayOffsetFrom(
  windowStart: Date | string | number,
  date: Date | string | number
): number {
  const a = startOfUtcDay(windowStart).getTime()
  const b = startOfUtcDay(date).getTime()
  return Math.floor((b - a) / 86_400_000)
}

/**
 * JS weekday for the first column of a week (0=Sunday through 6=Saturday)
 * from a BCP 47 locale.
 *
 * When the engine exposes no week info, this returns Sunday (0). That is a
 * degradation path for missing Intl data, not a claim that Sunday is the
 * intended default for every locale.
 */
export function weekStartsOnForLocale(locale: string): number {
  try {
    const loc = new Intl.Locale(locale)
    const withInfo = loc as Intl.Locale & {
      weekInfo?: { firstDay: number }
      getWeekInfo?: () => { firstDay: number }
    }
    const info =
      withInfo.weekInfo ??
      (typeof withInfo.getWeekInfo === "function"
        ? withInfo.getWeekInfo()
        : undefined)
    if (info?.firstDay == null) return 0
    return info.firstDay === 7 ? 0 : info.firstDay
  } catch {
    return 0
  }
}

/**
 * Offset of `weekday` (0=Sunday) from the first column of a week that starts
 * on `weekStartsOn`.
 */
export function offsetFromWeekStart(
  weekday: number,
  weekStartsOn: number
): number {
  return (weekday - weekStartsOn + 7) % 7
}

/**
 * Rotate Sunday-first weekday labels so index 0 matches `weekStartsOn`.
 */
export function rotateWeekdayLabels(
  sundayFirst: readonly [string, string, string, string, string, string, string],
  weekStartsOn: number
): readonly string[] {
  if (weekStartsOn === 0) return sundayFirst
  return [
    ...sundayFirst.slice(weekStartsOn),
    ...sundayFirst.slice(0, weekStartsOn),
  ]
}

/**
 * Build a month grid covering every day shown on the calendar surface for
 * `month` (`yyyy-mm` or any date in that month).
 *
 * `weekStartsOn` is required: the first column weekday (0=Sunday through
 * 6=Saturday). Callers must decide it from locale or an explicit policy;
 * this helper does not guess.
 */
export function buildMonthGrid(
  month: Date | string | number,
  weekStartsOn: number
): CalendarCell[] {
  const seed = startOfUtcDay(month)
  const year = seed.getUTCFullYear()
  const monthIndex = seed.getUTCMonth()
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1))
  const startPad = offsetFromWeekStart(firstOfMonth.getUTCDay(), weekStartsOn)
  const gridStart = addUtcDays(firstOfMonth, -startPad)
  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const day = addUtcDays(gridStart, i)
    cells.push({
      date: formatUtcDate(day),
      inMonth: day.getUTCMonth() === monthIndex,
      weekday: day.getUTCDay(),
    })
  }
  return cells
}

/**
 * Project a subject span into a window as a bar. Returns null when the span
 * does not intersect the inclusive window.
 */
export function projectBar(input: {
  id: string
  startsOn: string
  endsOn: string
  windowStart: string
  windowEnd: string
}): TimelineBar | null {
  const start = startOfUtcDay(input.startsOn)
  const end = startOfUtcDay(input.endsOn)
  const winStart = startOfUtcDay(input.windowStart)
  const winEnd = startOfUtcDay(input.windowEnd)
  if (end.getTime() < winStart.getTime() || start.getTime() > winEnd.getTime()) {
    return null
  }
  const clippedStart = start.getTime() < winStart.getTime()
  const clippedEnd = end.getTime() > winEnd.getTime()
  const visibleStart = clippedStart ? winStart : start
  const visibleEnd = clippedEnd ? winEnd : end
  return {
    id: input.id,
    offsetDays: dayOffsetFrom(winStart, visibleStart),
    spanDays: utcInclusiveDays(visibleStart, visibleEnd),
    clippedStart,
    clippedEnd,
  }
}

/**
 * Assign lane indices so overlapping bars do not share a row.
 * Bars are sorted by offset then span.
 */
export function assignLanes(
  bars: readonly TimelineBar[]
): Array<TimelineBar & { lane: number }> {
  const sorted = bars.slice().sort((a, b) => {
    if (a.offsetDays !== b.offsetDays) return a.offsetDays - b.offsetDays
    return b.spanDays - a.spanDays
  })
  const laneEnds: number[] = []
  return sorted.map((bar) => {
    const barEnd = bar.offsetDays + bar.spanDays
    let lane = laneEnds.findIndex((end) => end <= bar.offsetDays)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(barEnd)
    } else {
      laneEnds[lane] = barEnd
    }
    return { ...bar, lane }
  })
}

/** List UTC `yyyy-mm-dd` headers for a window (inclusive). */
export function windowDayHeaders(
  windowStart: Date | string | number,
  windowEnd: Date | string | number
): string[] {
  const start = startOfUtcDay(windowStart)
  const end = startOfUtcDay(windowEnd)
  const days = utcInclusiveDays(start, end)
  const headers: string[] = []
  for (let i = 0; i < days; i += 1) {
    headers.push(formatUtcDate(addUtcDays(start, i)))
  }
  return headers
}

/** Validate a dependency pair references known bar ids. */
export function filterDependencies(
  deps: readonly GanttDependency[],
  barIds: ReadonlySet<string>
): GanttDependency[] {
  return deps.filter(
    (dep) => barIds.has(dep.fromId) && barIds.has(dep.toId)
  )
}

export function parseYearMonth(value: string): Date {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("Month must be yyyy-mm")
  }
  return toDate(`${value}-01T00:00:00.000Z`)
}
