"use client"

import * as React from "react"

import {
  mergeCommands,
  rankByQuery,
  rankRecentFirst,
  type MatchRange,
  type RankedCommand,
} from "../lib/df-command"
import { useControllableState } from "../hooks"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"
import { Dialog, DialogContent } from "./df-dialog"
import { hasKbdShortcut, Kbd } from "./df-kbd"
import { SearchInput } from "./df-search-input"
import { Spinner } from "./df-spinner"

const ASYNC_DEBOUNCE_MS = 160
const PAGE_STEP = 8

export type CommandItem = {
  id: string
  label: string
  section?: string
  keywords?: string[]
  /**
   * Ranking band for query results. Lower tiers sort before higher tiers;
   * fuzzy score breaks ties within the same tier. Defaults to 0.
   */
  rankTier?: number
  glyph?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  run: () => void
}

export type CommandSource = (query: string) => Promise<CommandItem[]>

export type CommandPaletteProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  commands: CommandItem[]
  source?: CommandSource
  recentIds?: string[]
  onRun?: (command: CommandItem) => void
  placeholder?: string
  background?: string
  emptyContent?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

function highlightLabel(label: string, ranges: MatchRange[]): React.ReactNode {
  if (ranges.length === 0) return label
  const nodes: React.ReactNode[] = []
  let cursor = 0
  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      nodes.push(label.slice(cursor, range.start))
    }
    nodes.push(
      <mark key={`m-${index}`} data-df="command-palette-mark">
        {label.slice(range.start, range.end)}
      </mark>
    )
    cursor = range.end
  })
  if (cursor < label.length) nodes.push(label.slice(cursor))
  return nodes
}

function groupRanked(
  ranked: RankedCommand<CommandItem>[],
  defaultSection: string
): Array<{ section: string; items: RankedCommand<CommandItem>[] }> {
  const groups: Array<{ section: string; items: RankedCommand<CommandItem>[] }> =
    []
  const indexBySection = new Map<string, number>()

  for (const entry of ranked) {
    const section = entry.command.section?.trim() || defaultSection
    const existing = indexBySection.get(section)
    if (existing == null) {
      indexBySection.set(section, groups.length)
      groups.push({ section, items: [entry] })
      continue
    }
    groups[existing]!.items.push(entry)
  }

  return groups
}

