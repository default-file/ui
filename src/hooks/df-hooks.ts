import type * as React from "react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import {
  createCssPxLayoutGainGate,
  elementHasLayoutBox,
  readCssPx,
} from "../lib/df-css-token"
import { resolveRovingActiveIndex } from "../lib/df-roving"
import { tweenNumber, type TweenNumberOptions } from "../lib/df-tween"
import { nearestDarkClass } from "../lib/nearest-theme"
import { useReducedMotion } from "../lib/df-motion"

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

function isSameControllableValue<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false
    }
    return true
  }
  return false
}

export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T | undefined
  defaultValue: T
  onChange?: ((value: T) => void) | undefined
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : uncontrolled

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(current) : next
      if (isSameControllableValue(resolved, current)) return
      if (!isControlled) setUncontrolled(resolved)
      onChange?.(resolved)
    },
    [current, isControlled, onChange]
  )

  return [current, setValue] as const
}

export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export const DISMISS_NESTED_LAYER_SELECTORS = [
  '[data-df="option-list-content"]',
  '[data-df="select-content"]',
  '[data-df="context-menu-content"]',
  '[data-df="dropdown-menu-content"]',
] as const

function isInsideDismissSurface(
  target: EventTarget | null,
  refs: Array<React.RefObject<HTMLElement | null>>,
  excludeSelectors?: readonly string[]
) {
  if (!(target instanceof Node)) return false
  if (refs.some((ref) => ref.current?.contains(target))) return true
  const el = target instanceof Element ? target : target.parentElement
  if (
    el &&
    excludeSelectors?.some((selector) => el.closest(selector))
  ) {
    return true
  }
  return false
}

export function useDismiss(
  open: boolean,
  onClose: () => void,
  refs: Array<React.RefObject<HTMLElement | null>>,
  options?: {
    excludeSelectors?: readonly string[]
    dismissOnScroll?: boolean
  }
) {
  const refsRef = useRef(refs)
  const onCloseRef = useRef(onClose)
  const excludeSelectorsRef = useRef(options?.excludeSelectors)

  useIsomorphicLayoutEffect(() => {
    refsRef.current = refs
    onCloseRef.current = onClose
    excludeSelectorsRef.current = options?.excludeSelectors
  })

  const dismissOnScroll = options?.dismissOnScroll ?? true

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current()
    }

    const onPointer = (event: MouseEvent | PointerEvent) => {
      if (
        isInsideDismissSurface(
          event.target,
          refsRef.current,
          excludeSelectorsRef.current
        )
      ) {
        return
      }
      onCloseRef.current()
    }

    const onScroll = (event: Event) => {
      if (
        isInsideDismissSurface(
          event.target,
          refsRef.current,
          excludeSelectorsRef.current
        )
      ) {
        return
      }
      onCloseRef.current()
    }

    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointer)
    if (dismissOnScroll) {
      document.addEventListener("scroll", onScroll, true)
    }
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("scroll", onScroll, true)
    }
  }, [open, dismissOnScroll])
}

type Side = "top" | "bottom" | "left" | "right"
type Align = "start" | "center" | "end" | "auto"

type ResolvedAlign = "start" | "center" | "end"

function oppositeSide(side: Side): Side {
  if (side === "top") return "bottom"
  if (side === "bottom") return "top"
  if (side === "left") return "right"
  return "left"
}

function overflowX(left: number, width: number, vw: number, pad: number) {
  return Math.max(0, pad - left) + Math.max(0, left + width - (vw - pad))
}

function overflowY(top: number, height: number, vh: number, pad: number) {
  return Math.max(0, pad - top) + Math.max(0, top + height - (vh - pad))
}

function resolveSide(
  preferred: Side,
  t: DOMRect,
  c: { width: number; height: number },
  vw: number,
  vh: number,
  pads: { top: number; bottom: number; x: number },
  sideOffset: number,
  contentAware: boolean
): Side {
  if (!contentAware) return preferred

  const space = {
    bottom: vh - pads.bottom - (t.bottom + sideOffset),
    top: t.top - pads.top - sideOffset,
    right: vw - pads.x - (t.right + sideOffset),
    left: t.left - pads.x - sideOffset,
  }

  const needed =
    preferred === "top" || preferred === "bottom" ? c.height : c.width
  if (space[preferred] >= needed) return preferred

  const flip = oppositeSide(preferred)
  if (space[flip] > space[preferred]) return flip
  return preferred
}

