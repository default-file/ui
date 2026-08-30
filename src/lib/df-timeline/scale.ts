import {
  addUtcDays,
  formatUtcDate,
  startOfUtcDay,
  toDate,
} from "../df-date/index"

const MS_PER_DAY = 86_400_000

export type TimelineZoom = "day" | "week" | "month" | "quarter"

export type TimelineVisibleRange = {
  start: string
  end: string
}

export type TimelineHeaderCell = {
  key: string
  label: string
  start: string
  end: string
  x: number
  width: number
}

export type TimelineFineColumn = TimelineHeaderCell & {
  isWeekend: boolean
}

export type TimelineScale = {
  zoom: TimelineZoom
  rangeStart: string
  rangeEnd: string
  unitPx: number
  totalWidth: number
  fineColumns: TimelineFineColumn[]
  coarseHeaders: TimelineHeaderCell[]
  fineHeaders: TimelineHeaderCell[]
  todayX: number | null
  dateToX: (iso: string) => number
  xToDate: (px: number) => string
  snapDate: (iso: string) => string
  shiftDate: (iso: string, units: number) => string
  unitLabel: string
}

export type BuildTimelineScaleOptions = {
  visibleRange: TimelineVisibleRange
  zoom: TimelineZoom
  /** Pixels per fine tick unit. Typically read from `--df-timeline-unit-px`. */
  unitPx: number
  /** ISO date used for the today marker. Defaults to the current UTC day. */
  today?: string
}

type Span = {
  start: Date
  end: Date
  label: string
  key: string
  isWeekend: boolean
}

function assertPositiveUnitPx(unitPx: number): number {
  if (!Number.isFinite(unitPx) || unitPx <= 0) {
    throw new Error("unitPx must be a positive finite number")
  }
  return unitPx
}

function startOfUtcWeek(value: Date | string | number): Date {
  const day = startOfUtcDay(value)
  return addUtcDays(day, -day.getUTCDay())
}

function startOfUtcMonth(value: Date | string | number): Date {
  const day = startOfUtcDay(value)
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))
}

function addUtcMonths(value: Date | string | number, months: number): Date {
  const day = startOfUtcDay(value)
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + months, 1)
  )
}

function startOfUtcQuarter(value: Date | string | number): Date {
  const day = startOfUtcDay(value)
  const quarterMonth = Math.floor(day.getUTCMonth() / 3) * 3
  return new Date(Date.UTC(day.getUTCFullYear(), quarterMonth, 1))
}

function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
}

function yearLabel(date: Date): string {
  return String(date.getUTCFullYear())
}

function quarterLabel(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1
  return `Q${q} ${date.getUTCFullYear()}`
}

function dayLabel(date: Date): string {
  return String(date.getUTCDate())
}

function weekLabel(date: Date): string {
  const end = addUtcDays(date, 6)
  return `${monthLabel(date)} ${dayLabel(date)}-${dayLabel(end)}`
}

