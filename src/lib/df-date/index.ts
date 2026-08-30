/** Owned date helpers. Prefer UTC day boundaries unless a timezone is supplied. */

export function toDate(value: Date | string | number): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date")
  }
  return date
}

export function startOfUtcDay(value: Date | string | number): Date {
  const date = toDate(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addUtcDays(value: Date | string | number, days: number): Date {
  const date = toDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

export function formatUtcDate(
  value: Date | string | number,
  pattern: "yyyy-mm-dd" | "iso" = "yyyy-mm-dd"
): string {
  const date = toDate(value)
  if (pattern === "iso") return date.toISOString()
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function utcDayRange(
  start: Date | string | number,
  end: Date | string | number
): { start: Date; end: Date } {
  const startDay = startOfUtcDay(start)
  const endDay = startOfUtcDay(end)
  if (endDay.getTime() < startDay.getTime()) {
    throw new Error("End day must be on or after start day")
  }
  return { start: startDay, end: endDay }
}
