# Cards as interaction containers

Use when building or critiquing collections, boards, selection grids, or when deciding table vs card. Applies mainly in `workspace` and `mobileTool` modes. In `marketing` mode, keep the default: no cards in the hero; cards only for real interaction or browsable sets.

## When cards are correct

- Items are movable or selectable units (board issues, plans, files with previews)
- Preview media carries recognition (thumbnails, album art)
- Count stays scannable as a grid
- Opening an item is the primary gesture

## When tables or rows win

- Triage queues, money, infra records, mail, deployments, DNS, issues at scale
- Many columns, sorting, or bulk selection matter
- Chronology is the main structure

## Card anatomy

Keep the face thin:

1. Title (required)
2. Optional preview
3. Status / meta (quiet)
4. Optional assignees or key attributes
5. Open or primary affordance

Put the rest in a detail pane or route. Do not nest cards inside cards.

## Chrome discipline

- If removing border, shadow, background, or radius does not hurt selection or scanning, remove it.
- Prefer light separators and shared grid rhythm over multi layer shadows.
- Status needs text (or text + color), not color alone.
- Selection and hover states must be obvious for keyboard and pointer.

## Board specific

- Card face shows only triage signals.
- Columns scroll independently when needed.
- Empty columns remain honest drop targets.

## Marketing vs workspace

| Context | Rule |
|---|---|
| Marketing hero | No cards |
| Marketing browsable set | Cards OK for work/products with clear browse job |
| Workspace collection | Cards OK when justified above |
| Workspace queue | Prefer rows/tables |

## Patterns to avoid

- Card grid as a substitute for hierarchy on a dashboard home
- Six identical metric cards with gradients
- Glass stacks and nested containment
- Using portfolio card grids as an admin template
