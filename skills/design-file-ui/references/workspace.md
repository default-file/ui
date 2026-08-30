# Workspace and dashboard composition

Use this file when surface mode is `workspace` or `mobileTool`. Do not apply marketing hero budget rules here.

If mode is `marketing`, stop and open [composition.md](composition.md) instead.

## First question

What is the single primary task of this view (triage, monitor, configure, create, review)?

If you cannot answer in one short line, fix scope before styling.

For `problem` briefs, also answer the decision model before the shell map: what needs attention, why, what worsens if ignored, what action to take.

## Shell map template

Define regions before components:

1. **Navigation:** sidebar, top nav, tabs, or command palette entry points
2. **Context bar:** project switcher, breadcrumbs, date range, view switcher
3. **Primary canvas:** table, board, document, chart set, or thread
4. **Inspector (optional):** detail pane, properties, customer context
5. **Overlays:** modals, sheets, toasts, command palette

Rules:

- One focal canvas. Chrome stays quieter than the canvas.
- Brand is quiet (mark, product name in chrome), not a hero headline.
- Prefer inspector/drawer over a full route when triage speed matters.
- Do not place marketing heroes, logo walls, or promotional badge stickers in tool views.

## Visual authorship in tools

Name a concept (atmosphere + one signature move). Brand stays quiet; authorship is in materials, hierarchy, and data emphasis.

- Pass if the product has a recognizable visual idea beyond "dark panels and a cyan accent"
- Fail if the UI is only a generic enterprise dashboard template
- Signature options: type pairing, surface language, accent strategy, numeric emphasis, denser ink/terminal craft, editorial restraint
- Do not use a marketing hero to fake authorship inside an admin shell

## Type ladder

Keep at least five distinct steps:

1. Page title
2. Section title
3. Control or column label
4. Body or metadata
5. Numeric or data (monospace allowed)

Page title and support line must not share similar size and weight. Numbers that operators scan should outrank decorative labels.

## Density

- Ops and triage UIs may be dense. Use a tight, even rhythm.
- Do not fake luxury marketing whitespace in queues.
- Do not pack decoration into the gaps; air should separate groups of meaning.
- Align numbers and statuses for scan (especially money and counts).

### Adaptive density

If the primary collection or canvas leaves a large empty viewport (roughly more than half the useful canvas unused), choose one before finishing:

- Show more rows or raise page size
- Add a justified summary or status distribution
- Add a secondary useful panel tied to the task
- Use a deliberate empty state that teaches the next step

Do not leave a sparse table or node graph floating in void. Empty space must be intentional, not leftover.

## Scan path

Pick one primary scan model and commit:

- **List/table first:** title/key → status → meta
- **Board:** column headers → card titles → badges
- **Dashboard:** one monitoring question → supporting charts/tables
- **Three pane:** list → thread/canvas → inspector

Avoid equal weight widget wallpaper on home.

## Brand in tools

- Pass if product work is the loudest signal and brand chrome stays calm.
- Fail if a campaign headline or full bleed hero displaces the task.
- Dark themes need real contrast, not glow as a substitute.

## Dashboard home

Order the home view as:

1. **Monitoring question or next work** (one line the operator can answer)
2. **Triage entry** (queue, attention strip, failing jobs, or primary table)
3. **Supporting metrics and charts** (secondary; fewer, unequal weight)

Good homes:

- Show the next real work (queue, deploys, conversations) or one clear monitoring question
- Keep date/range and environment controls with the canvas
- Limit overview modules; each must earn a click through to a deeper view
- If metrics appear, rank them: one primary number may lead; the rest support

Bad homes:

- Three or four identical metric cards as fake sophistication
- Equal weight KPI wallpaper above an empty or delayed triage surface
- Charts without units, legends, or a question they answer
- Sample data presented as live data without a sample label

## Node workflows and execution paths

When the canvas is a graph or pipeline:

- States must read as a system: completed, active (running), waiting, failed
- Edges must be visible enough to show flow; active edges should be emphasized
- Prefer a readable execution path over loosely placed cards
- Minimap and zoom support orientation; they do not replace path clarity
- Open [motion.md](motion.md) for progress and live update recipes on the busy path

Fail graphs that look like disconnected cards with no clear computational path.

## Navigation completeness

When the shell lists multiple destinations:

- Every item in primary nav must open a real view, or a deliberate empty state that teaches the next step
- Do not ship dead stubs that only say "coming soon" with no action
- If scope is limited, cut the nav item rather than leaving a hollow destination
- Empty states may deep link to a working peer view (for example Tasks empty → open Workflows)

## Patterns to avoid (workspace)

- Purple gradient sidebars and glass panels as default identity
- Icon only unlabeled nav
- Nested cards inside cards
- Marketing section stories (hero → proof → offer) used as app IA
- Scroll jacking or cinematic delays before the tool is usable
- Generic dark SaaS card stacks with a single cyan accent as the only visual idea
