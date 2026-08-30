import * as React from "react"

import { Button, dfButtonClass } from "./df-button"
import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import { sanitizeHref } from "../lib/df-url"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"

type OverlayHintVariant = "default" | "muted" | "marquee"

type OverlayHintRadius = "none" | "md" | "full"

type OverlayHintScheme = "light" | "dark"

type OverlayHintClickTarget = "chip" | "action"

type OverlayHintSize = "sm" | "md"

const OVERLAY_HINT_SEPARATOR = "·"

const MARQUEE_ACTION_SIZE = "icon-xs" as const
const MARQUEE_ACTION_VARIANT = "secondary" as const

type OverlayHintProps = React.HTMLAttributes<HTMLElement> & {
  variant?: OverlayHintVariant
  radius?: OverlayHintRadius
  cornerShape?: DfCornerShape
  scheme?: OverlayHintScheme
  speed?: number
  marqueeWidth?: string
  clickTarget?: OverlayHintClickTarget
  size?: OverlayHintSize
  action?: React.ReactNode
  actionLabel?: string
  onAction?: React.MouseEventHandler<HTMLElement>
  actionHref?: string
  background?: string
  borderColor?: string
  foreground?: string
  shadow?: string
  blur?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
  parts?: React.ReactNode[]
  separator?: React.ReactNode
}

function renderLabelContent({
  parts,
  separator,
  children,
}: {
  parts?: React.ReactNode[] | undefined
  separator: React.ReactNode
  children: React.ReactNode
}) {
  const useParts = parts != null && parts.length > 0
  if (useParts) {
    return parts.flatMap((part, index) => {
      const nodes: React.ReactNode[] = [
        <span
          key={`part-${index}`}
          className="df-overlay-hint-label"
          data-df="overlay-hint-label"
        >
          {part}
        </span>,
      ]
      if (
        index < parts.length - 1 &&
        separator != null &&
        separator !== false
      ) {
        nodes.push(
          <span
            key={`sep-${index}`}
            className="df-overlay-hint-separator"
            data-df="overlay-hint-separator"
            data-slot="separator"
            aria-hidden="true"
          >
            {separator}
          </span>
        )
      }
      return nodes
    })
  }
  if (children == null || children === false) return null
  return (
    <span className="df-overlay-hint-label" data-df="overlay-hint-label">
      {children}
    </span>
  )
}

function MarqueeActionControl({
  action,
  actionLabel,
  actionHref,
  onAction,
  interactive,
  scheme,
}: {
  action: React.ReactNode
  actionLabel?: string | undefined
  actionHref?: string | undefined
  onAction?: React.MouseEventHandler<HTMLElement> | undefined
  interactive: boolean
  scheme?: OverlayHintScheme | undefined
}) {
  const s = useDfStrings()
  const surfaceClass = scheme === "dark" ? "dark" : undefined
  const actionClassName = cn("df-overlay-hint-action", surfaceClass)

  if (!interactive) {
    return (
      <span
        className={dfButtonClass({
          variant: MARQUEE_ACTION_VARIANT,
          size: MARQUEE_ACTION_SIZE,
          className: actionClassName,
        })}
        data-df="button"
        data-variant={MARQUEE_ACTION_VARIANT}
        data-size={MARQUEE_ACTION_SIZE}
        aria-hidden="true"
      >
        {action}
      </span>
    )
  }

  if (actionHref != null) {
    const safeHref = sanitizeHref(actionHref)
    if (safeHref != null) {
      return (
        <a
          href={safeHref}
          className={dfButtonClass({
            variant: MARQUEE_ACTION_VARIANT,
            size: MARQUEE_ACTION_SIZE,
            className: actionClassName,
          })}
          data-df="button"
          data-variant={MARQUEE_ACTION_VARIANT}
          data-size={MARQUEE_ACTION_SIZE}
          aria-label={actionLabel ?? s.overlayHintOpen}
        >
          {action}
        </a>
      )
    }
  }

  return (
    <Button
      type="button"
      variant={MARQUEE_ACTION_VARIANT}
      size={MARQUEE_ACTION_SIZE}
      className={actionClassName}
      aria-label={actionLabel ?? s.overlayHintAction}
      onClick={onAction as React.MouseEventHandler<HTMLButtonElement>}
    >
      {action}
    </Button>
  )
}

