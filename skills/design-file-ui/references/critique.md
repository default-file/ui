# Critique rubric prompts

Score each axis `strong`, `weak`, or `missing`. Fix weak structure before polishing paint.

The required output shape lives in `SKILL.md` (Critique contract). Use this file for the per axis questions only. Choose the axis set that matches the classified surface mode.

Hold critiques to the **industry craft bar** in `SKILL.md`: senior product design judgment plus senior frontend craft. Score `strong` only when the axis would pass a demanding design review, not when it is merely average.

## Professional findings (required)

Write findings like a senior frontend product review. This is about clarity of critique, not locking usage to any product category. Each weak or missing axis needs:

1. **Observation**: concrete UI evidence
2. **Impact**: why it matters for this surface (match the classified mode and the user's actual goal)
3. **Recommendation**: the next structural change

Prefer clear impact language over taste language. Fail findings that only say the UI looks plain, trendy, or gallery ready without stating impact. Stay usage agnostic: critique the frontend the user asked for; do not force mobile, dashboard, or marketing framing when that is not the brief.

Do not let this rubric shrink invention. When structure is weak, recommend a different IA, layout metaphor, or visual system if that better serves the goal. Distinctive authorship remains required on design and redesign work. Accessibility, states, and responsive fitness count as craft failures when missing, not as late polish.

## Evidence rule (required)

For every axis scored `weak` or `missing`, name concrete evidence: a region, module, control, or pattern (for example "four equal KPI tiles above the agent table" or "Deploy has toast only, no busy state"). Vague scores without evidence fail the critique gate.

For design or redesign tasks: if any axis is `weak` or `missing`, complete an improve pass before finishing. Scores alone are not a finish.

## Marketing axes

### 1. Brand presence

- Is the brand the loudest signal in the first viewport that is not media?
- Is voice specific to this product or team?

### 2. Composition

- One scene or many competing modules?
- Does the eye know where to land first?

### 3. Hierarchy

- Clear primary line, secondary line, and supporting detail?
- Are headings real and sequential?

### 4. Visual anchor

- Is there a credible image, product view, or crafted atmosphere?
- Or only abstract fill?

### 5. Section rhythm

- Does each section earn its place?
- Any repeated section that should merge?

### 6. CTA clarity

- Is the next action obvious within a few seconds?
- Are secondary actions visually quieter?

### 7. Type

- Pairing intentional?
- Scale contrast adequate?
- Body readable?
- User-facing copy free of hyphens, em dashes, and en dashes?
- Is there a named authorship concept, or only a default template look?

### 8. Color

- Direction coherent?
- Contrast sufficient?
- Accent reserved for action and emphasis?
- Does color support a distinctive concept, or only a stock accent on generic panels?

### 9. Motion

- Does motion explain structure or feedback?
- Too many simultaneous effects?

### 10. Responsive

- Narrow screens keep brand and primary action?
- Tap targets usable?

### 11. States

- Hover, focus, loading, empty, error designed?
- Disabled states not mistaken for missing UI?

### 12. Accessibility basics

- Labels present?
- Focus visible?
- Text contrast acceptable?
- Content available without pointer only tricks?

## Workspace and mobileTool axes

### 1. Task clarity

- Is the primary task obvious in a few seconds?
- Does the view try to do several unrelated jobs at once?

### 2. Shell clarity

- Are nav, canvas, and optional inspector distinct?
- Is chrome quieter than the focal canvas?

### 3. Hierarchy / density

- Is information priority clear under real density?
- Any decorative chrome stealing scan attention?
- On dashboard homes: is there one monitoring question or triage entry before equal weight metric wallpaper?
- If the primary table or canvas is sparse, was adaptive fill applied (more rows, summary, secondary panel, or deliberate empty state)?

### 4. Data scan path

- Can users scan rows, cards, or charts in a predictable order?
- Are status and key meta secondary to the primary identifier?

### 5. Navigation findability

- Can users reach peer areas without guesswork?
- Are labels present (not icons alone)?
- Does every primary nav item open a real view or a deliberate empty state with a next action (no dead stubs)?

### 6. Primary action clarity

- Is the most important action obvious and reachable?
- Are destructive actions clearly separated?

### 7. Cards / collections discipline

- Are cards justified as interaction containers or browsable sets?
- Should this have been a table or list instead?

### 8. Type

- UI type readable at tool sizes?
- Scale steps intentional (page title, section, label, meta, numeric)?
- Labels and other visible strings free of hyphens, em dashes, and en dashes?

### 9. Color

- Direction coherent?
- Status color has text or legend support?
- Accent reserved for action and true emphasis?

### 10. Visual authorship

- Is there a named visual concept and signature move?
- Does the UI avoid the default dark panels + cyan accent + flat UI type template unless requested?
- Would removing the product name still leave a recognizable craft, or only a generic admin skin?

### 11. Motion (feedback)

- Does motion confirm state, drag, save, or load?
- Do primary async actions show a busy state on the control or busy region (not toast only)?
- For workflow graphs: is the execution path readable (completed → active → waiting → failed) with emphasized active edges?
- Any theater delaying use?

### 12. Responsive / mobileTool fitness

- Narrow layout redraws the shell instead of crushing it?
- Thumb reach and tap targets acceptable?

### 13. States + accessibility basics

- Empty, loading, error designed?
- Labels, focus, contrast, keyboard paths present?
