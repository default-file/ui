"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { useControllableState, useIsomorphicLayoutEffect } from "../hooks"
import { cn, composeEventHandlers } from "../lib/utils"

type AccordionType = "single" | "multiple"
type AccordionVariant = "default" | "ghost" | "separated"
type AccordionSize = "xs" | "sm" | "default" | "lg"
type AccordionRadius = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
type AccordionContentPadding = "none" | "sm" | "default" | "lg"

type AccordionSharedProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> & {
  collapsible?: boolean
  variant?: AccordionVariant
  size?: AccordionSize
  radius?: AccordionRadius
  showDividers?: boolean
  disabled?: boolean
  /** Root shell fill. Sets --df-accordion-bg. */
  background?: string
  /** Header fill for every item. Sets --df-accordion-trigger-bg. */
  triggerBackground?: string
  /** Open panel fill for every item. Sets --df-accordion-content-bg. */
  contentBackground?: string
  /** Open panel block padding. Sets data-content-padding. */
  contentPadding?: AccordionContentPadding
}

type AccordionSingleProps = AccordionSharedProps & {
  type?: "single"
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
}

type AccordionMultipleProps = AccordionSharedProps & {
  type: "multiple"
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
}

type AccordionProps = AccordionSingleProps | AccordionMultipleProps

