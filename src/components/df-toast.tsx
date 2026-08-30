"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  CircleCheck,
  Info,
  TriangleAlert,
  CircleX,
  X,
} from "lucide-react"

import { useIsClient, useIsomorphicLayoutEffect } from "../hooks"
import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"

const TOAST_DISMISS_MS = 3200

type ToastTone = "success" | "error" | "info" | "warning"

type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "left-center"
  | "center"
  | "right-center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

type ToastAction = {
  label: string
  onClick: () => void
}

type ToastShowOptions = {
  /** Replaces the tone icon. Pass null to hide the leading slot. */
  leading?: React.ReactNode
  /** Compact action control shown before dismiss. */
  action?: ToastAction
}

type ToastChromeProps = {
  background?: string | undefined
  foreground?: string | undefined
  borderColor?: string | undefined
  borderWidth?: string | undefined
  radius?: string | undefined
  shadow?: string | undefined
  paddingBlock?: string | undefined
  paddingInline?: string | undefined
  gap?: string | undefined
  width?: string | undefined
  height?: string | undefined
  minHeight?: string | undefined
  showClose?: boolean | undefined
  cornerShape?: DfCornerShape | undefined
}

type ToastItem = {
  id: string
  tone: ToastTone
  message: string
  leading?: React.ReactNode | undefined
  action?: ToastAction | undefined
}

type ToastListener = () => void

let toasts: ToastItem[] = []
let position: ToastPosition = "bottom-right"
const listeners = new Set<ToastListener>()
const dismissTimers = new Map<string, number>()
const dismissRemainingMs = new Map<string, number>()
const dismissStartedAt = new Map<string, number>()
const pausedDismissIds = new Set<string>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: ToastListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return toasts
}

const EMPTY_TOASTS: ToastItem[] = []

function getServerSnapshot(): ToastItem[] {
  return EMPTY_TOASTS
}

function getPositionSnapshot() {
  return position
}

function getPositionServerSnapshot(): ToastPosition {
  return "bottom-right"
}

function clearDismissTimer(id: string) {
  const timer = dismissTimers.get(id)
  if (timer == null) return
  window.clearTimeout(timer)
  dismissTimers.delete(id)
}

function scheduleDismiss(id: string, ms: number) {
  clearDismissTimer(id)
  const duration = Math.max(0, ms)
  dismissRemainingMs.set(id, duration)
  dismissStartedAt.set(id, performance.now())
  const timer = window.setTimeout(() => dismiss(id), duration)
  dismissTimers.set(id, timer)
}

function pauseDismiss(id: string) {
  if (pausedDismissIds.has(id)) return
  const startedAt = dismissStartedAt.get(id)
  const remaining = dismissRemainingMs.get(id)
  if (startedAt == null || remaining == null) return
  const elapsed = performance.now() - startedAt
  dismissRemainingMs.set(id, Math.max(0, remaining - elapsed))
  clearDismissTimer(id)
  dismissStartedAt.delete(id)
  pausedDismissIds.add(id)
}

function resumeDismiss(id: string) {
  if (!pausedDismissIds.has(id)) return
  pausedDismissIds.delete(id)
  const remaining = dismissRemainingMs.get(id) ?? TOAST_DISMISS_MS
  scheduleDismiss(id, remaining)
}

function push(tone: ToastTone, message: string, options?: ToastShowOptions) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  toasts = [
    ...toasts,
    {
      id,
      tone,
      message,
      leading: options?.leading,
      action: options?.action,
    },
  ]
  emit()
  scheduleDismiss(id, TOAST_DISMISS_MS)
  return id
}

function dismiss(id?: string) {
  if (id === undefined) {
    for (const timer of dismissTimers.values()) {
      window.clearTimeout(timer)
    }
    dismissTimers.clear()
    dismissRemainingMs.clear()
    dismissStartedAt.clear()
    pausedDismissIds.clear()
    toasts = []
    emit()
    return
  }

  clearDismissTimer(id)
  dismissRemainingMs.delete(id)
  dismissStartedAt.delete(id)
  pausedDismissIds.delete(id)
  toasts = toasts.filter((item) => item.id !== id)
  emit()
}

function setToastPosition(next: ToastPosition) {
  if (position === next) return
  position = next
  emit()
}

export const toast = {
  success: (message: string, options?: ToastShowOptions) =>
    push("success", message, options),
  error: (message: string, options?: ToastShowOptions) =>
    push("error", message, options),
  info: (message: string, options?: ToastShowOptions) =>
    push("info", message, options),
  warning: (message: string, options?: ToastShowOptions) =>
    push("warning", message, options),
  dismiss,
}

const ICONS: Record<ToastTone, React.ReactNode> = {
  success: <CircleCheck className="size-4 fill-current" />,
  error: <CircleX className="size-4 fill-current" />,
  info: <Info className="size-4 fill-current" />,
  warning: <TriangleAlert className="size-4 fill-current" />,
}

function toastChromeStyle({
  background,
  foreground,
  borderColor,
  borderWidth,
  radius,
  shadow,
  paddingBlock,
  paddingInline,
  gap,
  width,
  height,
  minHeight,
  cornerShape,
}: Omit<ToastChromeProps, "showClose">): React.CSSProperties {
  return {
    ...(background != null ? { "--df-toast-bg": background } : null),
    ...(foreground != null ? { "--df-toast-fg": foreground } : null),
    ...(borderColor != null ? { "--df-toast-border": borderColor } : null),
    ...(borderWidth != null
      ? { "--df-toast-border-width": borderWidth }
      : null),
    ...(radius != null ? { "--df-toast-radius": radius } : null),
    ...(shadow != null ? { "--df-toast-shadow": shadow } : null),
    ...(paddingBlock != null
      ? { "--df-toast-padding-block": paddingBlock }
      : null),
    ...(paddingInline != null
      ? { "--df-toast-padding-inline": paddingInline }
      : null),
    ...(gap != null ? { "--df-toast-gap": gap } : null),
    ...(width != null ? { "--df-toast-width": width } : null),
    ...(height != null ? { "--df-toast-height": height } : null),
    ...(minHeight != null ? { "--df-toast-min-height": minHeight } : null),
    ...dfCornerShapeStyle(cornerShape),
  } as React.CSSProperties
}

