# Design File UI skill

Portable Agent Skill for designing, implementing, and critiquing frontend UI at a senior industry craft level. Usage agnostic: follow the user's request; do not lock to mobile, dashboard, admin, or marketing. Keep design thinking free: invent distinctive structure and craft; contracts must not flatten UI into safe templates. Tool agnostic and stack agnostic. When Default File UI is present in a project, prefer kit discovery before inventing chrome.

**Canonical source for publish:** this folder (`skills/design-file-ui/` inside `@default-file/ui`).

## UI copy rule

When the skill builds frontend UI, ordinary English user-facing strings must not contain hyphens, em dashes, or en dashes. Keyboard chords, technical IDs, and code are excepted. See **UI copy constraints** in `SKILL.md`.

## Install (any Agent Skills compatible tool)

```bash
# Open skills ecosystem
npx skills add default-file/ui --skill design-file-ui

# Kit CLI
df-ui skills install design-file-ui
```

Install targets depend on the consumer tool (for example `.agents/skills/`). Do not treat any one editor path as required.

### After editing the skill (required)

The canonical files live in this kit folder. Consumer installs (for example `.agents/skills/design-file-ui/`) can go stale.

After you change `SKILL.md` or any `references/*` file:

1. Reinstall or copy from this folder into the consumer skill path
2. Confirm the install includes `references/workspace.md`, `cards.md`, `app-patterns.md`, `responsive-app.md`, and `kit.md`
3. Fail routing checks if mode classification, brief class, or those refs are missing

Local kit development: prefer reading this folder directly, or reinstall before relying on attach.

## Surface modes and brief class

Modes are internal routing for composition rules, not a fixed list of allowed products. Classify from the user's brief, then build what they asked for.

The skill must classify mode and brief class before preflight:

| Mode | Example ask |
|---|---|
| `marketing` | Redesign this landing page / brand campaign pitch |
| `workspace` | Design a SaaS billing admin / analytics dashboard |
| `mobileTool` | Build a mobile web triage app |

| Brief | Example ask |
|---|---|
| `spec` | Build these screens: overview, agents table, workflows… |
| `problem` | Design a command center for operators who must catch delivery exceptions before customers complain |

For `problem` briefs, require a decision model (attention, why, if ignored, action) and invented IA. Fail generic dashboard templates with no triage logic.

## Manual invoke examples

- `/design-file-ui`
- "Redesign this landing page using the Design File UI skill"
- "Critique this UI for brand hierarchy and CTA clarity"
- "Design a SaaS admin for managing invoices"
- "Critique this dashboard for task clarity and density"
- "Build a mobile web triage app for support triage"
- "Design a command center for an autonomous delivery fleet; invent the IA yourself"

## Routing validation matrix

Use these prompts in a fresh agent turn after install. Pass only if the skill attaches, mode and brief class are correct, required refs load, and the output meets the gate.

| Prompt type | Example | Pass if |
|---|---|---|
| Marketing critique | Critique this UI for brand hierarchy and CTA clarity | Mode marketing; marketing scores + evidence on weak axes + top 3 structural + sequence + non goals |
| Marketing redesign | Redesign this landing page using the Design File UI skill | Mode marketing; authorship concept + preflight + section map + critique + improve pass if any weak axis |
| Workspace design (spec) | Design a SaaS billing admin with invoice table and filters | Mode workspace; Brief spec; shell map + workspace preflight + workspace critique axes + improve pass if needed |
| Workspace design (problem) | Design a command center for 2500 delivery vehicles across 14 cities; invent IA; prioritize what needs attention and why | Mode workspace; Brief problem; decision model; invented IA (not a copied component list); authorship concept; critique with evidence |
| Mobile tool | Build a mobile web triage app for support tickets | Mode mobileTool; region plan + responsive app rules |
| Ambiguous polish | Make this page look better | Mode and brief classified from context; finish gate blocks paint only freeform |
| Stale install check | Any workspace prompt | Install has workspace.md, mode line, and brief line; fail if marketing-only preflight is used for admin |

## Adherence notes

- Critique and redesign must load `references/critique.md` before findings.
- Hold the industry craft bar: goal first, structure before paint, authorship, states, accessibility, responsive redesign, evidence based critique.
- Findings use a clear professional voice: observation, impact, recommendation. This improves review quality only.
- Keep the skill frontend first and usage agnostic. Do not force mobile, dashboard, or marketing when that is not the ask.
- Keep design invention intact: distinctive authorship, alternate IA/layout when useful, no bland template default.
- Weak or missing axes need concrete evidence; design tasks need an improve pass when scores are not all strong.
- The critique output contract is inlined in `SKILL.md` so the format cannot be skipped.
- Composition reference is marketing only; workspace work must load `workspace.md`.
- Cards, app patterns, and responsive app references are mandatory for those tasks.
- Workspace motion recipes live in `motion.md`; toast-only feedback on async actions is not enough.
- Workflow graphs need a readable execution path, not disconnected cards.
- Visual authorship and adaptive density are finish gates for tool UI.
- When Default File UI is present, open `references/kit.md` and discover components/tokens before inventing chrome.