function enumerateFineSpans(
  zoom: TimelineZoom,
  rangeStart: Date,
  rangeEndExclusive: Date
): Span[] {
  const spans: Span[] = []
  if (zoom === "day") {
    let cursor = rangeStart
    while (cursor.getTime() < rangeEndExclusive.getTime()) {
      const next = addUtcDays(cursor, 1)
      const weekday = cursor.getUTCDay()
      spans.push({
        start: cursor,
        end: next,
        label: dayLabel(cursor),
        key: formatUtcDate(cursor),
        isWeekend: weekday === 0 || weekday === 6,
      })
      cursor = next
    }
    return spans
  }

  if (zoom === "week") {
    let cursor = startOfUtcWeek(rangeStart)
    while (cursor.getTime() < rangeEndExclusive.getTime()) {
      const next = addUtcDays(cursor, 7)
      const visibleStart =
        cursor.getTime() < rangeStart.getTime() ? rangeStart : cursor
      if (visibleStart.getTime() < rangeEndExclusive.getTime()) {
        const visibleEnd =
          next.getTime() > rangeEndExclusive.getTime()
            ? rangeEndExclusive
            : next
        spans.push({
          start: visibleStart,
          end: visibleEnd,
          label: weekLabel(cursor),
          key: formatUtcDate(cursor),
          isWeekend: false,
        })
      }
      cursor = next
    }
    return spans
  }

  if (zoom === "month") {
    let cursor = startOfUtcMonth(rangeStart)
    while (cursor.getTime() < rangeEndExclusive.getTime()) {
      const next = addUtcMonths(cursor, 1)
      const visibleStart =
        cursor.getTime() < rangeStart.getTime() ? rangeStart : cursor
      if (visibleStart.getTime() < rangeEndExclusive.getTime()) {
        const visibleEnd =
          next.getTime() > rangeEndExclusive.getTime()
            ? rangeEndExclusive
            : next
        spans.push({
          start: visibleStart,
          end: visibleEnd,
          label: `${monthLabel(cursor)} ${yearLabel(cursor)}`,
          key: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
          isWeekend: false,
        })
      }
      cursor = next
    }
    return spans
  }

  let cursor = startOfUtcQuarter(rangeStart)
  while (cursor.getTime() < rangeEndExclusive.getTime()) {
    const next = addUtcMonths(cursor, 3)
    const visibleStart =
      cursor.getTime() < rangeStart.getTime() ? rangeStart : cursor
    if (visibleStart.getTime() < rangeEndExclusive.getTime()) {
      const visibleEnd =
        next.getTime() > rangeEndExclusive.getTime()
          ? rangeEndExclusive
          : next
      spans.push({
        start: visibleStart,
        end: visibleEnd,
        label: quarterLabel(cursor),
        key: `${cursor.getUTCFullYear()}-Q${Math.floor(cursor.getUTCMonth() / 3) + 1}`,
        isWeekend: false,
      })
    }
    cursor = next
  }
  return spans
}