function CommandPalette({
  open,
  defaultOpen = false,
  onOpenChange,
  commands,
  source,
  recentIds = [],
  onRun,
  placeholder: placeholderProp,
  background,
  emptyContent,
  footer,
  className,
}: CommandPaletteProps) {
  const s = useDfStrings()
  const placeholder = placeholderProp ?? s.commandPalettePlaceholder
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const [query, setQuery] = React.useState("")
  const [asyncCommands, setAsyncCommands] = React.useState<CommandItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [activeQueryKey, setActiveQueryKey] = React.useState("")
  const listId = React.useId()
  const requestIdRef = React.useRef(0)

  const resetSession = React.useCallback(() => {
    setQuery("")
    setAsyncCommands([])
    setLoading(false)
    setActiveId(null)
    setActiveQueryKey("")
  }, [])

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) resetSession()
    },
    [resetSession, setOpen]
  )

  const merged = React.useMemo(
    () => mergeCommands(commands, asyncCommands),
    [asyncCommands, commands]
  )

  const ranked = React.useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return rankRecentFirst(merged, recentIds)
    return rankByQuery(merged, trimmed)
  }, [merged, query, recentIds])

  const groups = React.useMemo(
    () => groupRanked(ranked, s.commandPaletteCommands),
    [ranked, s.commandPaletteCommands]
  )
  const flatIds = React.useMemo(
    () =>
      ranked
        .filter((entry) => !entry.command.disabled)
        .map((entry) => entry.command.id),
    [ranked]
  )

  const queryKey = `${isOpen}:${query}`
  if (isOpen && queryKey !== activeQueryKey) {
    setActiveQueryKey(queryKey)
    const nextActive =
      activeId != null && flatIds.includes(activeId)
        ? activeId
        : (flatIds[0] ?? null)
    if (nextActive !== activeId) setActiveId(nextActive)
  }

  React.useEffect(() => {
    if (!isOpen || !source) return

    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(() => {
      setLoading(true)
      void source(query)
        .then((next) => {
          if (requestIdRef.current !== requestId) return
          setAsyncCommands(next)
          setLoading(false)
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return
          setAsyncCommands([])
          setLoading(false)
        })
    }, ASYNC_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isOpen, query, source])

  const optionDomId = React.useCallback(
    (id: string) =>
      `${listId}-opt-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [listId]
  )

  const moveActive = React.useCallback(
    (delta: number) => {
      if (flatIds.length === 0) return
      const current = activeId == null ? -1 : flatIds.indexOf(activeId)
      const base = current === -1 ? (delta > 0 ? -1 : 0) : current
      const next =
        flatIds[(base + delta + flatIds.length * 10) % flatIds.length] ?? null
      setActiveId(next)
      if (next != null) {
        document
          .getElementById(optionDomId(next))
          ?.scrollIntoView({ block: "nearest" })
      }
    },
    [activeId, flatIds, optionDomId]
  )

  const runActive = React.useCallback(() => {
    if (activeId == null) return
    const entry = ranked.find((item) => item.command.id === activeId)
    if (!entry || entry.command.disabled) return
    handleOpenChange(false)
    onRun?.(entry.command)
    entry.command.run()
  }, [activeId, handleOpenChange, onRun, ranked])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      moveActive(1)
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      moveActive(-1)
      return
    }
    if (event.key === "PageDown") {
      event.preventDefault()
      moveActive(PAGE_STEP)
      return
    }
    if (event.key === "PageUp") {
      event.preventDefault()
      moveActive(-PAGE_STEP)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      runActive()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(className)}
        aria-label={s.commandPaletteAriaLabel}
      >
        <div data-df="command-palette">
          <div data-df="command-palette-search">
            <SearchInput
              size="md"
              clearable
              placeholder={placeholder}
              background={background}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeId != null ? optionDomId(activeId) : undefined
              }
            />
          </div>

          <div data-df="command-palette-body">
            {loading ? (
              <div data-df="command-palette-loading" role="status">
                <Spinner size="sm" aria-hidden />
                <span>{s.commandPaletteSearching}</span>
              </div>
            ) : null}

            {!loading && ranked.length === 0 ? (
              <div data-df="command-palette-empty" role="status">
                {emptyContent ?? s.commandPaletteEmpty}
              </div>
            ) : null}

            {ranked.length > 0 ? (
              <div
                id={listId}
                role="listbox"
                data-df="command-palette-list"
                aria-label={s.commandPaletteCommands}
              >
                {groups.map((group) => (
                  <div
                    key={group.section}
                    data-df="command-palette-section"
                    role="group"
                    aria-label={group.section}
                  >
                    <div data-df="command-palette-section-label">
                      {group.section}
                    </div>
                    {group.items.map((entry) => {
                      const active = entry.command.id === activeId
                      return (
                        <div
                          key={entry.command.id}
                          id={optionDomId(entry.command.id)}
                          role="option"
                          aria-selected={active}
                          aria-disabled={entry.command.disabled || undefined}
                          data-df="command-palette-item"
                          data-active={active ? "" : undefined}
                          data-disabled={
                            entry.command.disabled ? "" : undefined
                          }
                          onMouseEnter={() => {
                            if (!entry.command.disabled) {
                              setActiveId(entry.command.id)
                            }
                          }}
                          onClick={() => {
                            if (entry.command.disabled) return
                            handleOpenChange(false)
                            onRun?.(entry.command)
                            entry.command.run()
                          }}
                        >
                          {entry.command.glyph != null ? (
                            <span data-df="command-palette-glyph" aria-hidden>
                              {entry.command.glyph}
                            </span>
                          ) : null}
                          <span data-df="command-palette-label">
                            {highlightLabel(
                              entry.command.label,
                              entry.ranges
                            )}
                          </span>
                          {hasKbdShortcut(entry.command.shortcut) ? (
                            <span data-df="command-palette-shortcut">
                              <Kbd size="sm">{entry.command.shortcut}</Kbd>
                            </span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div data-df="command-palette-footer">
            {footer ?? (
              <>
                <span>
                  <Kbd size="sm">↑</Kbd>
                  <Kbd size="sm">↓</Kbd> {s.commandPaletteNavigate}
                </span>
                <span>
                  <Kbd size="sm">↵</Kbd> {s.commandPaletteRun}
                </span>
                <span>
                  <Kbd size="sm">Esc</Kbd> {s.commandPaletteClose}
                </span>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { CommandPalette }
