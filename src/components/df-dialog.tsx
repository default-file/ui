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

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  titleId: string
  descriptionId: string
  hasDescription: boolean
  setHasDescription: (value: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error("Dialog components must be used within Dialog")
  return ctx
}

function Dialog({
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
  const titleId = React.useId()
  const descriptionId = React.useId()
  const [hasDescription, setHasDescription] = React.useState(false)

  return (
    <DialogContext.Provider
      value={{
        open: isOpen,
        setOpen,
        triggerRef,
        titleId,
        descriptionId,
        hasDescription,
        setHasDescription,
      }}
    >
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({
  children,
  render,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { open, setOpen, triggerRef } = useDialogContext()

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
      "data-df-dialog-trigger": "",
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
      data-df="dialog-trigger"
      {...props}
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      data-df-dialog-trigger=""
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(className)}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

type DialogPlacement = "center" | "left"

function DialogContent({
  className,
  children,
  placement = "center",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** Side sheet when left; centered modal otherwise. */
  placement?: DialogPlacement
}) {
  const {
    open,
    setOpen,
    triggerRef,
    titleId,
    descriptionId,
    hasDescription,
  } = useDialogContext()
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
    <div data-df="dialog-root" data-placement={placement}>
      <div
        data-df="dialog-scrim"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        data-df="dialog-content"
        data-placement={placement}
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

function DialogHeader({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<"div"> & {
  showClose?: boolean
}) {
  const s = useDfStrings()
  return (
    <div data-df="dialog-header" className={cn(className)} {...props}>
      <div data-df="dialog-header-copy">{children}</div>
      {showClose ? (
        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={s.dialogClose}
            >
              <X className="size-4" />
            </Button>
          }
        />
      ) : null}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDialogContext()
  return (
    <h2
      id={titleId}
      data-df="dialog-title"
      className={cn(className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { descriptionId, setHasDescription } = useDialogContext()

  useIsomorphicLayoutEffect(() => {
    setHasDescription(true)
    return () => setHasDescription(false)
  }, [setHasDescription])

  return (
    <p
      id={descriptionId}
      data-df="dialog-description"
      className={cn(className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-df="dialog-body" className={cn(className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-df="dialog-footer" className={cn(className)} {...props} />
  )
}

function DialogClose({
  children,
  render,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement
}) {
  const { setOpen } = useDialogContext()

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
      "data-df-dialog-close": "",
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
      data-df="dialog-close"
      {...props}
      className={cn(className)}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