function pickCrossAlign(
  preferred: Align,
  t: DOMRect,
  contentSize: number,
  viewport: number,
  pad: number,
  axis: "x" | "y"
): ResolvedAlign {
  if (preferred !== "auto") return preferred

  const candidates: Array<{ align: ResolvedAlign; origin: number }> =
    axis === "x"
      ? [
          { align: "start", origin: t.left },
          { align: "center", origin: t.left + t.width / 2 - contentSize / 2 },
          { align: "end", origin: t.right - contentSize },
        ]
      : [
          { align: "start", origin: t.top },
          { align: "center", origin: t.top + t.height / 2 - contentSize / 2 },
          { align: "end", origin: t.bottom - contentSize },
        ]

  let best: ResolvedAlign = "center"
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const score =
      axis === "x"
        ? overflowX(candidate.origin, contentSize, viewport, pad)
        : overflowY(candidate.origin, contentSize, viewport, pad)
    const tieBreak = candidate.align === "center" ? -0.1 : 0
    if (score + tieBreak < bestScore) {
      best = candidate.align
      bestScore = score + tieBreak
    }
  }
  return best
}

const ANCHOR_VIEWPORT_PAD_PX = 8
const ANCHOR_ARROW_CROSS_INSET_FALLBACK_PX = 12

function readCssLengthPx(
  name: string,
  fallback: number,
  element?: Element | null
): number {
  if (typeof window === "undefined") return fallback
  const target = element ?? document.documentElement
  const raw = getComputedStyle(target).getPropertyValue(name).trim()
  if (!raw) return fallback
  const num = Number.parseFloat(raw)
  if (Number.isNaN(num)) return fallback
  if (raw.endsWith("rem")) {
    const rootPx =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
      16
    return num * rootPx
  }
  return num
}

function readOverlayInset(name: string): number {
  return readCssLengthPx(name, 0)
}

function contentLayoutSize(content: HTMLElement) {
  return { width: content.offsetWidth, height: content.offsetHeight }
}

function arrowCrossStyle(
  side: Side,
  trigger: DOMRect,
  contentLeft: number,
  contentTop: number,
  size: { width: number; height: number },
  inset: number
): React.CSSProperties {
  const alongMain = side === "top" || side === "bottom"
  const cross = alongMain
    ? trigger.left + trigger.width / 2 - contentLeft
    : trigger.top + trigger.height / 2 - contentTop
  const axisSize = alongMain ? size.width : size.height
  const clamped = Math.min(
    Math.max(cross, inset),
    Math.max(inset, axisSize - inset)
  )
  return {
    "--df-anchor-arrow-cross": `${clamped}px`,
  } as React.CSSProperties
}

type AnchoredPlacement = {
  style: React.CSSProperties
  side: Side
  align: ResolvedAlign
  /** True after at least one position update has run while open. */
  positionAttempted: boolean
}

const HIDDEN_ANCHOR_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  visibility: "hidden",
}

function unmeasuredAnchorStyle(): React.CSSProperties {
  return {
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 50,
    visibility: "visible",
  }
}

export type AnchorRect = {
  x: number
  y: number
  width?: number | undefined
  height?: number | undefined
}

function initialAlign(align: Align): ResolvedAlign {
  return align === "auto" ? "center" : align
}

function rectFromAnchor(anchor: AnchorRect): DOMRect {
  const width = anchor.width ?? 0
  const height = anchor.height ?? 0
  return {
    x: anchor.x,
    y: anchor.y,
    width,
    height,
    top: anchor.y,
    left: anchor.x,
    right: anchor.x + width,
    bottom: anchor.y + height,
    toJSON() {
      return {
        x: anchor.x,
        y: anchor.y,
        width,
        height,
        top: anchor.y,
        left: anchor.x,
        right: anchor.x + width,
        bottom: anchor.y + height,
      }
    },
  } as DOMRect
}

