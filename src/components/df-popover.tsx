"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import {
  DISMISS_NESTED_LAYER_SELECTORS,
  useAnchoredPosition,
  useControllableState,
  useDismiss,
  useIsClient,
  useIsomorphicLayoutEffect,
  useNearestDarkClass,
  type Align,
  type Side,
} from "../hooks"
import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import {
  dfPaddingChromeStyle,
  resolvePaddingSides,
} from "../lib/padding-chrome"
import { cn, composeEventHandlers } from "../lib/utils"

type PopoverVariant = "default" | "muted" | "elevated" | "inverse"
type PopoverSize = "sm" | "md" | "lg"
type PopoverBorderWidth = "none" | "hairline" | "thin" | "thick"
type PopoverRadius =
  | "none"
  | "xxs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "full"

const POPOVER_RADIUS_VAR: Record<PopoverRadius, string> = {
  none: "0px",
  xxs: "var(--radius-xxs)",
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  "3xl": "var(--radius-3xl)",
  "4xl": "var(--radius-4xl)",
  full: "var(--radius-full)",
}

const POPOVER_BORDER_WIDTH_VAR: Record<PopoverBorderWidth, string> = {
  none: "0px",
  hairline: "var(--border-width-hairline)",
  thin: "var(--border-width-thin)",
  thick: "var(--border-width-thick)",
}

type PopoverContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  contentId: string
  titleId: string
  descriptionId: string
  hasTitle: boolean
  setHasTitle: (value: boolean) => void
  hasDescription: boolean
  setHasDescription: (value: boolean) => void
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopoverContext() {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) throw new Error("Popover components must be used within Popover")
  return ctx
}

