# Changelog

Semver for `@default-file/ui` lives in `package.json`. `df-ui init` records the same version in `df.json`.

## 0.31.1

- Install from the public registry. The CLI, README, and agent brief now use `@default-file/ui` instead of a source URL.

## 0.31.0

- Own the utility generator and theme tables here. Consumers pass `--app-root <dir>` to build a product stylesheet instead of forking the generator.
- Ship `src/css/df-utilities.classes.json` so a consumer without component sources knows which classes the kit already covers.
- Leave the shipped kit stylesheet untouched when component sources are unavailable. Regenerating from an installed package previously reduced it to a single rule.
- Ship `scripts/df-theme.mjs` and `scripts/generate-df-utilities.mjs` in the package.

## 0.30.1

- Add a tracked `pre-push` hook that rejects pushes to any repository other than `repository.url`.
- Wire `core.hooksPath` from `prepare` so every checkout picks up the guard.

## 0.30.0

- Move the kit source to `default-file/ui` and publish under the `default-file` organization.
- Derive the install spec, raw registry base, and registry paths from `repository.url` so the GitHub coordinates are declared once.
- Add `homepage`, `bugs`, `keywords`, and public `publishConfig` for registry releases.
- Add a tag driven release workflow that publishes over OpenID Connect with no stored token.
- Add contributor, conduct, and security policies plus issue and pull request templates.

## 0.29.14

- Own ColorPicker pill trigger layout and start padding in kit chrome CSS.

## 0.29.13

- Add `@types/node` so a standalone kit install typechecks Node lib tests with the same compiler as shipped sources.

## 0.29.12

- Keep Node `src/**/*.test.ts` files out of package typecheck. Those files run under `test:lib`.

## 0.29.11

- Store registry file contents as LF so `public/r` matches on Windows and Linux.

## 0.29.10

- Scroll Options Panel body with kit Scroll Area under the existing height cap.
- Pin home intro for two screen heights via `--home-intro-pin-screens`.
- Drop the unused `.home-intro-line` highlight opacity rule.

## 0.29.9

- Keep `.df-reveal` free of `will-change` so sticky positioning still applies after the reveal.
- Pin home intro copy for `--home-intro-pin-screens` and crossfade each sentence with `--home-intro-scrub`.

## 0.29.8

- Prefer system monospace for `--df-editor-mono` so editor and fence text keep aligned columns for full Unicode glyphs.
- Disable ligatures on kit Editor mono surfaces so dash and arrow sequences keep full character width.

## 0.29.7

- Include `lucide-react` as a kit `devDependency` so git-install `prepare` can compile component types.

## 0.29.6

- Build `dist` on install from git so App Hosting and other github consumers receive compiled components.

## 0.29.5

- Provide Floating Controls toolbar item order from the parent so roving `tabIndex` is stable under server render and Strict Mode.

## 0.29.4

- Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` with real narrowing across kit types and components.
- Add component Vitest contracts for Editor, Featured Icon, File Uploader, Kbd, List Item, Number Slider, Options Panel, Overlay Hint, Panel Section, Separator, Sidebar, Skeleton, Spinner, Status Dot, Text Mark, Timeline, Toast, and Widget Grid.
- Add `verify:registry` for declared paths, `public/r` freshness, and component to registry to API consistency. Wire it into `verify` and `prepublishOnly`.
- Add kit CI and document the compiled distribution, peers, CSS order, browser support, and Server Components contract in the README.

## 0.29.3

- Use `useIsomorphicLayoutEffect` for remaining Accordion, overlay, Input, Option List, Sidebar, Tabs, Text Mark, Tick Slider, and Toast layout effects.

## 0.29.2

- Publish only `dist`, `src/css`, `bin`, `scripts/cli`, `docs`, `public/r`, `registry.json`, and `skills`. Colocated component tests and maintainer generators stay out of the package.
- Document Editor, Skeleton, Timeline, and Widget Grid prop tables in exported API JSON.
- Declare `@tanstack/react-virtual` on the Timeline registry item.
- Sync Combobox committed value to input text with `useIsomorphicLayoutEffect`.

## 0.29.1

- Keep Combobox `value` / `defaultValue` / `onValueChange` on the option value, with input text showing the matching label while typing stays a separate query.
- Mark DatePicker and DateRangePicker Input triggers as `role="combobox"` with `aria-haspopup="grid"` so PopoverTrigger `aria-expanded` is valid.

## 0.29.0

### Breaking

- Remove `--df-control-optical-shift`, `--df-kbd-mod-optical-shift`, and `--df-kbd-punct-optical-shift`, plus the component aliases `--df-input-optical-shift` and `--df-select-optical-shift`. Cap-height metric trimming replaces those nudges on kbd, input, and select chrome.
- Grow the default Switch track from 32x18.4 to 40x24 and the small track from 24x14 to 32x20. Geometry is derived from `--df-switch-thumb-gap` with zero vertical slack. Focus uses `box-shadow` and a transparent `outline` for forced colors, not a layout-consuming border.
- Grow status-dot md, lg, and xl to 10px, 12px, and 14px. Shrink `--df-affordance-size-2xs` from 10px to 8px.

### Added

- Geometry contract helpers in `scripts/lib/df-geometry.mjs` with `df:audit-geometry` wired as the first `verify` step.
- Zero-slack equations for Switch and for input sizes sm to xl across hairline, thin, and thick borders, plus select-trigger sizes sm to lg.
- Derive input and select-trigger `padding-block` from height, border width, and line height so the line box fills the content box.

### Fixed

- Compose overlay component rules in the geometry resolver so size and border variants resolve with the padding formula before zero-slack checks.

## 0.28.0

- Require `weekStartsOn` on `buildMonthGrid` and `moveCalendarFocus`. Callers must pass an explicit first weekday; the helpers do not default to Sunday.
- Add `weekStartsOnForLocale`, `offsetFromWeekStart`, and `rotateWeekdayLabels` to the calendar grid module. Engines without week info fall back to Sunday as a degradation path for locale resolution only.
- Pass week start through date picker Home and End focus movement.
- Announce Toggle Group items with `aria-pressed` in single and multiple modes. Single mode stays clearable and mutually exclusive; arrow keys move focus only.
- Remove Label `brackets`. Required and optional marks render catalogue strings as-is.
- Name range slider thumbs with `sliderMinimumThumb` and `sliderMaximumThumb`.
- Promote bare `src/lib` helpers to directory modules. Expose package subpaths for `utils`, `nearest-theme`, `df-ui-audio`, and `df-tick-sound`. Corner shape, hover border, padding chrome, and shadow intensity stay internal kit chrome.

## 0.27.16

- Set Stage Shot, Markdown Preview, Scan Note, and Runway home preview stage fills to `#fcf6f2`.

## 0.27.15

- Refresh Stage Shot, Markdown Preview, Scan Note, and Runway home preview stage fills to match the updated cream card artwork.

## 0.27.14

- Align Stage Shot, Markdown Preview, and Scan Note home preview stage fills with the cream card artwork.
- Add `--home-tool-preview-runway` for the Runway studio and home card media fill.

## 0.27.13

- Clean kit comments and docs copy: remove em dashes, drop unnecessary English hyphens, and keep only contract-level notes.
- Prefer composed with List Item in Contents Nav and Dropdown Menu descriptions.

## 0.27.12

- Align Featured Icon, Option List, Dropdown Menu, Editor, and anchor-position chrome styles with the Label, Badge, and Select CSS custom property contract.

## 0.27.11

- Add `cssVars` to build React style objects from CSS custom properties.
- Route Featured Icon chrome overrides through `cssVars`.
- Route Option List, Dropdown Menu, Editor, and anchor-position custom properties through `cssVars`.
- Keep Kbd child flattening on `Children.toArray`.
- Use a boolean mark check for Option List parts so nested child walks stay typed after a negative match.

## 0.27.10

- Collect clipboard paste files from both `files` and `items` so custom `pickFile` consumers receive image pastes.
- Add `--home-tool-preview-scan-note` for Studio Scan Note card media fill.

## 0.27.9

- Regenerate registry payloads so Kbd install matches the live chord baseline model.
- Align Dropdown Menu Shortcut docs with the Kbd Unicode chord contract.
- Document that string-chord glyph parts are presentational when a Kbd accessible name is set.

## 0.27.8