function OverlayHint({
  className,
  style,
  variant = "default",
  radius = "md",
  cornerShape,
  scheme,
  speed = 18,
  marqueeWidth,
  clickTarget = "chip",
  size = "md",
  action,
  actionLabel,
  onAction,
  actionHref,
  background,
  borderColor,
  foreground,
  shadow,
  blur,
  leading,
  trailing,
  parts,
  separator = OVERLAY_HINT_SEPARATOR,
  children,
  onClick,
  ...props
}: OverlayHintProps) {
  const isMarquee = variant === "marquee"
  const safeActionHref =
    actionHref != null ? sanitizeHref(actionHref) : null
  const label = renderLabelContent({ parts, separator, children })
  const chipClickable =
    isMarquee &&
    clickTarget === "chip" &&
    (safeActionHref != null || onAction != null || onClick != null)
  const actionClickable =
    isMarquee && clickTarget === "action" && action != null

  const hintStyle = {
    ...(background != null ? { "--overlay-hint-bg": background } : null),
    ...(borderColor != null
      ? { "--overlay-hint-border": borderColor }
      : null),
    ...(foreground != null ? { "--overlay-hint-fg": foreground } : null),
    ...(shadow != null ? { "--overlay-hint-shadow": shadow } : null),
    ...(blur != null ? { "--overlay-hint-blur": blur } : null),
    ...(isMarquee
      ? {
          "--overlay-hint-marquee-duration": `${Math.max(speed, 0.1)}s`,
        }
      : null),
    ...(isMarquee && marqueeWidth != null
      ? { "--overlay-hint-marquee-width": marqueeWidth }
      : null),
    ...dfCornerShapeStyle(cornerShape),
    ...style,
  } as React.CSSProperties

  const body = (
    <>
      {leading != null && (
        <span
          className="df-overlay-hint-slot"
          data-df="overlay-hint-slot"
          data-slot="leading"
        >
          {leading}
        </span>
      )}

      {isMarquee ? (
        <div
          className="df-overlay-hint-marquee"
          data-df="overlay-hint-marquee"
        >
          <span
            className="df-overlay-hint-marquee-segment"
            data-df="overlay-hint-marquee-segment"
          >
            {label}
          </span>
          <span
            className="df-overlay-hint-marquee-segment"
            data-df="overlay-hint-marquee-segment"
            aria-hidden="true"
          >
            {label}
          </span>
        </div>
      ) : (
        label
      )}

      {isMarquee && action != null ? (
        <MarqueeActionControl
          action={action}
          actionLabel={actionLabel}
          actionHref={safeActionHref ?? undefined}
          onAction={onAction}
          interactive={actionClickable}
          scheme={scheme}
        />
      ) : (
        trailing != null && (
          <span
            className="df-overlay-hint-slot"
            data-df="overlay-hint-slot"
            data-slot="trailing"
          >
            {trailing}
          </span>
        )
      )}
    </>
  )

  const sharedClassName = cn(
    "df-overlay-hint",
    isMarquee && scheme === "dark" && "dark",
    className
  )
  const sharedData = {
    "data-df": "overlay-hint" as const,
    "data-variant": variant,
    "data-radius": radius,
    "data-corner-shape": cornerShape,
    "data-scheme": isMarquee ? scheme : undefined,
    "data-click-target": isMarquee ? clickTarget : undefined,
    "data-size": isMarquee ? size : undefined,
  }

  if (chipClickable && safeActionHref != null) {
    return (
      <a
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        href={safeActionHref}
        aria-label={actionLabel}
        className={sharedClassName}
        style={hintStyle}
        {...sharedData}
      >
        {body}
      </a>
    )
  }

  if (chipClickable) {
    return (
      <button
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        type="button"
        aria-label={actionLabel}
        className={sharedClassName}
        style={hintStyle}
        onClick={(event) => {
          onAction?.(event)
          onClick?.(event)
        }}
        {...sharedData}
      >
        {body}
      </button>
    )
  }

  return (
    <div
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
      className={sharedClassName}
      style={hintStyle}
      onClick={onClick}
      {...sharedData}
    >
      {body}
    </div>
  )
}

export { OverlayHint, OVERLAY_HINT_SEPARATOR }
export type {
  OverlayHintProps,
  OverlayHintVariant,
  OverlayHintRadius,
  OverlayHintScheme,
  OverlayHintClickTarget,
  OverlayHintSize,
  DfCornerShape,
}