function Popover({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentId = React.useId()
  const titleId = React.useId()
  const descriptionId = React.useId()
  const [hasTitle, setHasTitle] = React.useState(false)
  const [hasDescription, setHasDescription] = React.useState(false)

  return (
    <PopoverContext.Provider
      value={{
        open: isOpen,
        setOpen,
        triggerRef,
        contentId,
        titleId,
        descriptionId,
        hasTitle,
        setHasTitle,
        hasDescription,
        setHasDescription,
      }}
    >
      {children}
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({
  children,
  render,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { open, setOpen, triggerRef, contentId } = usePopoverContext()

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (render) {
      const renderOnClick = (
        render.props as {
          onClick?: (event: React.MouseEvent<HTMLElement>) => void
        }
      ).onClick
      renderOnClick?.(event)
      if (event.defaultPrevented) return
    }
    composeEventHandlers(props.onClick, () => {
      setOpen(!open)
    })(event as React.MouseEvent<HTMLButtonElement>)
  }

  if (render) {
    return React.cloneElement(render, {
      ...props,
      ref: triggerRef as React.Ref<HTMLButtonElement>,
      "data-df-popover-trigger": "",
      "aria-expanded": open,
      "aria-controls": open ? contentId : undefined,
      onClick: handleClick,
      className: cn(
        className,
        (render.props as { className?: string }).className
      ),
      children:
        children ??
        (render.props as { children?: React.ReactNode }).children,
    } as never)
  }

  return (
    <button
      type="button"
      data-df="popover-trigger"
      {...props}
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      data-df-popover-trigger=""
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      className={cn(className)}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

type PopoverContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: Align
  alignOffset?: number
  side?: Side
  sideOffset?: number
  matchTriggerWidth?: boolean
  portal?: boolean
  dismissOnScroll?: boolean
  followScroll?: boolean
  collisionAvoidance?: boolean
  variant?: PopoverVariant
  size?: PopoverSize
  showArrow?: boolean
  animated?: boolean
  background?: string
  borderColor?: string
  borderWidth?: PopoverBorderWidth
  shadow?: string
  radius?: PopoverRadius
  cornerShape?: DfCornerShape
  foreground?: string
  padding?: string
  paddingX?: string
  paddingY?: string
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
  gap?: string
}

function PopoverContent({
  className,
  style: styleProp,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  matchTriggerWidth = false,
  portal = true,
  dismissOnScroll = true,
  followScroll = true,
  collisionAvoidance = true,
  variant = "default",
  size = "md",
  showArrow = false,
  animated = true,
  background,
  borderColor,
  borderWidth,
  shadow,
  radius,
  cornerShape,
  foreground,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  gap,
  children,
  ...props
}: PopoverContentProps) {
  const {
    open,
    setOpen,
    triggerRef,
    contentId,
    titleId,
    descriptionId,
    hasTitle,
    hasDescription,
  } = usePopoverContext()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const portalThemeClass = useNearestDarkClass(triggerRef, open && portal)
  const placement = useAnchoredPosition({
    open: open && portal,
    triggerRef,
    contentRef,
    side,
    align,
    sideOffset,
    alignOffset,
    matchTriggerWidth,
    collisionAvoidance,
    followScroll,
  })

  useDismiss(open && portal, () => setOpen(false), [triggerRef, contentRef], {
    excludeSelectors: DISMISS_NESTED_LAYER_SELECTORS,
    dismissOnScroll,
  })

  const mounted = useIsClient()

  // Return focus to the trigger when the panel closes and focus was inside it.
  const wasOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    const active = document.activeElement
    if (
      active == null ||
      active === document.body ||
      contentRef.current?.contains(active)
    ) {
      triggerRef.current?.focus?.()
    }
  }, [open, triggerRef])

  const chromeStyle = {
    ...(background != null ? { "--df-popover-surface": background } : null),
    ...(foreground != null
      ? { "--df-popover-surface-fg": foreground }
      : null),
    ...(borderColor != null
      ? { "--df-popover-border-color": borderColor }
      : null),
    ...(borderWidth != null
      ? { "--df-popover-border-width": POPOVER_BORDER_WIDTH_VAR[borderWidth] }
      : null),
    ...(shadow != null
      ? showArrow
        ? { "--df-popover-elevation": shadow }
        : { "--df-popover-shadow": shadow }
      : null),
    ...(radius != null
      ? { "--df-popover-radius": POPOVER_RADIUS_VAR[radius] }
      : null),
    ...(gap != null ? { "--df-popover-gap": gap } : null),
    ...dfPaddingChromeStyle(
      "--df-popover-inset",
      resolvePaddingSides({
        padding,
        paddingX,
        paddingY,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      })
    ),
    ...dfCornerShapeStyle(cornerShape),
  } as React.CSSProperties

  if (!mounted) return null
  if (!open) return null

  const placementStyle: React.CSSProperties = { ...placement.style }
  if (portal) {
    delete placementStyle.visibility
  }
  // Hide only until the hook reports a position attempt. Failed measures still
  // clear the gate so a zero-box host cannot leave an open panel inert.
  const awaitingPosition = portal && !placement.positionAttempted
  if (awaitingPosition) {
    placementStyle.opacity = 0
    placementStyle.pointerEvents = "none"
  }

  const panel = (
    <div
      ref={contentRef}
      id={contentId}
      aria-labelledby={hasTitle ? titleId : undefined}
      aria-describedby={hasDescription ? descriptionId : undefined}
      data-df="popover-content"
      data-variant={variant}
      data-size={size}
      data-arrow={showArrow ? "true" : "false"}
      data-animated={animated ? "true" : "false"}
      data-side={placement.side}
      data-align={placement.align}
      data-portal={portal ? "true" : "false"}
      className={cn(className)}
      style={
        portal
          ? { ...placementStyle, ...chromeStyle, ...styleProp }
          : { position: "relative", ...chromeStyle, ...styleProp }
      }
      {...props}
    >
      {showArrow ? <span data-df="popover-arrow" aria-hidden /> : null}
      {children}
    </div>
  )

  if (!portal) return panel

  return createPortal(
    <div data-df="popover-portal" className={portalThemeClass}>
      {panel}
    </div>,
    document.body
  )
}

type PopoverHeaderProps = React.ComponentProps<"div"> & {
  gap?: string
}

function PopoverHeader({
  className,
  style,
  gap,
  ...props
}: PopoverHeaderProps) {
  return (
    <div
      data-df="popover-header"
      className={cn(className)}
      style={
        {
          ...(gap != null ? { "--df-popover-header-gap": gap } : null),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

type PopoverTitleBadgePosition = "end" | "below"

type PopoverTitleProps = React.ComponentProps<"h2"> & {
  color?: string
  fontSize?: string
  fontWeight?: string
  fontFamily?: string
  lineHeight?: string
  letterSpacing?: string
  /** Open ReactNode slot beside or under the title. Not limited to Badge. */
  badge?: React.ReactNode
  /** end places the slot on the title row; below stacks it under the title. */
  badgePosition?: PopoverTitleBadgePosition
}

function PopoverTitle({
  className,
  style,
  color,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
  letterSpacing,
  badge,
  badgePosition = "end",
  children,
  ...props
}: PopoverTitleProps) {
  const { titleId, setHasTitle } = usePopoverContext()

  useIsomorphicLayoutEffect(() => {
    setHasTitle(true)
    return () => setHasTitle(false)
  }, [setHasTitle])

  const hasBadge = badge != null

  return (
    <h2
      id={titleId}
      data-df="popover-title"
      data-badge={hasBadge ? badgePosition : undefined}
      className={cn(className)}
      style={
        {
          ...(color != null ? { "--df-popover-title-color": color } : null),
          ...(fontSize != null
            ? { "--df-popover-title-size": fontSize }
            : null),
          ...(fontWeight != null
            ? { "--df-popover-title-weight": fontWeight }
            : null),
          ...(fontFamily != null
            ? { "--df-popover-title-font": fontFamily }
            : null),
          ...(lineHeight != null
            ? { "--df-popover-title-leading": lineHeight }
            : null),
          ...(letterSpacing != null
            ? { "--df-popover-title-tracking": letterSpacing }
            : null),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {hasBadge ? (
        <span data-df="popover-title-text">{children}</span>
      ) : (
        children
      )}
      {hasBadge ? (
        <span data-df="popover-title-badge">{badge}</span>
      ) : null}
    </h2>
  )
}

type PopoverDescriptionProps = React.ComponentProps<"p"> & {
  color?: string
  fontSize?: string
  fontWeight?: string
  fontFamily?: string
  lineHeight?: string
  letterSpacing?: string
}

function PopoverDescription({
  className,
  style,
  color,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
  letterSpacing,
  ...props
}: PopoverDescriptionProps) {
  const { descriptionId, setHasDescription } = usePopoverContext()

  useIsomorphicLayoutEffect(() => {
    setHasDescription(true)
    return () => setHasDescription(false)
  }, [setHasDescription])

  return (
    <p
      id={descriptionId}
      data-df="popover-description"
      className={cn(className)}
      style={
        {
          ...(color != null
            ? { "--df-popover-description-color": color }
            : null),
          ...(fontSize != null
            ? { "--df-popover-description-size": fontSize }
            : null),
          ...(fontWeight != null
            ? { "--df-popover-description-weight": fontWeight }
            : null),
          ...(fontFamily != null
            ? { "--df-popover-description-font": fontFamily }
            : null),
          ...(lineHeight != null
            ? { "--df-popover-description-leading": lineHeight }
            : null),
          ...(letterSpacing != null
            ? { "--df-popover-description-tracking": letterSpacing }
            : null),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

type PopoverHeaderBarProps = React.ComponentProps<"div"> & {
  gap?: string
}

function PopoverHeaderBar({
  className,
  style,
  gap,
  ...props
}: PopoverHeaderBarProps) {
  return (
    <div
      data-df="popover-header-bar"
      className={cn(className)}
      style={
        {
          ...(gap != null ? { "--df-popover-header-bar-gap": gap } : null),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

function PopoverBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-df="popover-body" className={cn(className)} {...props} />
  )
}

type PopoverFooterJustify = "end" | "between" | "start"

type PopoverFooterProps = React.ComponentProps<"div"> & {
  paddingTop?: string
  paddingBottom?: string
  paddingX?: string
  gap?: string
  justify?: PopoverFooterJustify
}

function PopoverFooter({
  className,
  style,
  paddingTop,
  paddingBottom,
  paddingX,
  gap,
  justify = "end",
  ...props
}: PopoverFooterProps) {
  return (
    <div
      data-df="popover-footer"
      data-justify={justify}
      className={cn(className)}
      style={
        {
          ...(paddingTop != null
            ? { "--df-popover-footer-padding-top": paddingTop }
            : null),
          ...(paddingBottom != null
            ? { "--df-popover-footer-padding-bottom": paddingBottom }
            : null),
          ...(paddingX != null
            ? { "--df-popover-footer-padding-x": paddingX }
            : null),
          ...(gap != null ? { "--df-popover-footer-gap": gap } : null),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

function PopoverClose({
  children,
  render,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { setOpen } = usePopoverContext()

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (render) {
      const renderOnClick = (
        render.props as {
          onClick?: (event: React.MouseEvent<HTMLElement>) => void
        }
      ).onClick
      renderOnClick?.(event)
      if (event.defaultPrevented) return
    }
    composeEventHandlers(props.onClick, () => {
      setOpen(false)
    })(event as React.MouseEvent<HTMLButtonElement>)
  }

  if (render) {
    return React.cloneElement(render, {
      ...props,
      "data-df-popover-close": "",
      onClick: handleClick,
      className: cn(
        className,
        (render.props as { className?: string }).className
      ),
      children:
        children ??
        (render.props as { children?: React.ReactNode }).children,
    } as never)
  }

  return (
    <button
      type="button"
      data-df="popover-close"
      {...props}
      className={cn(className)}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

export {
  Popover,
  PopoverBody,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverHeaderBar,
  PopoverTitle,
  PopoverTrigger,
}
export type {
  PopoverBorderWidth,
  PopoverContentProps,
  PopoverDescriptionProps,
  PopoverFooterJustify,
  PopoverFooterProps,
  PopoverHeaderBarProps,
  PopoverHeaderProps,
  PopoverRadius,
  PopoverSize,
  PopoverTitleBadgePosition,
  PopoverTitleProps,
  PopoverVariant,
}