export function readCssDurationMs(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  if (!raw) return fallback
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return fallback
  if (raw.endsWith("ms")) return value
  if (raw.endsWith("s")) return value * 1000
  return value
}

export function useAnchoredPosition({
  open,
  triggerRef,
  contentRef,
  anchorRect = null,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  matchTriggerWidth = true,
  collisionAvoidance = true,
  followScroll = true,
}: {
  open: boolean
  triggerRef?: React.RefObject<HTMLElement | null> | undefined
  contentRef: React.RefObject<HTMLElement | null>
  /** Virtual anchor in viewport coordinates when there is no trigger element. */
  anchorRect?: AnchorRect | null | undefined
  side?: Side | undefined
  align?: Align | undefined
  sideOffset?: number | undefined
  alignOffset?: number | undefined
  matchTriggerWidth?: boolean | undefined
  collisionAvoidance?: boolean | undefined
  followScroll?: boolean | undefined
}): AnchoredPlacement {
  const [placement, setPlacement] = useState<AnchoredPlacement>(() => ({
    style: { ...HIDDEN_ANCHOR_STYLE },
    side,
    align: initialAlign(align),
    positionAttempted: false,
  }))

  const [trackedOpen, setTrackedOpen] = useState(open)
  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (!open) {
      setPlacement({
        style: { ...HIDDEN_ANCHOR_STYLE },
        side,
        align: initialAlign(align),
        positionAttempted: false,
      })
    }
  }

  const anchorX = anchorRect?.x
  const anchorY = anchorRect?.y
  const anchorWidth = anchorRect?.width
  const anchorHeight = anchorRect?.height
  const hasAnchorRect = anchorRect != null

  const update = useCallback(() => {
    const content = contentRef.current
    if (!content) return

    const revealUnmeasured = () => {
      setPlacement((prev) => ({
        ...prev,
        positionAttempted: true,
        style: unmeasuredAnchorStyle(),
      }))
    }

    const t = hasAnchorRect
      ? rectFromAnchor({
          x: anchorX ?? 0,
          y: anchorY ?? 0,
          width: anchorWidth,
          height: anchorHeight,
        })
      : triggerRef?.current?.getBoundingClientRect()
    if (!t) {
      revealUnmeasured()
      return
    }

    const c = contentLayoutSize(content)
    if (c.width <= 0 || c.height <= 0) {
      revealUnmeasured()
      return
    }

    const pad = ANCHOR_VIEWPORT_PAD_PX
    const padTop = pad + readOverlayInset("--df-overlay-inset-top")
    const padBottom = pad + readOverlayInset("--df-overlay-inset-bottom")
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const contentAware = align === "auto" || collisionAvoidance
    const arrowInset = readCssLengthPx(
      "--df-anchor-arrow-cross-inset",
      ANCHOR_ARROW_CROSS_INSET_FALLBACK_PX,
      content
    )

    const resolvedSide = resolveSide(
      side,
      t,
      c,
      vw,
      vh,
      { top: padTop, bottom: padBottom, x: pad },
      sideOffset,
      contentAware
    )

    const resolvedAlign =
      resolvedSide === "left" || resolvedSide === "right"
        ? pickCrossAlign(align, t, c.height, vh, pad, "y")
        : pickCrossAlign(align, t, c.width, vw, pad, "x")

    let maxHeight: number | undefined
    let top: number | "auto" = 0
    let bottom: number | "auto" = "auto"

    if (resolvedSide === "bottom") {
      top = t.bottom + sideOffset
      maxHeight = Math.max(96, vh - padBottom - top)
    } else if (resolvedSide === "top") {
      bottom = vh - t.top + sideOffset
      top = "auto"
      maxHeight = Math.max(96, t.top - padTop - sideOffset)
    } else {
      if (resolvedAlign === "start") top = t.top + alignOffset
      else if (resolvedAlign === "center")
        top = t.top + t.height / 2 - c.height / 2 + alignOffset
      else top = t.bottom - c.height + alignOffset
      if (top < padTop) top = padTop
      if (top + c.height > vh - padBottom) {
        top = Math.max(padTop, vh - c.height - padBottom)
      }
    }

    const resolvedContentTop = (
      boxTop: number | "auto",
      boxBottom: number | "auto"
    ) => {
      if (typeof boxTop === "number") return boxTop
      if (typeof boxBottom === "number") return vh - boxBottom - c.height
      return 0
    }

    const withArrow = (
      contentLeft: number,
      contentTop: number,
      style: React.CSSProperties
    ): React.CSSProperties => ({
      ...style,
      ...arrowCrossStyle(
        resolvedSide,
        t,
        contentLeft,
        contentTop,
        c,
        arrowInset
      ),
    })

    const base: React.CSSProperties = {
      position: "fixed",
      top,
      bottom,
      ...(matchTriggerWidth
        ? { width: t.width, minWidth: t.width, maxWidth: t.width }
        : null),
      ...(maxHeight != null ? { maxHeight } : null),
      zIndex: 50,
      visibility: "visible",
      ...({ "--anchor-width": `${t.width}px` } as React.CSSProperties),
    }

    if (resolvedSide === "left" || resolvedSide === "right") {
      let left =
        resolvedSide === "left"
          ? t.left - c.width - sideOffset
          : t.right + sideOffset
      if (left < pad) left = pad
      if (left + c.width > vw - pad) {
        left = Math.max(pad, vw - c.width - pad)
      }
      setPlacement({
        style: withArrow(left, resolvedContentTop(top, bottom), {
          ...base,
          left,
          right: "auto",
        }),
        side: resolvedSide,
        align: resolvedAlign,
        positionAttempted: true,
      })
      return
    }

    if (resolvedAlign === "end") {
      let right = vw - t.right - alignOffset
      const leftEdge = vw - right - c.width
      if (leftEdge < pad) {
        right = Math.max(pad, vw - c.width - pad)
      }
      const contentLeft = vw - right - c.width
      setPlacement({
        style: withArrow(contentLeft, resolvedContentTop(top, bottom), {
          ...base,
          right,
          left: "auto",
        }),
        side: resolvedSide,
        align: resolvedAlign,
        positionAttempted: true,
      })
      return
    }

    let left =
      resolvedAlign === "start"
        ? t.left + alignOffset
        : t.left + t.width / 2 - c.width / 2 + alignOffset
    if (!matchTriggerWidth) {
      if (left < pad) left = pad
      if (left + c.width > vw - pad) {
        left = Math.max(pad, vw - c.width - pad)
      }
    }
    setPlacement({
      style: withArrow(left, resolvedContentTop(top, bottom), {
        ...base,
        left,
        right: "auto",
      }),
      side: resolvedSide,
      align: resolvedAlign,
      positionAttempted: true,
    })
  }, [
    align,
    alignOffset,
    anchorHeight,
    anchorWidth,
    anchorX,
    anchorY,
    collisionAvoidance,
    contentRef,
    hasAnchorRect,
    matchTriggerWidth,
    side,
    sideOffset,
    triggerRef,
  ])

  useEffect(() => {
    if (!open) return
    update()
    const raf = window.requestAnimationFrame(() => update())
    const onResize = () => update()
    const onScroll = () => update()
    window.addEventListener("resize", onResize)
    if (followScroll) window.addEventListener("scroll", onScroll, true)

    const content = contentRef.current
    const trigger = triggerRef?.current
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => update())
        : null
    if (content && ro) ro.observe(content)
    if (trigger && ro) ro.observe(trigger)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      if (followScroll) window.removeEventListener("scroll", onScroll, true)
      ro?.disconnect()
    }
  }, [
    anchorHeight,
    anchorWidth,
    anchorX,
    anchorY,
    contentRef,
    followScroll,
    open,
    triggerRef,
    update,
  ])

  return placement
}

