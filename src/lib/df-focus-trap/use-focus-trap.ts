import { useEffect, useRef, type RefObject } from "react"

import {
  FOCUSABLE_SELECTOR,
  lockBodyScroll,
  resolveFocusRestoreTarget,
  resolveFocusTrapKey,
  resolveInitialFocus,
  unlockBodyScroll,
} from "./trap"

type UseFocusTrapOptions = {
  open: boolean
  panelRef: RefObject<HTMLElement | null>
  triggerRef: RefObject<HTMLElement | null>
  onEscape: () => void
}

/**
 * Modal focus lifecycle: capture prior focus, lock scroll, move focus into
 * the panel, trap Tab, close on Escape, and restore focus on close.
 */
export function useFocusTrap({
  open,
  panelRef,
  triggerRef,
  onEscape,
}: UseFocusTrapOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  const onEscapeRef = useRef(onEscape)

  useEffect(() => {
    onEscapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false
        const restore = resolveFocusRestoreTarget(
          triggerRef.current,
          previousFocusRef.current
        )
        previousFocusRef.current = null
        restore?.focus?.()
      }
      return
    }

    wasOpenRef.current = true
    const active = document.activeElement
    previousFocusRef.current =
      active instanceof HTMLElement ? active : null

    const previousOverflow = lockBodyScroll(document.body)
    const panel = panelRef.current
    const focusables = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : []
    const initial = resolveInitialFocus(focusables, panel)
    initial?.focus?.()

    return () => {
      unlockBodyScroll(document.body, previousOverflow)
    }
  }, [open, panelRef, triggerRef])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current
      const focusables = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : []
      const decision = resolveFocusTrapKey({
        key: event.key,
        shiftKey: event.shiftKey,
        focusableCount: focusables.length,
        activeIsFirst: document.activeElement === focusables[0],
        activeIsLast:
          document.activeElement === focusables[focusables.length - 1],
      })

      if (decision.action === "none") return
      if (decision.preventDefault) event.preventDefault()

      if (decision.action === "close") {
        onEscapeRef.current()
        return
      }
      if (decision.action === "focus-panel") {
        panel?.focus()
        return
      }
      if (decision.action === "focus-last") {
        focusables[focusables.length - 1]?.focus()
        return
      }
      if (decision.action === "focus-first") {
        focusables[0]?.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, panelRef])
}