- Wire SidebarProvider fillHeight into heightMode fill, fixed, and auto so the documented stretch contract is real.
- Document Sidebar contracts for FooterSection gap collapse, frame offcanvas seam, nest padding in icon mode, SidebarMenuSkeleton, SidebarMenuSubItem, and useSidebar returns.
- Tighten Sidebar public API docs and JSDoc to short contract-level copy.

## 0.27.7

- Tighten Kbd public API docs and catalogue copy to short contract-level writing.

## 0.27.6

- Own Dropdown Menu submenu open and close timing in CSS tokens (--df-duration-slow and --df-duration-fast). Duration props override only when set, matching Content motion ownership.
- Document DropdownMenuSubmenu and SubContent motion and offset props in the public API.

## 0.27.5

- Pair Kbd sm type with chip height so vertical inset is whole pixels at a 16px root. Avoids half-pixel flex centering that reads off-center at 100% zoom.

## 0.27.4

- Add ListItemSubmenuChevron as the List Item nested-menu affordance. Same size box as the indicator check, muted foreground, no open-state travel. Dropdown Menu injects it for submenu triggers. Option List and Sidebar pass it through trailing.

## 0.27.3

- Align Kbd chord glyphs on one alphabetic baseline inside a centered chord row so modifiers and Latin keys share a straight line.

## 0.27.2

- Drop List Item submenu open-state chevron translate so nested triggers stay still.

## 0.27.1

- Give Kbd one optical contract: part boxes own chord alignment; host chip stays fixed-height flex.
- Derive aria-label for string chords and mark glyph parts presentational so assistive tech gets one name.
- Export hasKbdShortcut and use it in Dropdown Menu, Context Menu, and Command Palette so empty shortcut strings do not render chips.
- Document the Unicode chord string grammar; textual forms such as Ctrl+K are not parsed.
- Tighten Dropdown Menu public JSDoc so prop contracts stay short and professional.

## 0.27.0

- Split Kbd chords into KbdAbbr for modifiers and special keys with accessible titles, and KbdContent for Latin keys and punctuation.
- Align chord parts on shared optical boxes so shortcuts read straight. Punctuation keeps a slight lower seat via --df-kbd-punct-optical-shift.

## 0.26.5

- Keep Dropdown Menu kit-scroll shell end pad at 0 so the thumb sits on --df-dropdown-menu-scroll-thumb-gap. Viewport owns the end inset for rows.

## 0.26.4

- Align Kbd chord glyphs on one alphabetic baseline so modifiers and Latin keys read straight. Punctuation such as a comma keeps its natural seat.
- Match Dropdown Menu Body and SubContent ScrollArea to the shared menu scroll contract: visibility always, reserved track inset, thumb only when rows overflow.

## 0.26.3

- Give SidebarContent separate scrollbar inset tokens: --df-sidebar-scrollbar-track-inset for thumb, --df-sidebar-scrollbar-edge-inset for edge (default 0, flush on the content-facing border).
- Align Kbd chord glyphs to the shared cap-height optical system, and nudge modifier symbols such as ⌘ onto the Latin key line.

## 0.26.2

- Keep SidebarContent edge scrollbars flush on the content-facing border. Thumb still uses --df-sidebar-scrollbar-track-inset.
- Rest Dropdown Menu destructive item tone on destructive ink with a transparent plate, and apply a soft destructive wash on hover.

## 0.26.1

- Target Dropdown Menu item padding, radius, and tone chrome through the Body ScrollArea viewport so List Item rows keep menu chrome after the always-on ScrollArea shell.
- Scroll DropdownMenuSubContent through the kit ScrollArea when collision avoidance caps height.
- Size Context Menu glyph and chevron icons with the affordance scale instead of a utility class.
- Drop unused Dropdown Menu shortcut type and color tokens now owned by Kbd.

## 0.26.0

- Add Kbd, a keyboard hint chip for shortcuts and key chords, with sm and md sizes.
- Render Dropdown Menu, Context Menu, and Command Palette shortcuts with Kbd instead of Badge or plain mono text.
- Scroll DropdownMenuBody through the kit ScrollArea by default so collision height caps use the kit thumb, not the system scrollbar.

## 0.25.1

- Keep Dropdown Menu Content clipped when a submenu is present so collision max-height cannot paint rows outside the surface.
- Scroll DropdownMenuBody when Content is height-capped by the viewport.

## 0.25.0

