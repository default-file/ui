"use client"

import * as React from "react"
import {
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareWarning,
  Minus,
  SquareCode,
  Strikethrough,
  Table,
  TableColumnsSplit,
  TableRowsSplit,
  Trash2,
  Quote,
} from "lucide-react"

import {
  dfFormatToolbarCalloutLabel,
  useDfStrings,
} from "../lib/df-intl"
import { isSafeHref } from "../lib/df-url"
import { cn } from "../lib/utils"
import { Button } from "./df-button"
import { Input } from "./df-input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./df-popover"
import { Separator } from "./df-separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./df-tooltip"

export const FORMAT_TOOLBAR_CALLOUT_TYPES = [
  "note",
  "tip",
  "important",
  "warning",
  "caution",
] as const

export type FormatToolbarCalloutType =
  (typeof FORMAT_TOOLBAR_CALLOUT_TYPES)[number]

export type FormatToolbarQuery =
  | "bold"
  | "italic"
  | "strike"
  | "inlineCode"
  | "link"
  | "heading"
  | "paragraph"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "callout"
  | "codeBlock"
  | "table"

export type FormatToolbarAttrs = {
  level?: 1 | 2 | 3
  type?: FormatToolbarCalloutType
}

/** Command surface for rich text formatting. Host owns document state. */
export type FormatToolbarController = {
  isActive: (
    query: FormatToolbarQuery,
    attrs?: FormatToolbarAttrs
  ) => boolean
  getLinkHref: () => string | null
  toggleHeading: (level: 1 | 2 | 3) => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleStrike: () => void
  toggleInlineCode: () => void
  setLink: (href: string) => void
  unsetLink: () => void
  toggleBulletList: () => void
  toggleOrderedList: () => void
  toggleTaskList: () => void
  toggleBlockquote: () => void
  setCallout: (type: FormatToolbarCalloutType) => void
  unsetCallout: () => void
  toggleCodeBlock: () => void
  insertHorizontalRule: () => void
  insertTable: () => void
  addTableRow: () => void
  addTableColumn: () => void
  deleteTableRow: () => void
  deleteTableColumn: () => void
  deleteTable: () => void
  subscribe: (listener: () => void) => () => void
}

export type FormatToolbarProps = {
  controller: FormatToolbarController | null
  disabled?: boolean
  locked?: boolean
  onLockedEditAttempt?: (clientX: number, clientY: number) => void
  className?: string
  isValidHref?: (href: string) => boolean
  calloutLabel?: (type: FormatToolbarCalloutType) => string
}

/**
 * Host-like input without a scheme, including an optional path, query, or hash.
 * Used to distinguish bare domains from ambiguous relative segments.
 */
const BARE_HOST =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#].*)?$/i

/**
 * Resolve a link field value to a storeable href.
 * Safety always requires isSafeHref. Format policy accepts absolute http,
 * https, and mailto URLs with a real target, rooted relatives that start with
 * /, #, or ?, and bare hosts which are promoted to https://.
 */
function resolveToolbarHref(
  raw: string,
  isValidHref: (href: string) => boolean = isSafeHref
): string | null {
  const value = raw.trim()
  if (!value) return null

  let candidate = value
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value)

  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase()
    if (scheme === "http" || scheme === "https") {
      try {
        const url = new URL(value)
        if (!url.hostname) return null
      } catch {
        return null
      }
    } else if (scheme === "mailto") {
      if (value.slice(schemeMatch[0].length).trim() === "") return null
    }
  } else if (/^[/#?]/.test(value)) {
    candidate = value
  } else if (BARE_HOST.test(value)) {
    candidate = `https://${value}`
  } else {
    return null
  }

  if (!isSafeHref(candidate)) return null
  if (!isValidHref(candidate)) return null
  return candidate
}

function ToolbarTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolbarButton({
  label,
  active,
  disabled,
  locked,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  locked?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <ToolbarTooltip label={label}>
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon-sm"
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        onClick={() => {
          if (locked) return
          onClick()
        }}
      >
        {children}
      </Button>
    </ToolbarTooltip>
  )
}

