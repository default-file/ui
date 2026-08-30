"use client"

import * as React from "react"

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./df-popover"
import { ScrollArea } from "./df-scroll-area"
import { cn } from "../lib/utils"

type OptionsPanelContentProps = React.ComponentProps<typeof PopoverContent>

const OPTIONS_PANEL_CONTENT_CLASS =
  "w-fit gap-0 overflow-hidden rounded-2xl bg-popover p-0 text-popover-foreground shadow-xl"

function OptionsPanel(props: React.ComponentProps<typeof Popover>) {
  return <Popover {...props} />
}

function OptionsPanelTrigger(
  props: React.ComponentProps<typeof PopoverTrigger>
) {
  return <PopoverTrigger data-df="options-panel-trigger" {...props} />
}

function OptionsPanelContent({
  className,
  align = "end",
  side = "bottom",
  sideOffset = 8,
  matchTriggerWidth = false,
  portal = true,
  ...props
}: OptionsPanelContentProps) {
  return (
    <PopoverContent
      data-df="options-panel-content"
      align={align}
      side={side}
      sideOffset={sideOffset}
      matchTriggerWidth={matchTriggerWidth}
      portal={portal}
      className={cn(OPTIONS_PANEL_CONTENT_CLASS, className)}
      {...props}
    />
  )
}

function OptionsPanelHeader({
  className,
  ...props
}: React.ComponentProps<typeof PopoverHeader>) {
  return (
    <PopoverHeader
      data-df="options-panel-header"
      className={cn("gap-0 border-b border-border px-4 py-3", className)}
      {...props}
    />
  )
}

function OptionsPanelTitle({
  className,
  ...props
}: React.ComponentProps<typeof PopoverTitle>) {
  return (
    <PopoverTitle
      data-df="options-panel-title"
      className={cn("text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

type OptionsPanelBodyProps = React.ComponentProps<"div"> & {
  /**
   * Size the body to its content with no max-height scroll clamp.
   * Default keeps the portaled height cap and vertical kit scroll.
   */
  fit?: boolean
}

function OptionsPanelBody({
  className,
  fit = false,
  children,
  ...props
}: OptionsPanelBodyProps) {
  return (
    <div
      data-df="options-panel-body"
      data-fit={fit ? "true" : undefined}
      className="df-options-panel-body"
    >
      <ScrollArea className="df-options-panel-scroll" orientation="vertical">
        <div
          data-df="options-panel-body-inner"
          className={cn("df-options-panel-body-inner", className)}
          {...props}
        >
          {children}
        </div>
      </ScrollArea>
    </div>
  )
}

type OptionsPanelFooterProps = React.ComponentProps<"div"> & {
  gap?: string
  gapX?: string
  gapY?: string
}

function OptionsPanelFooter({
  className,
  style,
  gap,
  gapX,
  gapY,
  ...props
}: OptionsPanelFooterProps) {
  const resolvedGapX = gapX ?? gap
  const resolvedGapY = gapY ?? gap

  return (
    <div
      data-df="options-panel-footer"
      className={cn(
        "flex flex-col border-t border-border px-4 py-3",
        className
      )}
      style={
        {
          ...(resolvedGapX != null
            ? { "--df-options-panel-footer-gap-x": resolvedGapX }
            : null),
          ...(resolvedGapY != null
            ? { "--df-options-panel-footer-gap-y": resolvedGapY }
            : null),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

function OptionsPanelFooterActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-df="options-panel-footer-actions"
      className={className}
      {...props}
    />
  )
}

function OptionsPanelFooterMeta({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-df="options-panel-footer-meta"
      className={className}
      {...props}
    />
  )
}

export {
  OptionsPanel,
  OptionsPanelBody,
  OptionsPanelContent,
  OptionsPanelFooter,
  OptionsPanelFooterActions,
  OptionsPanelFooterMeta,
  OptionsPanelHeader,
  OptionsPanelTitle,
  OptionsPanelTrigger,
}
export type {
  OptionsPanelBodyProps,
  OptionsPanelContentProps,
  OptionsPanelFooterProps,
}
