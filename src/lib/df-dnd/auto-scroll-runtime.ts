import {
  autoScrollDelta,
  type AutoScrollAxis,
  DF_DND_AUTO_SCROLL_MAX_VELOCITY_PX,
  DF_DND_AUTO_SCROLL_ZONE_PX,
} from "./auto-scroll"

export type AutoScrollContainerResolver = () => HTMLElement | null

export type AutoScrollSession = {
  updatePointer: (clientX: number, clientY: number) => void
  stop: () => void
}

export type AutoScrollSessionRef = {
  current: AutoScrollSession | null
}

/** Stop a session held in a ref and clear the ref. Safe when already idle. */
export function disposeAutoScrollSession(
  sessionRef: AutoScrollSessionRef
): void {
  sessionRef.current?.stop()
  sessionRef.current = null
}

/** True when the element can scroll on the given axis. */
export function canScrollOnAxis(
  element: HTMLElement,
  axis: "x" | "y"
): boolean {
  if (axis === "x") {
    return element.scrollWidth > element.clientWidth + 1
  }
  return element.scrollHeight > element.clientHeight + 1
}

/**
 * Nearest scrollable ancestor for the given axis, or the document scrolling element.
 */
export function findScrollableAncestor(
  start: HTMLElement | null,
  axis: AutoScrollAxis = "both"
): HTMLElement | null {
  if (typeof document === "undefined") return null
  let node: HTMLElement | null = start
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    const overflowX = style.overflowX
    const yScrollable =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      canScrollOnAxis(node, "y")
    const xScrollable =
      (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") &&
      canScrollOnAxis(node, "x")
    if (axis === "y" && yScrollable) return node
    if (axis === "x" && xScrollable) return node
    if (axis === "both" && (yScrollable || xScrollable)) return node
    node = node.parentElement
  }
  const scrolling =
    (document.scrollingElement as HTMLElement | null) ?? document.documentElement
  return scrolling
}

/** Start a requestAnimationFrame loop that scrolls a container from pointer edge proximity. */
export function startAutoScrollSession(options: {
  getContainer: AutoScrollContainerResolver
  axis?: AutoScrollAxis
  zone?: number
  maxVelocity?: number
}): AutoScrollSession {
  let pointer: { x: number; y: number } | null = null
  let frame = 0
  let stopped = false
  const axis = options.axis ?? "both"
  const zone = options.zone ?? DF_DND_AUTO_SCROLL_ZONE_PX
  const maxVelocity = options.maxVelocity ?? DF_DND_AUTO_SCROLL_MAX_VELOCITY_PX

  const requestFrame = globalThis.requestAnimationFrame.bind(globalThis)
  const cancelFrame = globalThis.cancelAnimationFrame.bind(globalThis)

  const tick = () => {
    if (stopped) return
    frame = requestFrame(tick)
    if (!pointer) return
    const container = options.getContainer()
    if (!container) return
    const rect = container.getBoundingClientRect()
    const { dx, dy } = autoScrollDelta({
      clientX: pointer.x,
      clientY: pointer.y,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      axis,
      zone,
      maxVelocity,
    })
    if (dx !== 0) container.scrollLeft += dx
    if (dy !== 0) container.scrollTop += dy
  }

  frame = requestFrame(tick)

  return {
    updatePointer: (clientX, clientY) => {
      if (stopped) return
      pointer = { x: clientX, y: clientY }
    },
    stop: () => {
      if (stopped) return
      stopped = true
      cancelFrame(frame)
      pointer = null
      frame = 0
    },
  }
}