- Render DropdownMenuShortcut as a secondary Badge at size xs with mono type.
- Tighten Dropdown Menu item inline padding so trailing shortcuts sit closer to the panel edge.

## 0.24.1

- Refine Dropdown Menu open and close motion for a smoother compositor-only settle: longer open, softer scale, and slightly more travel.

## 0.24.0

- Default DropdownMenuContent and SubContent shadow to none. Pass a kit elevation token on shadow to enable.

## 0.23.0

- Increase default DropdownMenuLabel size to text-11.
- Size Header Avatar to the name and email stack height when both title and description are present.

## 0.22.1

- Span DropdownMenuHeader across the full panel width when bleeding past Content padding.

## 0.22.0

- Drop the Content max-height native scrollbar so menus hug content by default.
- Add DropdownMenuBody scrollable with kit ScrollArea and maxHeight when a long list needs a height cap.

## 0.21.1

- Ellipsize DropdownMenuHeader title and description when the panel width is constrained.

## 0.21.0

- Treat DropdownMenuContent and SubContent shadow as full surface chrome. Accept kit elevation tokens, custom box-shadow, or false and none for a flat panel.

## 0.20.2

- Increase DropdownMenuHeader inner padding to 3 spacing units on each side.

## 0.20.1

- Document Dropdown Menu workspace switcher composition with stacked Items, Avatar leadingFit, and selected checks.

## 0.20.0

- Add DropdownMenuContent itemSize so panel rows share one List Item density, with per-item size still winning.

## 0.19.0

- Add DropdownMenuHeader meta for a Badge or status mark under the description, beside trailing on the right.

## 0.18.0

- Add DropdownMenuHeader trailing for end-aligned marks such as a Badge selection count.
- Add DropdownMenuItem tone destructive for remove actions in batch menus.

## 0.17.1

- Guard Contents Nav selection when disabled or readOnly at the composer, and share Combobox option interactivity through isComboboxOptionInteractive.

## 0.17.0

- Add DropdownMenuShortcut, Item shortcut, selected and indicator, Label chrome, and DropdownMenuSubmenu with SubContent for nested action menus.
- Treat Header leading false as no avatar, and document title and description type chrome with ellipsis truncation.

## 0.16.1

- Fill the Sidebar provider with the workspace background for the floating variant so SidebarInset and float margins share one continuous surface.

## 0.16.0

- Add dividerColor and marginBlock chrome on DropdownMenuSeparator so group rules share the Content and Header dividerColor contract.

## 0.15.0

- Add readOnly on ComboboxOption and ContentsNavItemData, and document disabled and readOnly on ContentsNavItem, so data-driven rows share the List Item presentational contract.

## 0.14.1

- Default DropdownMenuFooter to List Item readOnly and muted meta chrome props so footer interaction comes from the shared row contract.
- Collapse panel section-gap only after SidebarFooterSection so a sibling Footer rule keeps section spacing above SidebarFooter.

## 0.14.0

- Add SidebarFooterSection paddingBlockEnd to set or clear bottom padding after utility rows.

## 0.13.5

- Own outline Button fill recipes only in the theme tables so component CSS consumes --df-button-outline-fill without rebinding.
- Carry .dark on Option List portals with nearestDarkClass so portaled lists match the trigger theme.

## 0.13.4

- Own List Item interactive host selection in LIST_ITEM_INTERACTIVE_HOST_SELECTOR so Option List and Dropdown Menu skip disabled and readOnly rows from one contract.

## 0.13.3

- Space SidebarFooterSection from SidebarFooter with the panel --df-sidebar-section-gap. Remove the footer-stack gap collapse so utility rows and the Footer rule share one spacing contract.

## 0.13.2

- Own dark outline Button fill as an opaque mix with background so the plate stays dark when the surface theme is dark.
- Add bottom padding on SidebarFooterSection so utility rows keep air above the Footer rule.

## 0.13.1

- Bind Dropdown Menu, Option List, and Popover surface tokens on the host, and inherit List Item title color from the row so overlays adapt in dark theme.

## 0.13.0

- Add List Item readOnly for presentational rows that keep size, variant, and selected appearance without hover, press, or focus chrome.

## 0.12.2

- Own Button label color as foreground so outline and ghost stay readable in dark surfaces, and set color-scheme on light and dark roots.

## 0.12.1

