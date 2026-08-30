"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import {
  useControllableState,
  useIsClient,
  useIsomorphicLayoutEffect,
} from "../hooks"
import { useFocusTrap } from "../lib/df-focus-trap"
import { useDfStrings } from "../lib/df-intl"
import { cn, composeEventHandlers } from "../lib/utils"
import { Button } from "./df-button"
import { ScrollArea } from "./df-scroll-area"

type DrawerSide = "right" | "bottom"
type DrawerSize = "sm" | "md" | "lg"

type DrawerContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  titleId: string
  descriptionId: string
  hasDescription: boolean
  setHasDescription: (value: boolean) => void
  side: DrawerSide
  size: DrawerSize
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

function useDrawerContext() {
  const ctx = React.useContext(DrawerContext)
  if (!ctx) throw new Error("Drawer components must be used within Drawer")
  return ctx
}

function Drawer({
  open,
  defaultOpen = false,
  onOpenChange,
  side = "right",
  size = "md",
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  side?: DrawerSide
  size?: DrawerSize
  children: React.ReactNode
}) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const titleId = React.useId()
  const descriptionId = React.useId()
  const [hasDescription, setHasDescription] = React.useState(false)

  return (
    <DrawerContext.Provider
      value={{
        open: isOpen,
        setOpen,
        triggerRef,
        titleId,
        descriptionId,
        hasDescription,
        setHasDescription,
        side,
        size,
      }}
    >
      {children}
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({
  children,
  render,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { open, setOpen, triggerRef } = useDrawerContext()

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
      setOpen(true)
    })(event as React.MouseEvent<HTMLButtonElement>)
  }

  if (render) {
    return React.cloneElement(render, {
      ...props,
      ref: triggerRef as React.Ref<HTMLButtonElement>,
      "data-df-drawer-trigger": "",
      "aria-expanded": open,
      "aria-haspopup": "dialog",
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
      data-df="drawer-trigger"
      {...props}
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      data-df-drawer-trigger=""
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(className)}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

function DrawerContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const {
    open,
    setOpen,
    triggerRef,
    titleId,
    descriptionId,
    hasDescription,
    side,
    size,
  } = useDrawerContext()
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const mounted = useIsClient()

  useFocusTrap({
    open,
    panelRef,
    triggerRef,
    onEscape: () => setOpen(false),
  })

  if (!mounted || !open) return null

  return createPortal(
    <div data-df="drawer-root" data-side={side}>
      <div
        data-df="drawer-scrim"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        data-df="drawer-content"
        data-side={side}
        data-size={size}
        tabIndex={-1}
        className={cn(className)}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

function DrawerHeader({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<"div"> & {
  showClose?: boolean
}) {
  const s = useDfStrings()
  return (
    <div data-df="drawer-header" className={cn(className)} {...props}>
      <div data-df="drawer-header-copy">{children}</div>
      {showClose ? (
        <DrawerClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={s.drawerClose}
            >
              <X className="size-4" />
            </Button>
          }
        />
      ) : null}
    </div>
  )
}

function DrawerTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDrawerContext()
  return (
    <h2
      id={titleId}
      data-df="drawer-title"
      className={cn(className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { descriptionId, setHasDescription } = useDrawerContext()

  useIsomorphicLayoutEffect(() => {
    setHasDescription(true)
    return () => setHasDescription(false)
  }, [setHasDescription])

  return (
    <p
      id={descriptionId}
      data-df="drawer-description"
      className={cn(className)}
      {...props}
    />
  )
}

function DrawerBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div data-df="drawer-body" className={cn(className)} {...props}>
      <ScrollArea visibility="hover">{children}</ScrollArea>
    </div>
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-df="drawer-footer" className={cn(className)} {...props} />
  )
}

function DrawerClose({
  children,
  render,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { setOpen } = useDrawerContext()

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
      "data-df-drawer-close": "",
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
      data-df="drawer-close"
      {...props}
      className={cn(className)}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
}
export type { DrawerSide, DrawerSize }
