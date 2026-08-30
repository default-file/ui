"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { useIsClient } from "../../hooks"
import { prefersReducedMotion } from "./motion"

export type DragOverlayState = {
  active: boolean
  activeId: string | null
  /** Ordered ids in the current drag payload. */
  ids: string[]
  count: number
  x: number
  y: number
}

export type DragOverlayRenderContext = {
  activeId: string
  ids: string[]
  count: number
  reducedMotion: boolean
}

export type DragOverlayProps = {
  state: DragOverlayState
  children: (context: DragOverlayRenderContext) => React.ReactNode
  /** Portal container. Defaults to document.body. */
  container?: Element | DocumentFragment | null
  className?: string
}

const INACTIVE_OVERLAY: DragOverlayState = {
  active: false,
  activeId: null,
  ids: [],
  count: 0,
  x: 0,
  y: 0,
}

/** Empty overlay state for hosts that have not started a drag. */
export function inactiveDragOverlayState(): DragOverlayState {
  return INACTIVE_OVERLAY
}

/**
 * Portal ghost that follows the pointer with translate3d.
 * Mount beside the sortable or board host when overlay mode is enabled.
 */
export function DragOverlay({
  state,
  children,
  container,
  className,
}: DragOverlayProps) {
  const mounted = useIsClient()

  if (!mounted || !state.active || state.activeId == null) return null

  const reducedMotion = prefersReducedMotion()
  const target = container ?? document.body
  const content = children({
    activeId: state.activeId,
    ids: state.ids,
    count: state.count,
    reducedMotion,
  })

  return createPortal(
    <div
      className={className ? `df-dnd-overlay ${className}` : "df-dnd-overlay"}
      data-df="dnd-overlay"
      data-count={state.count}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      style={{
        transform: `translate3d(${state.x}px, ${state.y}px, 0)`,
      }}
    >
      <div
        className="df-dnd-overlay-lift"
        data-lift={reducedMotion ? "false" : "true"}
      >
        {content}
      </div>
    </div>,
    target
  )
}
