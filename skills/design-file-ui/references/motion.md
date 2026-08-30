# Motion guidance

## Default motion budget

Ship 2 to 3 intentional motions for visually led marketing work:

1. **Presence:** hero content enters once with shared easing
2. **Scroll continuity:** sections reveal or parallax lightly while scrolling
3. **Feedback:** buttons, menus, and expanded panels respond immediately

More than that needs a product reason.

## Workspace and mobileTool motion

Prefer feedback over theater. Pick 2 to 3 from this set and name them in preflight:

1. **Feedback:** save, submit, selection, drag, approve
2. **Region change:** panel open/close, sheet present/dismiss, route content swap
3. **Progress:** upload, deploy, query loading on the region that is busy

Avoid scroll jacking, long entrance delays, confetti on every complete, and continuous glow pulses in admin tools.

## Workspace motion recipes

Use these patterns when building tool UI. Prefer shared duration and easing tokens.

### Action busy state

- Primary actions that call a server or simulate work show an in-button loading state (spinner or explicit Busy label)
- Disable double submit while busy
- On success: toast or inline confirmation; restore the control
- On failure: error toast or inline error; keep the user on the same region

### Region progress

- Put progress on the busy region (table body, chart panel, deploy bar), not as a full page blocker when the shell can stay usable
- Skeletons match the shape of the content they replace
- Determinate progress when percent is known; indeterminate only when duration is unknown

### Panel and sheet

- Inspector/drawer: short slide or fade (small distance); backdrop fades with it
- Mobile sheet: present from the edge that matches the thumb model; dismiss is interruptible
- Do not delay panel content with staged marketing entrances

### Live updates

- Streaming rows or event feeds: append/update without scrolling the user away if they paused autoscroll
- Prefer subtle highlight or border pulse on the new row; no continuous glow on the whole feed
- Respect a user pause control when auto scroll exists

### Workflow and graph execution path

When building node canvases or pipelines:

- Make the path readable: completed → active → waiting → failed
- Emphasize edges on the active path (weight, contrast, or short motion); idle edges stay quieter
- Node state must be legible without relying on color alone (label or legend)
- Progress belongs on the busy branch or a compact execution bar, not as cinematic camera moves
- Fail layouts that read as positioned cards with invisible or ornamental connections

### Reduced motion

When `prefers-reduced-motion: reduce`:

- Drop travel distances; use opacity only or instant state change
- Keep loading spinners if they communicate busy state; drop decorative loops
- Keep focus and selection changes instant and obvious

## Good motion

- Shared duration and easing tokens
- Stagger used sparingly on sibling groups
- Scroll effects that clarify depth or progress on marketing pages
- Interruptible transitions
- Reduced motion fallback to simple opacity or no animation

## Bad motion

- Every card independently sliding in
- Long decorative delays before content is usable
- Scroll jacking that blocks native control without strong purpose
- Continuous glow pulses as fake premium
- Motion that fights reading (type constantly shifting under the eye)
- Cinematic marketing motion copied into settings or triage views
- Toast-only feedback with no busy state on the control that was pressed
- Workflow graphs with disconnected cards and no readable active path

## Implementation notes

- Prefer transform and opacity for UI motion
- Keep entrance distances small
- Tie scroll motion to content blocks, not random ornaments
- If a motion library is already in the project, use it; do not add a second one for vanity