/** True when the viewport is below the kit md breakpoint (mobile chrome). */
/** Matches `--df-breakpoint-md` in df-tokens.css. */
export const DF_BREAKPOINT_MD_PX = 768

export function useIsMobile(breakpointPx = DF_BREAKPOINT_MD_PX) {
  const query = `(max-width: ${breakpointPx - 1}px)`
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {}
      }
      const media = window.matchMedia(query)
      media.addEventListener("change", onStoreChange)
      return () => media.removeEventListener("change", onStoreChange)
    },
    [query]
  )
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false
    }
    return window.matchMedia(query).matches
  }, [query])
  const getServerSnapshot = useCallback(() => false, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Resolve a CSS length token against the element after mount. Returns fallback on SSR. */
export function useCssPx(
  ref: React.RefObject<HTMLElement | null>,
  token: string,
  fallback: number
): number {
  const [value, setValue] = useState(fallback)

  useIsomorphicLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const layoutGate = createCssPxLayoutGainGate()
    let densityRoot: Element | null = null
    let densityObserver: MutationObserver | null = null

    const bindDensityObserver = () => {
      const next =
        element.closest("[data-df-density]") ?? document.documentElement
      if (next === densityRoot) return
      densityObserver?.disconnect()
      densityRoot = next
      densityObserver = new MutationObserver(() => {
        resolve()
      })
      densityObserver.observe(densityRoot, {
        attributes: true,
        attributeFilter: ["data-df-density"],
      })
    }

    const resolve = () => {
      bindDensityObserver()
      const hasLayout = elementHasLayoutBox(element)
      if (!hasLayout) {
        layoutGate.syncFromElement(false)
        setValue(fallback)
        return
      }
      // Sync before probing so a sync ResizeObserver cannot re-enter as a gain.
      layoutGate.syncFromElement(true)
      setValue(readCssPx(element, token, fallback))
    }

    resolve()

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            bindDensityObserver()
            if (layoutGate.consumeResize(elementHasLayoutBox(element))) {
              resolve()
            }
          })
        : null
    resizeObserver?.observe(element)

    return () => {
      densityObserver?.disconnect()
      resizeObserver?.disconnect()
    }
  }, [ref, token, fallback])

  return value
}