- Document DropdownMenuContent side and align placement for sides, corners, middle, and content-aware auto align.

## 0.12.0

- Add SidebarProfileMenu for the account switcher list in SidebarFooter, separate from SidebarMenu navigation lists.

## 0.11.1

- Truncate List Item title and secondary with an ellipsis when stacked or narrow rows run out of space.

## 0.10.3

- Default DropdownMenuItem to the accent List Item variant so labels and leading icons use foreground color.

## 0.10.2

- Resolve DropdownMenuContent width modes in CSS and layout for hug, fill, and fixed lengths on portaled and inline panels.

## 0.11.0

- Add List Item leadingFit (icon or content). content sizes the leading track to Avatar and other non-icon marks; icon keeps the default mark box.

## 0.10.1

- Size List Item custom leading tracks to the node so Avatar and similar marks do not overlap the label.

## 0.10.0

- Add DropdownMenuContent width for hug, fill (match trigger), and fixed CSS lengths, with header, body, footer, and items stretching to fill the panel.

## 0.9.0

- Expose Dropdown Menu surface and section chrome props for radius, fills, text colors, shadow, dividers, shell padding, and header, body, and footer insets.

## 0.8.3

- Tighten Sidebar FooterSection and Footer as one bottom stack, inset panel-level separators, and keep stacked lg account rows at content height.
- Build DropdownMenuFooter on List Item so footer meta uses the same row padding as menu items.

## 0.8.2

- Keep DropdownMenuFooter inside the menu shell padding so meta copy keeps even inset.

## 0.8.1

- Own Badge gap size defaults as kit tokens (--df-badge-gap-xs to --df-badge-gap-xl).

## 0.8.0

- Add Badge gap for design-scale control of space between leading, label, trailing, and count.

## 0.7.0

- Add StatusDot for filled online and live presence marks, with size steps that follow Badge when used in leading.

## 0.6.2

- Harden Dropdown Menu contracts: Body owns role menu, trigger keyboard open, Tab dismiss without focus trap, typeahead, token-backed motion defaults, and asChild item hosts.

## 0.6.1

- Align Badge leading and trailing slot markup with Button slot contracts and document the props as any-node slots.
- Let stacked List Item rows in Sidebar use content height so name and secondary lines are not clipped.
- Export SidebarFooterSection from the components barrel.

## 0.6.0

- Add SidebarFooterSection for sticky utility rows above the optional SidebarFooter.

## 0.5.0

- Add Badge leading and trailing slots for configurable icons and controls before and after the label.

## 0.4.2

- Add DropdownMenuBody so menus compose as header, body, and footer sections.

## 0.4.1

- Document Badge leading icon composition for status chips before the label.

## 0.4.0

- Add Dropdown Menu for profile menus, three-dot menus, and other action menus with fluid open and close motion.
- Compose menu rows with List Item. Prefer Option List when the panel should keep a selected value.

## 0.3.5

- Align OptionList openOnHover Enter and Space with click: open when closed; Escape, pointer leave, and outside dismiss close.

## 0.3.4

- Document OptionList width fill for render hosts and end-aligned List Item trailing icons in sidebar and rail rows.

## 0.3.3

- Keep openOnHover root panels open when the pointer moves between sibling rows inside the panel.

## 0.3.2

- Stretch OptionListTrigger render hosts to full width when OptionList width is fill or fixed.

## 0.3.1

- Keep openOnHover flyouts open across nested OptionListSubContent portals.
- Open on click when openOnHover is set; pointer leave and outside dismiss close the panel.
- Step Badge secondary fill and outline border above accent and muted surfaces.

## 0.3.0

- Add OptionList openOnHover and hoverCloseDelay for trigger and panel hover flyouts.
- Document Sidebar nested menu flyouts composed with Option List.

## 0.2.2

- Lighten the sidebar search input surface in light and dark themes.

## 0.2.1

- Document hover-open nested flyout menus on List Item via OptionListSubmenu.

## 0.2.0

- Keep existing copy source files on `df-ui add` unless `--force` is passed.
- Record kit semver in `df.json` and expose `df-ui version` / `df-ui info`.
- Document ownership and upgrade rules for copy source and package import paths.

## 0.1.0

- Design system release baseline: color system, tokens, components, CLI, MCP, and copy source registry.
