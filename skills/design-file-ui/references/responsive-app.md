# Responsive app and mobileTool UI

Use when surface mode is `mobileTool`, or when a `workspace` view must work at narrow widths. This is not the same as marketing responsive reflow.

## Core rule

Redraw regions for small screens. Do not only shrink desktop typography and hope the sidebar fits.

## Region strategies

| Desktop region | Narrow strategy |
|---|---|
| Left sidebar | Sheet, drawer, or dedicated nav route |
| Inspector / detail pane | Full screen route or bottom sheet |
| Three panes parallel | Sequence: list → canvas → inspector |
| Filter bar | Menu, sheet, or collapsed chips |
| Wide table | Horizontal scroll with sticky first column, or record cards for single item edit |
| Board columns | Swipeable columns or single column focus |

## Navigation

- Prefer labeled tabs or clear text destinations over icon only unlabeled bars.
- Bottom nav works for a small set of top level mobile tool sections.
- Keep one primary action reachable (sticky bar, bottom action, or obvious tab).

## Touch and keyboard

- Comfortable hit targets for primary controls (`--df-touch-target-min`, density control heights).
- Respect safe areas (`--df-safe-area-inset-*`, host `--df-overlay-inset-*`).
- Account for on-screen keyboard covering composers and sticky footers.
- Swipe actions need visible alternatives for accessibility.

## Kit responsive tokens

- Breakpoints: `--df-breakpoint-*`; utilities `sm:` to `3xl:`, `max-sm:` to `max-3xl:`, `@sm:` to `@3xl:`, `@container`.
- Density: host `data-df-density` (`cozy`, `comfortable`, or `compact`) sets `--df-control-height-*`. Use semantic `size` props.

## Density on mobile

- Keep list density when triage is the job; remove chrome before removing content.
- Increase air only when readability fails.
- Persistent global chrome (player, composer) should not remount as a hero on every route.

## Marketing vs mobileTool

- Marketing narrow: preserve brand, primary CTA, and section rhythm.
- mobileTool narrow: preserve task, primary action, and readable data.

## Patterns to avoid

- Desktop dual sidebars forced onto a phone
- Unlabeled icon tabs
- Tiny table cells as the only mobile plan
- Hiding the only primary action in an overflow menu without a strong reason
