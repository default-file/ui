import { toDate } from "../df-date/index"

export type ChartDateGranularity = "day" | "week" | "month" | "quarter" | "year"

function trimCompact(value: number): string {
  const fixed = value.toFixed(1)
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed
}

/** Compact axis and tooltip numbers: 1.2k, 3.4M, 1.1B. */
export function formatChartNumber(value: number): string {
  if (!Number.isFinite(value)) return ""
  if (value === 0) return "0"

  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `${sign}${trimCompact(abs / 1_000_000_000)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}${trimCompact(abs / 1_000_000)}M`
  }
  if (abs >= 1_000) {
    return `${sign}${trimCompact(abs / 1_000)}k`
  }
  if (Number.isInteger(abs)) {
    return `${sign}${abs}`
  }
  return `${sign}${trimCompact(abs)}`
}

function monthShort(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
}

/**
 * Short day or month labels for an ISO timestamp at a given granularity.
 * Uses UTC calendar fields.
 */
export function formatChartDate(
  iso: string,
  granularity: ChartDateGranularity
): string {
  const date = toDate(iso)
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  const month = monthShort(date)

  switch (granularity) {
    case "day":
    case "week":
      return `${month} ${day}`
    case "month":
      return month
    case "quarter": {
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1
      return `Q${quarter}`
    }
    case "year":
      return String(year)
    default: {
      const _exhaustive: never = granularity
      return _exhaustive
    }
  }
}