type AccordionContextValue = {
  type: AccordionType
  collapsible: boolean
  variant: AccordionVariant
  size: AccordionSize
  showDividers: boolean
  disabled: boolean
  contentPadding: AccordionContentPadding | null
  baseId: string
  isItemOpen: (itemValue: string) => boolean
  toggleItem: (itemValue: string) => void
  getTriggerId: (itemValue: string) => string
  getContentId: (itemValue: string) => string
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

function useAccordion() {
  const ctx = React.useContext(AccordionContext)
  if (!ctx) throw new Error("Accordion parts must be used within Accordion")
  return ctx
}

type AccordionItemContextValue = {
  value: string
  disabled: boolean
  open: boolean
  triggerId: string
  contentId: string
  hasLeading: boolean
  setHasLeading: (hasLeading: boolean) => void
}

const AccordionItemContext =
  React.createContext<AccordionItemContextValue | null>(null)

function useAccordionItem() {
  const ctx = React.useContext(AccordionItemContext)
  if (!ctx) {
    throw new Error("Accordion parts must be used within AccordionItem")
  }
  return ctx
}

function accordionTriggerSizeClass(size: AccordionSize) {
  const isXs = size === "xs"
  const isSm = size === "sm"
  const isDefault = size === "default"
  const isLg = size === "lg"
  return cn(
    isXs && "gap-2 py-2",
    isSm && "gap-3 py-3",
    isDefault && "gap-4 py-5",
    isLg && "gap-4 py-6"
  )
}

function accordionTitleSizeClass(size: AccordionSize) {
  const isXs = size === "xs"
  const isSm = size === "sm"
  const isDefault = size === "default"
  const isLg = size === "lg"
  return cn(
    "font-semibold tracking-tight",
    isXs && "text-13",
    isSm && "text-sm",
    isDefault && "text-base sm:text-lg",
    isLg && "text-lg"
  )
}

function accordionSubtitleSizeClass(size: AccordionSize) {
  const isXs = size === "xs"
  const isSm = size === "sm"
  const isDefault = size === "default"
  const isLg = size === "lg"
  return cn(
    "font-normal text-muted-foreground text-pretty",
    isXs && "text-2xs",
    isSm && "text-xs",
    isDefault && "text-sm",
    isLg && "text-base"
  )
}

function accordionContentTypeClass(size: AccordionSize) {
  const isXs = size === "xs"
  const isSm = size === "sm"
  const isDefault = size === "default"
  const isLg = size === "lg"
  return cn(
    "leading-relaxed text-muted-foreground text-pretty",
    isXs && "text-2xs",
    isSm && "text-xs sm:text-sm",
    isDefault && "text-sm sm:text-base",
    isLg && "text-base"
  )
}

function accordionContentSizeClass(size: AccordionSize) {
  const isXs = size === "xs"
  const isSm = size === "sm"
  const isDefault = size === "default"
  const isLg = size === "lg"
  return cn(
    accordionContentTypeClass(size),
    isXs && "pb-2",
    isSm && "pb-3",
    isDefault && "pb-5",
    isLg && "pb-6"
  )
}

function accordionIconSizeClass(size: AccordionSize) {
  const isXs = size === "xs"
  return cn(isXs ? "size-3.5" : "size-4")
}

function accordionLeadingClusterClass(size: AccordionSize) {
  const isXs = size === "xs"
  const isSm = size === "sm"
  return cn(
    "flex min-w-0 flex-1 items-center",
    isXs && "gap-2",
    isSm && "gap-3",
    !isXs && !isSm && "gap-4"
  )
}

function Accordion(props: AccordionProps) {
  const {
    className,
    style,
    children,
    collapsible = true,
    variant = "default",
    size = "default",
    radius = "3xl",
    showDividers,
    disabled = false,
    background,
    triggerBackground,
    contentBackground,
    contentPadding,
    type = "single",
    onKeyDown,
    value,
    defaultValue,
    onValueChange,
    ...rootProps
  } = props as AccordionProps & {
    value?: string | null | string[]
    defaultValue?: string | null | string[]
    onValueChange?: ((value: string | null) => void) | ((value: string[]) => void)
  }

  const rootStyle = {
    ...(background != null ? { "--df-accordion-bg": background } : null),
    ...(triggerBackground != null
      ? { "--df-accordion-trigger-bg": triggerBackground }
      : null),
    ...(contentBackground != null
      ? { "--df-accordion-content-bg": contentBackground }
      : null),
    ...style,
  } as React.CSSProperties

  const isMultiple = type === "multiple"

  const [singleValue, setSingleValue] = useControllableState<string | null>({
    value: isMultiple ? undefined : (value as string | null | undefined),
    defaultValue: isMultiple
      ? null
      : ((defaultValue as string | null | undefined) ?? null),
    onChange: isMultiple
      ? undefined
      : (onValueChange as ((next: string | null) => void) | undefined),
  })

  const [multipleValue, setMultipleValue] = useControllableState<string[]>({
    value: isMultiple ? (value as string[] | undefined) : undefined,
    defaultValue: isMultiple
      ? ((defaultValue as string[] | undefined) ?? [])
      : [],
    onChange: isMultiple
      ? (onValueChange as ((next: string[]) => void) | undefined)
      : undefined,
  })

  const reactId = React.useId()
  const baseId = `df-accordion${reactId.replace(/:/g, "")}`
  const rootRef = React.useRef<HTMLDivElement>(null)
  const resolvedShowDividers = showDividers ?? variant !== "separated"

  const isItemOpen = React.useCallback(
    (itemValue: string) => {
      if (isMultiple) return multipleValue.includes(itemValue)
      return singleValue === itemValue
    },
    [isMultiple, multipleValue, singleValue]
  )

  const toggleItem = React.useCallback(
    (itemValue: string) => {
      if (disabled) return
      if (isMultiple) {
        setMultipleValue((prev) =>
          prev.includes(itemValue)
            ? prev.filter((entry) => entry !== itemValue)
            : [...prev, itemValue]
        )
        return
      }
      const open = singleValue === itemValue
      if (open) {
        if (collapsible) setSingleValue(null)
        return
      }
      setSingleValue(itemValue)
    },
    [
      collapsible,
      disabled,
      isMultiple,
      setMultipleValue,
      setSingleValue,
      singleValue,
    ]
  )

  const getTriggerId = React.useCallback(
    (itemValue: string) => `${baseId}-trigger-${itemValue}`,
    [baseId]
  )
  const getContentId = React.useCallback(
    (itemValue: string) => `${baseId}-content-${itemValue}`,
    [baseId]
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    const root = rootRef.current
    if (!root) return
    const triggers = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        '[data-df="accordion-trigger"]:not(:disabled)'
      )
    )
    if (triggers.length === 0) return
    event.preventDefault()
    const activeIndex = triggers.indexOf(
      document.activeElement as HTMLButtonElement
    )
    let nextIndex: number
    if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = triggers.length - 1
    else {
      const step = event.key === "ArrowUp" ? -1 : 1
      const base = activeIndex === -1 ? 0 : activeIndex
      nextIndex = (base + step + triggers.length) % triggers.length
    }
    triggers[nextIndex]?.focus()
  }

  return (
    <AccordionContext.Provider
      value={{
        type,
        collapsible,
        variant,
        size,
        showDividers: resolvedShowDividers,
        disabled,
        contentPadding: contentPadding ?? null,
        baseId,
        isItemOpen,
        toggleItem,
        getTriggerId,
        getContentId,
      }}
    >
      <div
        ref={rootRef}
        data-df="accordion"
        data-type={type}
        data-variant={variant}
        data-size={size}
        data-radius={radius}
        data-content-padding={contentPadding}
        data-show-dividers={resolvedShowDividers ? "true" : "false"}
        data-disabled={disabled ? "true" : undefined}
        className={cn("flex flex-col", className)}
        {...rootProps}
        style={rootStyle}
        onKeyDown={(event) => {
          composeEventHandlers(onKeyDown, handleKeyDown)(event)
        }}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

type AccordionItemProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string
  disabled?: boolean
}

