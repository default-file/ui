const PLAIN_PX = /^(-?(?:\d+|\d*\.\d+))(?:px)?$/i

function parsePlainPx(raw: string): number | null {
  const match = PLAIN_PX.exec(raw.trim())
  if (!match) return null
  const px = Number.parseFloat(match[1]!)
  return Number.isFinite(px) ? px : null
}

function resolveUsedPx(value: string): number | null {
  const px = Number.parseFloat(value)
  if (!Number.isFinite(px) || px < 0) return null
  return px
}

/** True when the element participates in layout (not display: none). */
export function elementHasLayoutBox(element: Element): boolean {
  return element.getClientRects().length > 0
}

/**
 * ResizeObserver fires continuously during window drags. Remeasure only when
 * the host transitions from no box into a laid-out box.
 */
export function shouldRemeasureCssPxOnResize(
  previouslyHadLayout: boolean,
  currentlyHasLayout: boolean
): boolean {
  return currentlyHasLayout && !previouslyHadLayout
}

/**
 * Tracks whether the host had a layout box so ResizeObserver can trigger a
 * single re-resolve on layout gain without measuring on every size change.
 */
export function createCssPxLayoutGainGate() {
  let hadLayout = false

  return {
    get hadLayout() {
      return hadLayout
    },
    /** Record the layout state after a resolve attempt. */
    syncFromElement(hasLayout: boolean) {
      hadLayout = hasLayout
    },
    /**
     * ResizeObserver path. Returns true when the caller should re-resolve.
     * Clears the laid-out flag when the host loses its box.
     */
    consumeResize(currentlyHasLayout: boolean): boolean {
      if (shouldRemeasureCssPxOnResize(hadLayout, currentlyHasLayout)) {
        return true
      }
      if (!currentlyHasLayout) {
        hadLayout = false
      }
      return false
    },
  }
}

/**
 * Read a CSS custom property as used pixels from a specific element.
 * Plain pixel lengths use a fast path. calc, rem, em, and nested var chains
 * resolve through a short-lived probe measured inside the host element.
 *
 * The probe is absolutely positioned with zero width so it does not change the
 * host content box and cannot feedback into a ResizeObserver loop.
 */
export function readCssPx(
  element: Element,
  token: string,
  fallback: number
): number {
  if (typeof getComputedStyle !== "function") return fallback

  let raw = ""
  try {
    raw = getComputedStyle(element).getPropertyValue(token).trim()
  } catch {
    return fallback
  }
  if (!raw) return fallback

  const plain = parsePlainPx(raw)
  if (plain != null) {
    return plain >= 0 ? plain : fallback
  }

  if (
    typeof document === "undefined" ||
    typeof document.createElement !== "function" ||
    typeof element.appendChild !== "function"
  ) {
    return fallback
  }

  const probe = document.createElement("div")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "pointer-events:none",
    "width:0",
    `height:var(${token})`,
    "margin:0",
    "padding:0",
    "border:0",
    "overflow:hidden",
  ].join(";")

  element.appendChild(probe)
  try {
    const used = getComputedStyle(probe).height
    return resolveUsedPx(used) ?? fallback
  } catch {
    return fallback
  } finally {
    probe.remove()
  }
}
