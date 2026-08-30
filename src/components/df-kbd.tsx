"use client"

import * as React from "react"

import { type DfStrings, useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"

type KbdSize = "sm" | "md"

type KbdProps = React.ComponentProps<"kbd"> & {
  size?: KbdSize
}

type KbdAbbrProps = React.ComponentProps<"abbr"> & {
  title: string
}

type KbdContentProps = React.ComponentProps<"span"> & {
  kind?: "key" | "punct"
}

type KbdGlyphKind = "mod" | "special" | "punct" | "key"

type KbdTitleKey =
  | "kbdCommand"
  | "kbdShift"
  | "kbdOption"
  | "kbdControl"
  | "kbdEscape"
  | "kbdDelete"
  | "kbdForwardDelete"
  | "kbdReturn"
  | "kbdTab"
  | "kbdCapsLock"
  | "kbdSpace"
  | "kbdUpArrow"
  | "kbdDownArrow"
  | "kbdLeftArrow"
  | "kbdRightArrow"
  | "kbdPageUp"
  | "kbdPageDown"
  | "kbdHome"
  | "kbdEnd"

type KbdGlyphMeta = {
  kind: KbdGlyphKind
  titleKey?: KbdTitleKey
}

function hasKbdShortcut(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

const KBD_GLYPH_META: Record<string, KbdGlyphMeta> = {
  "⌘": { kind: "mod", titleKey: "kbdCommand" },
  "⇧": { kind: "mod", titleKey: "kbdShift" },
  "⌥": { kind: "mod", titleKey: "kbdOption" },
  "⌃": { kind: "mod", titleKey: "kbdControl" },
  "⎋": { kind: "special", titleKey: "kbdEscape" },
  "⌫": { kind: "special", titleKey: "kbdDelete" },
  "⌦": { kind: "special", titleKey: "kbdForwardDelete" },
  "↵": { kind: "special", titleKey: "kbdReturn" },
  "⇥": { kind: "special", titleKey: "kbdTab" },
  "⇪": { kind: "special", titleKey: "kbdCapsLock" },
  "␣": { kind: "special", titleKey: "kbdSpace" },
  "↑": { kind: "special", titleKey: "kbdUpArrow" },
  "↓": { kind: "special", titleKey: "kbdDownArrow" },
  "←": { kind: "special", titleKey: "kbdLeftArrow" },
  "→": { kind: "special", titleKey: "kbdRightArrow" },
  "⇞": { kind: "special", titleKey: "kbdPageUp" },
  "⇟": { kind: "special", titleKey: "kbdPageDown" },
  "↖": { kind: "special", titleKey: "kbdHome" },
  "↘": { kind: "special", titleKey: "kbdEnd" },
  ",": { kind: "punct" },
  ".": { kind: "punct" },
  ";": { kind: "punct" },
  ":": { kind: "punct" },
  "'": { kind: "punct" },
  '"': { kind: "punct" },
  "!": { kind: "punct" },
  "?": { kind: "punct" },
}

function splitKbdGlyphs(label: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    })
    return Array.from(segmenter.segment(label), (part) => part.segment)
  }
  return Array.from(label)
}

function glyphMeta(glyph: string): KbdGlyphMeta {
  return KBD_GLYPH_META[glyph] ?? { kind: "key" }
}

function glyphTitle(glyph: string, strings: DfStrings): string | undefined {
  const meta = glyphMeta(glyph)
  if (meta.titleKey != null) return strings[meta.titleKey]
  if (glyph === " ") return strings.kbdSpace
  return undefined
}

function chordAccessibleName(glyphs: string[], strings: DfStrings): string {
  return glyphs
    .map((glyph) => glyphTitle(glyph, strings) ?? glyph)
    .join(" ")
}

const KbdAbbr = React.forwardRef<HTMLElement, KbdAbbrProps>(function KbdAbbr(
  { className, title, children, ...props },
  ref
) {
  return (
    <abbr
      ref={ref as React.Ref<HTMLElement>}
      data-df="kbd-abbr"
      title={title}
      className={cn(className)}
      {...props}
    >
      {children}
    </abbr>
  )
})

const KbdContent = React.forwardRef<HTMLSpanElement, KbdContentProps>(
  function KbdContent({ className, kind = "key", children, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-df="kbd-content"
        data-kind={kind}
        className={cn(className)}
        {...props}
      >
        {children}
      </span>
    )
  }
)

function renderKbdGlyph(
  glyph: string,
  index: number,
  presentational: boolean,
  strings: DfStrings
): React.ReactNode {
  const meta = glyphMeta(glyph)
  const atProps = presentational ? ({ "aria-hidden": true } as const) : undefined
  const title = glyphTitle(glyph, strings)

  if (meta.kind === "mod" || meta.kind === "special") {
    return (
      <KbdAbbr
        key={`${index}-${glyph}`}
        title={title ?? glyph}
        data-kind={meta.kind}
        {...atProps}
      >
        {glyph}
      </KbdAbbr>
    )
  }

  return (
    <KbdContent
      key={`${index}-${glyph}`}
      kind={meta.kind === "punct" ? "punct" : "key"}
      {...atProps}
    >
      {glyph}
    </KbdContent>
  )
}

function renderKbdChord(parts: React.ReactNode[]): React.ReactNode {
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return <span data-df="kbd-chord">{parts}</span>
}

function renderKbdString(
  label: string,
  presentational: boolean,
  strings: DfStrings
): React.ReactNode {
  const glyphs = splitKbdGlyphs(label)
  return renderKbdChord(
    glyphs.map((glyph, index) =>
      renderKbdGlyph(glyph, index, presentational, strings)
    )
  )
}

function renderKbdChildren(children: React.ReactNode): React.ReactNode {
  return renderKbdChord(React.Children.toArray(children))
}

const Kbd = React.forwardRef<HTMLElement, KbdProps>(function Kbd(
  { className, size = "sm", children, ...props },
  ref
) {
  const s = useDfStrings()
  const { "aria-label": ariaLabelProp, ...rest } = props
  const stringLabel = typeof children === "string" ? children : null
  const glyphs = stringLabel != null ? splitKbdGlyphs(stringLabel) : null
  const derivedLabel =
    glyphs != null && glyphs.length > 0
      ? chordAccessibleName(glyphs, s)
      : undefined
  const ariaLabel =
    ariaLabelProp !== undefined ? ariaLabelProp : derivedLabel
  const presentational =
    stringLabel != null &&
    typeof ariaLabel === "string" &&
    ariaLabel.length > 0

  return (
    <kbd
      ref={ref as React.Ref<HTMLElement>}
      data-df="kbd"
      data-size={size}
      className={cn(className)}
      aria-label={ariaLabel || undefined}
      {...rest}
    >
      {stringLabel != null
        ? renderKbdString(stringLabel, presentational, s)
        : renderKbdChildren(children)}
    </kbd>
  )
})

export { Kbd, KbdAbbr, KbdContent, hasKbdShortcut }
export type { KbdProps, KbdSize, KbdAbbrProps, KbdContentProps }