function AccordionItem({
  value,
  id,
  disabled: itemDisabled = false,
  className,
  children,
  ...props
}: AccordionItemProps) {
  const {
    disabled: rootDisabled,
    showDividers,
    isItemOpen,
    getTriggerId,
    getContentId,
  } = useAccordion()
  const disabled = rootDisabled || itemDisabled
  const open = isItemOpen(value)
  const triggerId = getTriggerId(value)
  const contentId = getContentId(value)
  const [hasLeading, setHasLeading] = React.useState(false)

  return (
    <AccordionItemContext.Provider
      value={{
        value,
        disabled,
        open,
        triggerId,
        contentId,
        hasLeading,
        setHasLeading,
      }}
    >
      <div
        id={id}
        data-df="accordion-item"
        data-state={open ? "open" : "closed"}
        data-leading={hasLeading ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        className={cn(
          showDividers && "border-b border-border/80 last:border-b-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

type AccordionTriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: React.ReactNode
  /** Secondary line under the title. */
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  leading?: React.ReactNode
  /** Custom indicator. Pass null to hide the chevron. */
  indicator?: React.ReactNode
  /** Header fill for this trigger. Sets --df-accordion-trigger-bg. */
  background?: string
}

function AccordionTrigger({
  className,
  style,
  children,
  subtitle,
  meta,
  leading,
  indicator,
  background,
  disabled: triggerDisabled,
  onClick,
  ...props
}: AccordionTriggerProps) {
  const { size, toggleItem } = useAccordion()
  const {
    value,
    disabled: itemDisabled,
    open,
    triggerId,
    contentId,
    setHasLeading,
  } = useAccordionItem()
  const disabled = itemDisabled || Boolean(triggerDisabled)
  const showDefaultIndicator = indicator === undefined
  const iconClass = accordionIconSizeClass(size)
  const resolvedIndicator = showDefaultIndicator ? (
    <ChevronDown
      className={cn("df-accordion-chevron text-foreground/40", iconClass)}
      data-open={open ? "true" : "false"}
      data-state={open ? "open" : "closed"}
      aria-hidden
    />
  ) : (
    indicator
  )

  useIsomorphicLayoutEffect(() => {
    setHasLeading(leading != null)
    return () => setHasLeading(false)
  }, [leading, setHasLeading])

  const triggerStyle = {
    ...(background != null
      ? { "--df-accordion-trigger-bg": background }
      : null),
    ...style,
  } as React.CSSProperties

  return (
    <button
      type="button"
      id={triggerId}
      aria-expanded={open}
      aria-controls={contentId}
      disabled={disabled}
      data-df="accordion-trigger"
      data-state={open ? "open" : "closed"}
      data-open={open ? "true" : "false"}
      data-leading={leading != null ? "true" : undefined}
      data-subtitle={subtitle != null ? "true" : undefined}
      className={cn(
        "flex w-full items-center justify-between text-left disabled:pointer-events-none disabled:opacity-50",
        accordionTriggerSizeClass(size),
        className
      )}
      {...props}
      style={triggerStyle}
      onClick={composeEventHandlers(onClick, () => {
        if (disabled) return
        toggleItem(value)
      })}
    >
      <span className={accordionLeadingClusterClass(size)}>
        {leading != null ? (
          <span
            data-df="accordion-trigger-leading"
            className={cn(
              "inline-flex shrink-0 items-center justify-center text-foreground/50 [&_svg]:size-full",
              iconClass
            )}
          >
            {leading}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            data-df="accordion-trigger-title"
            className={cn("min-w-0", accordionTitleSizeClass(size))}
          >
            {children}
          </span>
          {subtitle != null ? (
            <span
              data-df="accordion-trigger-subtitle"
              className={cn("min-w-0", accordionSubtitleSizeClass(size))}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {meta}
        {resolvedIndicator}
      </span>
    </button>
  )
}

type AccordionContentProps = React.HTMLAttributes<HTMLDivElement> & {
  forceMount?: boolean
  /** Panel fill for this content. Sets --df-accordion-content-bg. */
  background?: string
}

function AccordionContent({
  className,
  style,
  children,
  forceMount = true,
  background,
  ...props
}: AccordionContentProps) {
  const { size, contentPadding } = useAccordion()
  const { open, triggerId, contentId, hasLeading } = useAccordionItem()
  const mounted = open || forceMount
  const contentStyle = {
    ...(background != null
      ? { "--df-accordion-content-bg": background }
      : null),
    ...style,
  } as React.CSSProperties
  const bodyClassName =
    contentPadding != null
      ? accordionContentTypeClass(size)
      : accordionContentSizeClass(size)

  return (
    <div
      {...props}
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      data-df="accordion-content"
      data-state={open ? "open" : "closed"}
      data-open={open ? "true" : "false"}
      data-leading={hasLeading ? "true" : undefined}
      hidden={!open && !forceMount ? true : undefined}
      inert={!open ? true : undefined}
      className="df-accordion-panel"
      style={contentStyle}
    >
      <div>
        {mounted ? (
          <div
            data-df="accordion-content-body"
            className={cn(bodyClassName, className)}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
export type {
  AccordionProps,
  AccordionSingleProps,
  AccordionMultipleProps,
  AccordionItemProps,
  AccordionTriggerProps,
  AccordionContentProps,
  AccordionType,
  AccordionVariant,
  AccordionSize,
  AccordionRadius,
  AccordionContentPadding,
}