export type RovingOrientation = "horizontal" | "vertical" | "both"

export type UseRovingTabIndexOptions = {
  count: number
  orientation?: RovingOrientation
  loop?: boolean
  isItemDisabled?: (index: number) => boolean
  activeIndex?: number
  defaultActiveIndex?: number
  onActiveIndexChange?: (index: number) => void
}

export type RovingItemProps = {
  tabIndex: 0 | -1
  ref: (node: HTMLElement | null) => void
  onFocus: (event: React.FocusEvent) => void
  onKeyDown: (event: React.KeyboardEvent) => void
}

function findEnabledIndex(
  from: number,
  step: number,
  count: number,
  loop: boolean,
  isItemDisabled?: (index: number) => boolean
): number {
  if (count <= 0) return 0
  let index = from
  for (let i = 0; i < count; i++) {
    index += step
    if (loop) {
      index = (index + count) % count
    } else if (index < 0 || index >= count) {
      return from
    }
    if (!isItemDisabled?.(index)) return index
  }
  return from
}

function firstEnabledIndex(
  count: number,
  isItemDisabled?: (index: number) => boolean
): number {
  for (let i = 0; i < count; i++) {
    if (!isItemDisabled?.(i)) return i
  }
  return 0
}

function lastEnabledIndex(
  count: number,
  isItemDisabled?: (index: number) => boolean
): number {
  for (let i = count - 1; i >= 0; i--) {
    if (!isItemDisabled?.(i)) return i
  }
  return Math.max(0, count - 1)
}

/**
 * One item is tabbable; arrow keys move focus among siblings.
 * Home and End jump to the ends. Disabled items are skipped.
 */
