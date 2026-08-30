# App patterns: forms, tables, filters, navigation

Use for `workspace` and `mobileTool` surfaces that include data, settings, or tool navigation.

## Navigation IA

Common shells:

- **Sidebar + canvas** for multi section products
- **Tabs + canvas** for peer views of one object
- **Switcher + project nav + list** for multi project SaaS
- **List + detail** or **list + pane** for triage
- **List + canvas + inspector** for support, mail, chat
- **Command palette** as power user jump; keep visible nav for discovery

Rules:

- Labels beat icon only navigation.
- Saved views and filters are navigation, not buried settings only.
- Do not invent a second IA that fights the product's existing nav.
- Every primary nav destination must be a real view or a deliberate empty state with a next action. Cut the item if you cannot ship either.

## Tables and lists

- Prefer real tabular structure for records with many fields.
- Sticky headers when scrolling long lists.
- Selection checkboxes enable bulk actions; show bulk bar after selection.
- Align numeric columns.
- Row click vs action buttons: make the primary open behavior obvious.
- Adaptive density: if the table leaves most of the canvas empty, raise page size, add a summary or status distribution, or pair with a justified secondary panel. Do not leave a short table stranded in void.

## Filters and search

- Place filter controls with the canvas (toolbar or filter bar).
- Offer a simple default; advanced query is progressive disclosure.
- Show result counts when useful.
- Empty filtered states explain how to clear filters.
- Global search jumps to objects when the product is object centric.

## Forms and settings

- Settings: quiet nav + one form canvas.
- Group fields by task; separate danger zones.
- Labels visible; errors adjacent to fields.
- Sticky save on long forms; explicit success feedback.
- Wizards for multi step create; summary before commit when cost or irreversible.

## Empty, loading, error

- Empty: teach the next step (create, connect, clear filters, or open a working peer view).
- Loading: skeletons or progress on the region that is loading; primary actions that wait on work show an in-control busy state.
- Error: name what failed and what to do next.
- Never present unlabeled fake sample data as live data.
- Never leave a nav target as a hollow stub without an empty state and next step.

## Bulk and destructive actions

- Bulk actions appear after selection.
- Destructive actions require confirmation and distinct styling.
- Undo toasts when the product supports undo.

## Kit mapping

When Default File UI is present, open [kit.md](kit.md) and discover inputs, selects, dialogs, menus, tables, and related registry items before inventing chrome.
