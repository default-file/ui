/** CSS selector for tabbable controls inside a modal panel. */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

export type FocusTrapKeyAction =
  | "close"
  | "focus-panel"
  | "focus-last"
  | "focus-first"
  | "none"

export type FocusTrapKeyDecision = {
  action: FocusTrapKeyAction
  preventDefault: boolean
}

/**
 * Decide how a keydown should affect a modal focus trap.
 * Escape closes. Tab cycles only when focus is on an edge item.
 */
export function resolveFocusTrapKey(options: {
  key: string
  shiftKey: boolean
  focusableCount: number
  activeIsFirst: boolean
  activeIsLast: boolean
}): FocusTrapKeyDecision {
  if (options.key === "Escape") {
    return { action: "close", preventDefault: true }
  }
  if (options.key !== "Tab") {
    return { action: "none", preventDefault: false }
  }
  if (options.focusableCount === 0) {
    return { action: "focus-panel", preventDefault: true }
  }
  if (options.shiftKey && options.activeIsFirst) {
    return { action: "focus-last", preventDefault: true }
  }
  if (!options.shiftKey && options.activeIsLast) {
    return { action: "focus-first", preventDefault: true }
  }
  return { action: "none", preventDefault: false }
}

/** Prefer the trigger, then the focus captured when the layer opened. */
export function resolveFocusRestoreTarget<T>(
  trigger: T | null | undefined,
  previous: T | null | undefined
): T | null {
  return trigger ?? previous ?? null
}

/** First tabbable control, or the panel itself when the panel has none. */
export function resolveInitialFocus<T>(
  focusables: readonly T[],
  panel: T | null | undefined
): T | null {
  return focusables[0] ?? panel ?? null
}

export type OverflowStyleHost = {
  style: { overflow: string }
}

/** Lock page scroll and return the prior overflow value for restore. */
export function lockBodyScroll(body: OverflowStyleHost): string {
  const previous = body.style.overflow
  body.style.overflow = "hidden"
  return previous
}

/** Restore page scroll from a value returned by lockBodyScroll. */
export function unlockBodyScroll(
  body: OverflowStyleHost,
  previousOverflow: string
): void {
  body.style.overflow = previousOverflow
}