export function useRovingTabIndex({
  count,
  orientation = "horizontal",
  loop = true,
  isItemDisabled,
  activeIndex: activeIndexProp,
  defaultActiveIndex = 0,
  onActiveIndexChange,
}: UseRovingTabIndexOptions) {
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const [uncontrolled, setUncontrolled] = useState(() =>
    resolveRovingActiveIndex(defaultActiveIndex, count, isItemDisabled)
  )
  const isControlled = activeIndexProp !== undefined
  const storedIndex = isControlled ? (activeIndexProp as number) : uncontrolled
  const activeIndex = resolveRovingActiveIndex(
    storedIndex,
    count,
    isItemDisabled
  )

  useIsomorphicLayoutEffect(() => {
    if (itemRefs.current.length > count) {
      itemRefs.current.length = count
    }
  }, [count])

  const setActiveIndex = useCallback(
    (next: number) => {
      if (isItemDisabled?.(next)) return
      const resolved = resolveRovingActiveIndex(next, count, isItemDisabled)
      if (!isControlled) setUncontrolled(resolved)
      onActiveIndexChange?.(resolved)
    },
    [count, isControlled, isItemDisabled, onActiveIndexChange]
  )

  const move = useCallback(
    (key: string) => {
      const horizontal =
        orientation === "horizontal" || orientation === "both"
      const vertical = orientation === "vertical" || orientation === "both"
      const prevKeys = [
        ...(horizontal ? ["ArrowLeft"] : []),
        ...(vertical ? ["ArrowUp"] : []),
      ]
      const nextKeys = [
        ...(horizontal ? ["ArrowRight"] : []),
        ...(vertical ? ["ArrowDown"] : []),
      ]

      if (key === "Home") {
        return firstEnabledIndex(count, isItemDisabled)
      }
      if (key === "End") {
        return lastEnabledIndex(count, isItemDisabled)
      }
      if (prevKeys.includes(key)) {
        return findEnabledIndex(activeIndex, -1, count, loop, isItemDisabled)
      }
      if (nextKeys.includes(key)) {
        return findEnabledIndex(activeIndex, 1, count, loop, isItemDisabled)
      }
      return null
    },
    [activeIndex, count, isItemDisabled, loop, orientation]
  )

  const getItemProps = useCallback(
    (index: number): RovingItemProps => ({
      tabIndex: activeIndex === index ? 0 : -1,
      ref: (node) => {
        itemRefs.current[index] = node
      },
      onFocus: () => {
        if (isItemDisabled?.(index)) return
        setActiveIndex(index)
      },
      onKeyDown: (event) => {
        const next = move(event.key)
        if (next == null) return
        event.preventDefault()
        setActiveIndex(next)
        itemRefs.current[next]?.focus()
      },
    }),
    [activeIndex, isItemDisabled, move, setActiveIndex]
  )

  return {
    activeIndex,
    setActiveIndex,
    getItemProps,
  }
}

/** Track tween cancellers and clear them all when the host unmounts. */
export function useTween() {
  const cancellersRef = useRef(new Set<() => void>())

  useEffect(() => {
    const cancellers = cancellersRef.current
    return () => {
      for (const cancel of cancellers) cancel()
      cancellers.clear()
    }
  }, [])

  return useCallback((options: TweenNumberOptions) => {
    const { onDone, ...rest } = options
    const cancel = tweenNumber({
      ...rest,
      onDone: () => {
        cancellersRef.current.delete(cancel)
        onDone?.()
      },
    })
    cancellersRef.current.add(cancel)
    return () => {
      cancel()
      cancellersRef.current.delete(cancel)
    }
  }, [])
}

/** Keep a ref aligned with the latest committed value. */
export function useLatestRef<T>(value: T): React.RefObject<T> {
  const ref = useRef(value)
  useIsomorphicLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

export type UsePresenceOptions = {
  /** When false, unmount immediately on close instead of waiting for exit animation. */
  animated?: boolean
}

export type UsePresenceResult = {
  present: boolean
  onExitAnimationEnd: (event: {
    target: EventTarget
    currentTarget: EventTarget
  }) => void
}

function reportCallbackError(error: unknown) {
  setTimeout(() => {
    throw error
  }, 0)
}

/**
 * Keep the host mounted through close animation.
 * Opening clears any exit hold during render so the enter frame is not skipped.
 */
export function usePresence(
  open: boolean,
  options?: UsePresenceOptions
): UsePresenceResult {
  const animated = options?.animated ?? true
  const reducedMotion = useReducedMotion()
  const holdOnClose = animated && !reducedMotion
  const [exitHeld, setExitHeld] = useState(false)
  const [seenOpen, setSeenOpen] = useState(open)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setExitHeld(false)
    } else {
      setExitHeld(holdOnClose)
    }
  }

  const onExitAnimationEnd = useCallback(
    (event: { target: EventTarget; currentTarget: EventTarget }) => {
      if (event.target !== event.currentTarget) return
      if (!open) setExitHeld(false)
    },
    [open]
  )

  return { present: open || exitHeld, onExitAnimationEnd }
}

