/**
 * Shared numeric step contract. Quantizing and formatting both read precision
 * from the step, so a readout states the value that was committed.
 */

/** Decimal places a step can express, including exponent notation such as 1e-7. */
export function stepPrecision(step: number) {
  const safeStep = step > 0 && Number.isFinite(step) ? step : 1
  const text = String(safeStep)
  const exponent = text.indexOf("e-")
  if (exponent >= 0) {
    const mantissa = text.slice(0, exponent).split(".")[1]?.length ?? 0
    return mantissa + Number(text.slice(exponent + 2))
  }
  return text.split(".")[1]?.length ?? 0
}

/** Nearest step from min, corrected for binary floating point drift. */
export function quantizeToStep(value: number, min: number, step: number) {
  const safeStep = step > 0 && Number.isFinite(step) ? step : 1
  const stepped = Math.round((value - min) / safeStep) * safeStep + min
  const precision = stepPrecision(safeStep)
  return precision > 0 ? Number(stepped.toFixed(precision)) : stepped
}

/** Readout at the precision the step can express. */
export function formatByStep(value: number, step: number) {
  return value.toFixed(stepPrecision(step))
}

/** Nearest step inside min and max. */
export function snapToStep(
  value: number,
  min: number,
  max: number,
  step: number
) {
  const next = quantizeToStep(value, min, step)
  return Math.min(max, Math.max(min, next))
}