function ToolbarDivider() {
  return <Separator orientation="vertical" className="mx-0.5 h-5 bg-border" />
}

function FormatToolbar({
  controller,
  disabled,
  locked,
  onLockedEditAttempt,
  className,
  isValidHref = isSafeHref,
  calloutLabel: calloutLabelProp,
}: FormatToolbarProps) {
  const s = useDfStrings()
  const calloutLabel =
    calloutLabelProp ??
    ((type: FormatToolbarCalloutType) => dfFormatToolbarCalloutLabel(s, type))
  const [, setTick] = React.useState(0)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [linkHref, setLinkHref] = React.useState(
    () => s.formatToolbarLinkPlaceholder
  )
  const [calloutOpen, setCalloutOpen] = React.useState(false)

  React.useEffect(() => {
    if (!controller) return
    return controller.subscribe(() => setTick((n) => n + 1))
  }, [controller])

  if (!controller) {
    return (
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border",
          "bg-card px-2 py-1.5",
          className
        )}
      />
    )
  }

  const busy = Boolean(disabled)
  const editLocked = Boolean(locked) && !busy
  const inTable = controller.isActive("table")
  const blockDisabled = busy || inTable

  const applyLink = () => {
    if (editLocked) return
    const href = resolveToolbarHref(linkHref, isValidHref)
    if (href == null) return
    controller.setLink(href)
    setLinkOpen(false)
  }

  const removeLink = () => {
    if (editLocked) return
    controller.unsetLink()
    setLinkOpen(false)
  }

  const canApplyLink = resolveToolbarHref(linkHref, isValidHref) != null

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border",
        "bg-card px-2 py-1.5",
        className
      )}
      onPointerDownCapture={(event) => {
        const target = event.target
        if (!(target instanceof Element) || !target.closest("button")) return
        event.preventDefault()
        if (!editLocked) return
        onLockedEditAttempt?.(event.clientX, event.clientY)
      }}
    >
      <ToolbarButton
        label={s.formatToolbarHeading1}
        active={controller.isActive("heading", { level: 1 })}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleHeading(1)}
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarHeading2}
        active={controller.isActive("heading", { level: 2 })}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleHeading(2)}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarHeading3}
        active={controller.isActive("heading", { level: 3 })}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleHeading(3)}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label={s.formatToolbarBold}
        active={controller.isActive("bold")}
        disabled={busy}
        locked={editLocked}
        onClick={() => controller.toggleBold()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarItalic}
        active={controller.isActive("italic")}
        disabled={busy}
        locked={editLocked}
        onClick={() => controller.toggleItalic()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarStrikethrough}
        active={controller.isActive("strike")}
        disabled={busy}
        locked={editLocked}
        onClick={() => controller.toggleStrike()}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarInlineCode}
        active={controller.isActive("inlineCode")}
        disabled={busy}
        locked={editLocked}
        onClick={() => controller.toggleInlineCode()}
      >
        <Code className="size-4" />
      </ToolbarButton>

      <ToolbarTooltip label={s.formatToolbarLink}>
        <Popover
          open={editLocked ? false : linkOpen}
          onOpenChange={(open) => {
            if (editLocked) {
              setLinkOpen(false)
              return
            }
            setLinkOpen(open)
            if (!open) return
            const previous = controller.getLinkHref()
            setLinkHref(
              typeof previous === "string" && previous.length > 0
                ? previous
                : s.formatToolbarLinkPlaceholder
            )
          }}
        >
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant={controller.isActive("link") ? "secondary" : "ghost"}
                size="icon-sm"
                disabled={busy}
                aria-label={s.formatToolbarLink}
                aria-pressed={controller.isActive("link")}
              >
                <Link2 className="size-4" />
              </Button>
            }
          />
          <PopoverContent
            align="start"
            sideOffset={8}
            className="rounded-xl border border-border bg-card p-3 shadow-[var(--df-shadow-panel)]"
            style={{ width: "var(--df-popover-width-safe)" }}
          >
            <p className="mb-2 text-xs font-medium text-foreground">
              {s.formatToolbarLinkUrl}
            </p>
            <Input
              size="sm"
              value={linkHref}
              onChange={(event) => setLinkHref(event.target.value)}
              placeholder={s.formatToolbarLinkPlaceholder}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  applyLink()
                }
              }}
            />
            <div className="mt-2.5 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="min-w-0 flex-1"
                disabled={!controller.isActive("link")}
                onClick={removeLink}
              >
                {s.formatToolbarLinkRemove}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-w-0 flex-1"
                disabled={!canApplyLink}
                onClick={applyLink}
              >
                {s.formatToolbarLinkApply}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </ToolbarTooltip>

      <ToolbarDivider />

      <ToolbarButton
        label={s.formatToolbarBulletList}
        active={controller.isActive("bulletList")}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleBulletList()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarOrderedList}
        active={controller.isActive("orderedList")}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleOrderedList()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarTaskList}
        active={controller.isActive("taskList")}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleTaskList()}
      >
        <ListChecks className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label={s.formatToolbarBlockquote}
        active={controller.isActive("blockquote")}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleBlockquote()}
      >
        <Quote className="size-4" />
      </ToolbarButton>

      <ToolbarTooltip label={s.formatToolbarCallout}>
        <Popover
          open={editLocked || inTable ? false : calloutOpen}
          onOpenChange={(open) => {
            if (editLocked || inTable) {
              setCalloutOpen(false)
              return
            }
            setCalloutOpen(open)
          }}
        >
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant={controller.isActive("callout") ? "secondary" : "ghost"}
                size="icon-sm"
                disabled={blockDisabled}
                aria-label={s.formatToolbarCallout}
                aria-pressed={controller.isActive("callout")}
              >
                <MessageSquareWarning className="size-4" />
              </Button>
            }
          />
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-44 rounded-xl border border-border bg-card p-1.5 shadow-[var(--df-shadow-panel)]"
          >
            <Button
              type="button"
              variant={controller.isActive("callout") ? "ghost" : "secondary"}
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                if (editLocked) return
                controller.unsetCallout()
                setCalloutOpen(false)
              }}
            >
              {s.formatToolbarCalloutNone}
            </Button>
            {FORMAT_TOOLBAR_CALLOUT_TYPES.map((type) => (
              <Button
                key={type}
                type="button"
                variant={
                  controller.isActive("callout", { type })
                    ? "secondary"
                    : "ghost"
                }
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  if (editLocked) return
                  controller.setCallout(type)
                  setCalloutOpen(false)
                }}
              >
                {calloutLabel(type)}
              </Button>
            ))}
          </PopoverContent>
        </Popover>
      </ToolbarTooltip>

      <ToolbarButton
        label={s.formatToolbarCodeBlock}
        active={controller.isActive("codeBlock")}
        disabled={blockDisabled}
        locked={editLocked}
        onClick={() => controller.toggleCodeBlock()}
      >
        <SquareCode className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarHorizontalRule}
        disabled={busy}
        locked={editLocked}
        onClick={() => controller.insertHorizontalRule()}
      >
        <Minus className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label={s.formatToolbarInsertTable}
        disabled={busy}
        locked={editLocked}
        onClick={() => controller.insertTable()}
      >
        <Table className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarAddRow}
        disabled={busy || !inTable}
        locked={editLocked}
        onClick={() => controller.addTableRow()}
      >
        <BetweenHorizontalEnd className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarAddColumn}
        disabled={busy || !inTable}
        locked={editLocked}
        onClick={() => controller.addTableColumn()}
      >
        <BetweenVerticalEnd className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarDeleteRow}
        disabled={busy || !inTable}
        locked={editLocked}
        onClick={() => controller.deleteTableRow()}
      >
        <TableRowsSplit className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarDeleteColumn}
        disabled={busy || !inTable}
        locked={editLocked}
        onClick={() => controller.deleteTableColumn()}
      >
        <TableColumnsSplit className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={s.formatToolbarDeleteTable}
        disabled={busy || !inTable}
        locked={editLocked}
        onClick={() => controller.deleteTable()}
      >
        <Trash2 className="size-4" />
      </ToolbarButton>
    </div>
  )
}

export { FormatToolbar, resolveToolbarHref }