/**
 * Resolve whether a portal should carry the dark theme class from a trigger node.
 * Pass enabled when the overlay is shown so a remounted trigger is re-read.
 */
export function useNearestDarkClass(
  nodeRef: React.RefObject<Element | null>,
  enabled = true
): "dark" | undefined {
  const [themeClass, setThemeClass] = useState<"dark" | undefined>(undefined)

  useIsomorphicLayoutEffect(() => {
    if (!enabled) {
      setThemeClass(undefined)
      return
    }
    setThemeClass(nearestDarkClass(nodeRef.current))
  })

  return themeClass
}

export type DragGestureReason = "up" | "cancel" | "unmount"

export type DragGestureHandlers<T> = {
  onMove: (event: PointerEvent, data: T) => void
  onEnd?: (
    event: PointerEvent | null,
    data: T,
    reason: DragGestureReason
  ) => void
}

export type BeginDragGestureOptions = {
  /** Capture the pointer on the target. Defaults to true. */
  capture?: boolean
  /** Capture target. Defaults to the event currentTarget when it is an Element. */
  target?: Element | null
}

type ActiveDragGesture = {
  pointerId: number
  data: unknown
  onMove: (event: PointerEvent, data: unknown) => void
  onEnd:
    | ((
        event: PointerEvent | null,
        data: unknown,
        reason: DragGestureReason
      ) => void)
    | undefined
  teardown: () => void
}

function safeReleasePointerCapture(target: Element, pointerId: number) {
  try {
    if (
      "hasPointerCapture" in target &&
      typeof target.hasPointerCapture === "function" &&
      target.hasPointerCapture(pointerId)
    ) {
      target.releasePointerCapture(pointerId)
    }
  } catch {
    // Pointer may already be released by the browser.
  }
}

function safeSetPointerCapture(target: Element, pointerId: number) {
  try {
    target.setPointerCapture(pointerId)
  } catch {
    // Capture fails when the pointer is not active on this element.
  }
}

/**
 * Window-level pointer drag with capture, cancel, and unmount teardown.
 * Pass per-gesture data to freeze values for the life of the gesture.
 */
export function useDragGesture() {
  const gestureRef = useRef<ActiveDragGesture | null>(null)

  const end = useCallback(
    (
      reason: DragGestureReason = "cancel",
      event: PointerEvent | null = null
    ) => {
      const gesture = gestureRef.current
      if (!gesture) return
      gestureRef.current = null
      gesture.teardown()
      try {
        gesture.onEnd?.(event, gesture.data, reason)
      } catch (error) {
        reportCallbackError(error)
      }
    },
    []
  )

  useEffect(() => {
    return () => {
      end("unmount", null)
    }
  }, [end])

  const begin = useCallback(
    <T,>(
      event: Pick<PointerEvent, "pointerId"> & {
        currentTarget: EventTarget
      },
      data: T,
      handlers: DragGestureHandlers<T>,
      options?: BeginDragGestureOptions
    ) => {
      end("cancel", null)

      const pointerId = event.pointerId
      const capture = options?.capture ?? true
      const target =
        options?.target !== undefined
          ? options.target
          : event.currentTarget instanceof Element
            ? event.currentTarget
            : null

      if (capture && target) {
        safeSetPointerCapture(target, pointerId)
      }

      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return
        const active = gestureRef.current
        if (!active) return
        active.onMove(moveEvent, active.data)
      }

      const onUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return
        end("up", upEvent)
      }

      const onCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return
        end("cancel", cancelEvent)
      }

      const teardown = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onCancel)
        if (capture && target) {
          safeReleasePointerCapture(target, pointerId)
        }
      }

      gestureRef.current = {
        pointerId,
        data,
        onMove: handlers.onMove as (
          event: PointerEvent,
          data: unknown
        ) => void,
        onEnd: handlers.onEnd as
          | ((
              event: PointerEvent | null,
              data: unknown,
              reason: DragGestureReason
            ) => void)
          | undefined,
        teardown,
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onCancel)
    },
    [end]
  )

  const isActive = useCallback(() => gestureRef.current != null, [])

  return { begin, end, isActive }
}

export type { Align, AnchoredPlacement, Side }