type ToastProps = React.ComponentProps<"div"> &
  ToastChromeProps & {
    tone: ToastTone
    message: string
    /** Defaults to the tone icon. Pass null to hide the slot. */
    leading?: React.ReactNode | undefined
    /** Compact action control shown before dismiss. */
    action?: ToastAction | undefined
    onDismiss?: (() => void) | undefined
    /** Pause the live auto dismiss timer while the action is hovered or focused. */
    onActionPauseChange?: ((paused: boolean) => void) | undefined
  }

function Toast({
  tone,
  message,
  leading,
  action,
  onDismiss,
  onActionPauseChange,
  showClose = true,
  background,
  foreground,
  borderColor,
  borderWidth,
  radius,
  shadow,
  paddingBlock,
  paddingInline,
  gap,
  width,
  height,
  minHeight,
  cornerShape,
  className,
  style,
  ...props
}: ToastProps) {
  const s = useDfStrings()
  const leadingContent = leading === undefined ? ICONS[tone] : leading
  const toastStyle = {
    ...toastChromeStyle({
      background,
      foreground,
      borderColor,
      borderWidth,
      radius,
      shadow,
      paddingBlock,
      paddingInline,
      gap,
      width,
      height,
      minHeight,
      cornerShape,
    }),
    ...style,
  } as React.CSSProperties

  const handleActionClick = () => {
    action?.onClick()
    onDismiss?.()
  }

  const handleActionPause = (paused: boolean) => {
    onActionPauseChange?.(paused)
  }

  return (
    <div
      role="status"
      data-df="toast"
      data-tone={tone}
      className={cn("df-toast", className)}
      style={toastStyle}
      {...props}
    >
      {leadingContent != null ? (
        <span className="df-toast-icon" aria-hidden>
          {leadingContent}
        </span>
      ) : null}
      <p className="df-toast-message">{message}</p>
      {action ? (
        <button
          type="button"
          className="df-toast-action"
          onClick={handleActionClick}
          onMouseEnter={() => handleActionPause(true)}
          onMouseLeave={() => handleActionPause(false)}
          onFocus={() => handleActionPause(true)}
          onBlur={() => handleActionPause(false)}
        >
          {action.label}
        </button>
      ) : null}
      {showClose ? (
        onDismiss ? (
          <button
            type="button"
            className="df-toast-close"
            aria-label={s.toastDismiss}
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <span className="df-toast-close" aria-hidden>
            <X className="size-3.5" />
          </span>
        )
      ) : null}
    </div>
  )
}

type ToasterProps = ToastChromeProps & {
  position?: ToastPosition
  className?: string
  style?: React.CSSProperties
  stackWidth?: string
  stackGap?: string
  inset?: string
  viewportGutter?: string
}

export function Toaster({
  position: positionProp,
  className,
  style,
  stackWidth,
  stackGap,
  inset,
  viewportGutter,
  background,
  foreground,
  borderColor,
  borderWidth,
  radius,
  shadow,
  paddingBlock,
  paddingInline,
  gap,
  width,
  height,
  minHeight,
  cornerShape,
  showClose = true,
}: ToasterProps = {}) {
  const mounted = useIsClient()
  const items = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
  const currentPosition = React.useSyncExternalStore(
    subscribe,
    getPositionSnapshot,
    getPositionServerSnapshot
  )

  useIsomorphicLayoutEffect(() => {
    if (positionProp) setToastPosition(positionProp)
  }, [positionProp])

  if (!mounted) return null

  const resolved = positionProp ?? currentPosition
  const toasterStyle = {
    ...(stackWidth != null ? { "--df-toaster-width": stackWidth } : null),
    ...(stackGap != null ? { "--df-toaster-gap": stackGap } : null),
    ...(inset != null ? { "--df-toaster-inset": inset } : null),
    ...(viewportGutter != null
      ? { "--df-toaster-viewport-gutter": viewportGutter }
      : null),
    ...toastChromeStyle({
      background,
      foreground,
      borderColor,
      borderWidth,
      radius,
      shadow,
      paddingBlock,
      paddingInline,
      gap,
      width,
      height,
      minHeight,
      cornerShape,
    }),
    ...style,
  } as React.CSSProperties

  return createPortal(
    <div
      className={cn("df-toaster", className)}
      data-position={resolved}
      style={toasterStyle}
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        <Toast
          key={item.id}
          tone={item.tone}
          message={item.message}
          leading={item.leading}
          action={item.action}
          showClose={showClose}
          onDismiss={() => dismiss(item.id)}
          onActionPauseChange={(paused) => {
            if (paused) pauseDismiss(item.id)
            else resumeDismiss(item.id)
          }}
        />
      ))}
    </div>,
    document.body
  )
}

export { Toast, setToastPosition }
export type {
  ToastAction,
  ToastChromeProps,
  ToastPosition,
  ToastProps,
  ToastShowOptions,
  ToasterProps,
  ToastTone,
}
