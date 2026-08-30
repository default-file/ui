"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import {
  readCssDurationMs,
  useAnchoredPosition,
  useControllableState,
  useIsClient,
  usePresence,
} from "../hooks"
import { cn, composeEventHandlers } from "../lib/utils"

type TooltipVariant = "compact" | "detailed"
type TooltipAppearance = "light" | "dark" | "inverse"
type TooltipSide = "top" | "bottom" | "left" | "right"
type TooltipAlign = "start" | "center" | "end"

type TooltipAnchorPoint = {
  x: number
  y: number
}

type TooltipContextValue = {
  open: boolean
  show: () => void
  hide: () => void
  hideImmediate: () => void
  triggerRef: React.RefObject<HTMLElement | null>
  contentId: string
  variant: TooltipVariant
  appearance: TooltipAppearance
  anchorPoint: TooltipAnchorPoint | null
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null)

function useTooltipContext() {
  const ctx = React.useContext(TooltipContext)
  if (!ctx) throw new Error("Tooltip components must be used within Tooltip")
  return ctx
}

function Tooltip({
  open,
  defaultOpen = false,
  onOpenChange,
  delayDuration = 200,
  dismissDuration,
  anchorPoint = null,
  variant = "compact",
  appearance = "inverse",
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  delayDuration?: number
  /** Auto hide while open, in ms. Point mode defaults to --df-duration-tip-hold. */
  dismissDuration?: number
  /** Viewport point to anchor content when there is no trigger element. */
  anchorPoint?: TooltipAnchorPoint | null
  variant?: TooltipVariant
  /** Panel surface: light, dark, or inverse to the document theme. */
  appearance?: TooltipAppearance
  children: React.ReactNode
}) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentId = React.useId()
  const openTimerRef = React.useRef<number | null>(null)
  const closeTimerRef = React.useRef<number | null>(null)
  const dismissTimerRef = React.useRef<number | null>(null)
  const pointMode = anchorPoint != null

  const clearTimers = React.useCallback(() => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (dismissTimerRef.current != null) {
      window.clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])

  React.useEffect(() => () => clearTimers(), [clearTimers])

  const show = React.useCallback(() => {
    if (pointMode) return
    clearTimers()
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true)
    }, delayDuration)
  }, [clearTimers, delayDuration, pointMode, setOpen])

  const hide = React.useCallback(() => {
    if (pointMode) return
    clearTimers()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
    }, 0)
  }, [clearTimers, pointMode, setOpen])

  const hideImmediate = React.useCallback(() => {
    clearTimers()
    setOpen(false)
  }, [clearTimers, setOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideImmediate()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen, hideImmediate])

  React.useEffect(() => {
    if (!isOpen) return
    const onScroll = () => hideImmediate()
    window.addEventListener("scroll", onScroll, true)
    return () => window.removeEventListener("scroll", onScroll, true)
  }, [isOpen, hideImmediate])

  React.useEffect(() => {
    if (!isOpen) return
    const holdMs =
      dismissDuration ??
      (pointMode
        ? readCssDurationMs("--df-duration-tip-hold", 1800)
        : null)
    if (holdMs == null) return
    if (dismissTimerRef.current != null) {
      window.clearTimeout(dismissTimerRef.current)
    }
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null
      hideImmediate()
    }, holdMs)
    return () => {
      if (dismissTimerRef.current != null) {
        window.clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = null
      }
    }
  }, [
    anchorPoint?.x,
    anchorPoint?.y,
    dismissDuration,
    hideImmediate,
    isOpen,
    pointMode,
  ])

  return (
    <TooltipContext.Provider
      value={{
        open: isOpen,
        show,
        hide,
        hideImmediate,
        triggerRef,
        contentId,
        variant,
        appearance,
        anchorPoint,
      }}
    >
      {children}
    </TooltipContext.Provider>
  )
}

function TooltipTrigger({
  children,
  render,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { open, show, hide, triggerRef, contentId, anchorPoint } =
    useTooltipContext()

  if (anchorPoint != null) return null

  const shared = {
    ref: triggerRef as React.Ref<HTMLButtonElement>,
    "data-df-tooltip-trigger": "",
    "aria-describedby": open ? contentId : undefined,
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
      props.onPointerEnter?.(event as React.PointerEvent<HTMLButtonElement>)
      if (event.pointerType === "touch") return
      show()
    },
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
      props.onPointerLeave?.(event as React.PointerEvent<HTMLButtonElement>)
      if (event.pointerType === "touch") return
      hide()
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      props.onFocus?.(event as React.FocusEvent<HTMLButtonElement>)
      show()
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      props.onBlur?.(event as React.FocusEvent<HTMLButtonElement>)
      hide()
    },
  }

  if (render) {
    return React.cloneElement(render, {
      ...props,
      ...shared,
      className: cn(className, (render.props as { className?: string }).className),
      children: children ?? (render.props as { children?: React.ReactNode }).children,
    } as never)
  }

  return (
    <button
      type="button"
      data-df="tooltip-trigger"
      className={cn(className)}
      {...props}
      {...shared}
    >
      {children}
    </button>
  )
}

function TooltipContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "top",
  sideOffset = 14,
  wrap = false,
  arrow = true,
  children,
  onAnimationEnd,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: TooltipAlign
  alignOffset?: number
  side?: TooltipSide
  sideOffset?: number
  wrap?: boolean
  arrow?: boolean
}) {
  const { open, triggerRef, contentId, variant, appearance, anchorPoint } =
    useTooltipContext()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const { present, onExitAnimationEnd } = usePresence(open)
  const pointMode = anchorPoint != null
  const placement = useAnchoredPosition({
    open,
    triggerRef: pointMode ? undefined : triggerRef,
    contentRef,
    anchorRect: pointMode
      ? { x: anchorPoint.x, y: anchorPoint.y, width: 0, height: 0 }
      : null,
    side,
    align,
    sideOffset,
    alignOffset,
    matchTriggerWidth: false,
    followScroll: false,
  })

  const mounted = useIsClient()
  const wrapMode = variant === "detailed" && wrap

  if (!present || !mounted) return null

  return createPortal(
    <div
      ref={contentRef}
      id={contentId}
      role="tooltip"
      data-df="tooltip-content"
      data-variant={variant}
      data-appearance={appearance}
      data-side={placement.side}
      data-align={placement.align}
      data-state={open ? "open" : "closed"}
      data-arrow={arrow ? "true" : "false"}
      data-wrap={variant === "detailed" ? (wrapMode ? "true" : "false") : undefined}
      className={cn(className)}
      style={placement.style}
      aria-live={pointMode ? "polite" : undefined}
      {...props}
      onAnimationEnd={(event) => {
        composeEventHandlers(onAnimationEnd, onExitAnimationEnd)(event)
      }}
    >
      <div data-df="tooltip-label">{children}</div>
      {arrow ? <span data-df="tooltip-arrow" aria-hidden="true" /> : null}
    </div>,
    document.body
  )
}

export { Tooltip, TooltipContent, TooltipTrigger }
export type { TooltipAppearance, TooltipAnchorPoint, TooltipVariant }