function enumerateCoarseSpans(
  zoom: TimelineZoom,
  fine: Span[]
): Array<{ start: Date; end: Date; label: string; key: string }> {
  if (fine.length === 0) return []

  if (zoom === "day" || zoom === "week") {
    const groups: Array<{ start: Date; end: Date; label: string; key: string }> =
      []
    for (const span of fine) {
      const monthStart = startOfUtcMonth(span.start)
      const key = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`
      const label = `${monthLabel(monthStart)} ${yearLabel(monthStart)}`
      const last = groups[groups.length - 1]
      if (last && last.key === key) {
        last.end = span.end
      } else {
        groups.push({ start: span.start, end: span.end, label, key })
      }
    }
    return groups
  }

  if (zoom === "month") {
    const groups: Array<{ start: Date; end: Date; label: string; key: string }> =
      []
    for (const span of fine) {
      const key = yearLabel(span.start)
      const last = groups[groups.length - 1]
      if (last && last.key === key) {
        last.end = span.end
      } else {
        groups.push({
          start: span.start,
          end: span.end,
          label: key,
          key,
        })
      }
    }
    return groups
  }

  const groups: Array<{ start: Date; end: Date; label: string; key: string }> =
    []
  for (const span of fine) {
    const key = yearLabel(span.start)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.end = span.end
    } else {
      groups.push({
        start: span.start,
        end: span.end,
        label: key,
        key,
      })
    }
  }
  return groups
}

function snapDateToZoom(iso: string, zoom: TimelineZoom): string {
  const day = startOfUtcDay(iso)
  if (zoom === "day") return formatUtcDate(day)
  if (zoom === "week") return formatUtcDate(startOfUtcWeek(day))
  if (zoom === "month") return formatUtcDate(startOfUtcMonth(day))
  return formatUtcDate(startOfUtcQuarter(day))
}

function shiftDateByZoom(
  iso: string,
  zoom: TimelineZoom,
  units: number
): string {
  const day = startOfUtcDay(iso)
  if (zoom === "day") return formatUtcDate(addUtcDays(day, units))
  if (zoom === "week") return formatUtcDate(addUtcDays(startOfUtcWeek(day), units * 7))
  if (zoom === "month") {
    return formatUtcDate(addUtcMonths(startOfUtcMonth(day), units))
  }
  return formatUtcDate(addUtcMonths(startOfUtcQuarter(day), units * 3))
}

function unitLabelForZoom(zoom: TimelineZoom): string {
  if (zoom === "day") return "day"
  if (zoom === "week") return "week"
  if (zoom === "month") return "month"
  return "quarter"
}

/**
 * Build a linear time scale for the visible range and zoom preset.
 * Fine columns share a fixed pixel width (`unitPx`); date mapping interpolates inside each column.
 */
export function buildTimelineScale(
  options: BuildTimelineScaleOptions
): TimelineScale {
  const unitPx = assertPositiveUnitPx(options.unitPx)
  const zoom = options.zoom
  const rangeStart = startOfUtcDay(options.visibleRange.start)
  const rangeEndInclusive = startOfUtcDay(options.visibleRange.end)
  if (rangeEndInclusive.getTime() < rangeStart.getTime()) {
    throw new Error("visibleRange.end must be on or after visibleRange.start")
  }
  const rangeEndExclusive = addUtcDays(rangeEndInclusive, 1)

  const fineSpans = enumerateFineSpans(zoom, rangeStart, rangeEndExclusive)
  const fineColumns: TimelineFineColumn[] = fineSpans.map((span, index) => ({
    key: span.key,
    label: span.label,
    start: formatUtcDate(span.start),
    end: formatUtcDate(addUtcDays(span.end, -1)),
    x: index * unitPx,
    width: unitPx,
    isWeekend: span.isWeekend,
  }))

  const coarseSpans = enumerateCoarseSpans(zoom, fineSpans)
  let coarseX = 0
  const coarseHeaders: TimelineHeaderCell[] = coarseSpans.map((span) => {
    const startMs = span.start.getTime()
    const endMs = span.end.getTime()
    const columns = fineSpans.filter(
      (fine) =>
        fine.start.getTime() >= startMs && fine.start.getTime() < endMs
    )
    const width = columns.length * unitPx
    const cell: TimelineHeaderCell = {
      key: span.key,
      label: span.label,
      start: formatUtcDate(span.start),
      end: formatUtcDate(addUtcDays(span.end, -1)),
      x: coarseX,
      width,
    }
    coarseX += width
    return cell
  })

  const fineHeaders: TimelineHeaderCell[] = fineColumns.map((column) => ({
    key: column.key,
    label: column.label,
    start: column.start,
    end: column.end,
    x: column.x,
    width: column.width,
  }))

  const totalWidth = fineColumns.length * unitPx

  const dateToX = (iso: string): number => {
    const date = toDate(iso)
    if (fineSpans.length === 0) return 0
    if (date.getTime() <= fineSpans[0]!.start.getTime()) return 0
    const last = fineSpans[fineSpans.length - 1]!
    if (date.getTime() >= last.end.getTime()) return totalWidth

    for (let i = 0; i < fineSpans.length; i += 1) {
      const span = fineSpans[i]!
      if (date.getTime() >= span.end.getTime()) continue
      const spanMs = Math.max(MS_PER_DAY, span.end.getTime() - span.start.getTime())
      const t = (date.getTime() - span.start.getTime()) / spanMs
      return i * unitPx + t * unitPx
    }
    return totalWidth
  }

  const xToDate = (px: number): string => {
    if (fineSpans.length === 0) return formatUtcDate(rangeStart)
    const clamped = Math.min(Math.max(px, 0), Math.max(totalWidth - Number.EPSILON, 0))
    const index = Math.min(
      fineSpans.length - 1,
      Math.max(0, Math.floor(clamped / unitPx))
    )
    const span = fineSpans[index]!
    const local = clamped - index * unitPx
    const spanMs = Math.max(MS_PER_DAY, span.end.getTime() - span.start.getTime())
    const ms = span.start.getTime() + (local / unitPx) * spanMs
    return formatUtcDate(startOfUtcDay(ms))
  }

  const todayIso = formatUtcDate(
    startOfUtcDay(options.today ?? new Date().toISOString())
  )
  const todayMs = startOfUtcDay(todayIso).getTime()
  const todayInRange =
    todayMs >= rangeStart.getTime() && todayMs < rangeEndExclusive.getTime()
  const todayX = todayInRange ? dateToX(todayIso) : null

  return {
    zoom,
    rangeStart: formatUtcDate(rangeStart),
    rangeEnd: formatUtcDate(rangeEndInclusive),
    unitPx,
    totalWidth,
    fineColumns,
    coarseHeaders,
    fineHeaders,
    todayX,
    dateToX,
    xToDate,
    snapDate: (iso) => snapDateToZoom(iso, zoom),
    shiftDate: (iso, units) => shiftDateByZoom(iso, zoom, units),
    unitLabel: unitLabelForZoom(zoom),
  }
}
