"use client"

import * as React from "react"

/**
 * Kit string catalogue. Plain entries are fixed copy. Parameterised entries are
 * functions so a locale can reorder or restructure the sentence around values.
 *
 * Kit components import relatively: `import { useDfStrings } from "../lib/df-intl"`.
 */
export type DfStrings = {
  // avatar
  avatarPresenceOnline: string
  avatarPresenceAway: string
  avatarPresenceBusy: string
  avatarPresenceOffline: string
  avatarOverflowMore: (overflow: number) => string
  avatarOverflowVisible: (overflow: number) => string

  // chart
  chartEmpty: string
  chartValuesJoin: (values: readonly string[]) => string

  // color-picker
  colorPickerLabel: string
  colorPickerClear: string
  colorPickerInputMode: string
  colorPickerHex: string
  colorPickerModeHex: string
  colorPickerModeRgb: string
  colorPickerModeHsl: string
  colorPickerModeHsb: string
  colorPickerChannelR: string
  colorPickerChannelG: string
  colorPickerChannelB: string
  colorPickerChannelH: string
  colorPickerChannelS: string
  colorPickerChannelL: string
  colorPickerChannelV: string
  colorPickerArea: string
  colorPickerHue: string
  colorPickerAreaValue: (channels: {
    saturation: number
    brightness: number
  }) => string
  colorPickerHueValue: (hue: number) => string

  // combobox
  comboboxClear: string
  comboboxPlaceholder: string
  comboboxLoading: string
  comboboxEmpty: string

  // command-palette
  commandPaletteAriaLabel: string
  commandPaletteCommands: string
  commandPalettePlaceholder: string
  commandPaletteEmpty: string
  commandPaletteSearching: string
  commandPaletteNavigate: string
  commandPaletteRun: string
  commandPaletteClose: string

  // contents-nav
  contentsNavToc: string
  contentsNavIndex: string

  // data-grid
  dataGridAriaLabel: string
  dataGridSelectAllRows: string
  dataGridDeselectAllRows: string
  dataGridResizeColumn: (column: string) => string
  dataGridEmpty: string

  // date-picker
  datePickerPreviousMonth: string
  datePickerNextMonth: string
  datePickerToday: string
  datePickerPlaceholder: string
  datePickerAriaLabel: string
  dateRangePickerPlaceholder: string
  dateRangePickerAriaLabel: string
  dateRangeDisplay: (parts: { start: string; end: string }) => string
  datePickerWeekdaySu: string
  datePickerWeekdayMo: string
  datePickerWeekdayTu: string
  datePickerWeekdayWe: string
  datePickerWeekdayTh: string
  datePickerWeekdayFr: string
  datePickerWeekdaySa: string

  // dialog / drawer
  dialogClose: string
  drawerClose: string

  // dock-panel
  dockPanelAriaLabel: string
  dockPanelClose: (label: string) => string
  dockPanelCollapse: (label: string) => string
  dockPanelExpand: (label: string) => string

  // editor
  editorAriaLabel: string
  editorPlaceholder: string
  editorFormatting: string
  editorSelectionFormatting: string
  editorMarkTaskComplete: string
  editorMarkTaskIncomplete: string
  editorQuote: string
  editorDivider: string

  // file-uploader
  fileUploaderAdd: string
  fileUploaderDropTitle: string
  fileUploaderDropDescription: string
  fileUploaderUploadImage: string
  fileUploaderUploadFile: string
  fileUploaderNoImage: string
  fileUploaderNoFile: string
  fileUploaderUnsupportedImage: string

  // format-toolbar
  formatToolbarHeading1: string
  formatToolbarHeading2: string
  formatToolbarHeading3: string
  formatToolbarBold: string
  formatToolbarItalic: string
  formatToolbarStrikethrough: string
  formatToolbarInlineCode: string
  formatToolbarLink: string
  formatToolbarLinkUrl: string
  formatToolbarLinkPlaceholder: string
  formatToolbarLinkApply: string
  formatToolbarLinkRemove: string
  formatToolbarBulletList: string
  formatToolbarOrderedList: string
  formatToolbarTaskList: string
  formatToolbarBlockquote: string
  formatToolbarCallout: string
  formatToolbarCalloutNone: string
  formatToolbarCalloutNote: string
  formatToolbarCalloutTip: string
  formatToolbarCalloutImportant: string
  formatToolbarCalloutWarning: string
  formatToolbarCalloutCaution: string
  formatToolbarCodeBlock: string
  formatToolbarHorizontalRule: string
  formatToolbarInsertTable: string
  formatToolbarAddRow: string
  formatToolbarAddColumn: string
  formatToolbarDeleteRow: string
  formatToolbarDeleteColumn: string
  formatToolbarDeleteTable: string

  // input
  inputClear: string
  inputIncrement: string
  inputDecrement: string

  // kbd
  kbdCommand: string
  kbdShift: string
  kbdOption: string
  kbdControl: string
  kbdEscape: string
  kbdDelete: string
  kbdForwardDelete: string
  kbdReturn: string
  kbdTab: string
  kbdCapsLock: string
  kbdSpace: string
  kbdUpArrow: string
  kbdDownArrow: string
  kbdLeftArrow: string
  kbdRightArrow: string
  kbdPageUp: string
  kbdPageDown: string
  kbdHome: string
  kbdEnd: string

  // label
  /** Full required text marker, punctuation included. Render as-is. */
  labelRequired: string
  /** Full optional text marker, punctuation included. Render as-is. */
  labelOptional: string
  /** Asterisk mark for required or optional variants. Render as-is. */
  labelAsterisk: string

  // option-list
  optionListSearchPlaceholder: string

  // overlay-hint
  overlayHintOpen: string
  overlayHintAction: string

  // progress
  progressAriaLabel: string
  progressIndeterminate: string

  // search-input
  searchInputClear: string

  // select
  selectRemove: string
  selectCountSelected: (count: number) => string
  selectMoreInformation: string

  // sidebar
  sidebarLabel: string
  sidebarCollapse: (label: string) => string
  sidebarExpand: (label: string) => string
  sidebarCollapseHint: (label: string) => string
  sidebarExpandHint: (label: string) => string
  sidebarCollapseSection: string
  sidebarExpandSection: string

  // slider
  sliderValue: string
  sliderMinimum: string
  sliderMaximum: string
  sliderDecrease: (name: string) => string
  sliderIncrease: (name: string) => string
  sliderMinimumThumb: (name: string) => string
  sliderMaximumThumb: (name: string) => string

  // spinner
  spinnerLoading: string

  // split
  splitSeparator: string

  // tag-input
  tagInputPlaceholder: string
  tagInputRemove: (tag: string) => string

  // timeline
  timelineAriaLabel: string
  timelineNameColumn: string
  timelineItemFallback: string
  timelineEmpty: string
  timelineBarUnchanged: string
  timelineBarDragCancelled: string
  timelineBarEditCancelled: string
  timelineUpdated: (range: string) => string
  timelineMovingBar: (range: string) => string
  timelineResizingBar: (range: string) => string
  timelineMovedCommit: (range: string) => string
  timelineResizedCommit: (range: string) => string

  // toast
  toastDismiss: string

  // widget-grid
  widgetGridAriaLabel: string
  widgetGridEmpty: string
  widgetGridCell: (parts: {
    column: number
    row: number
    width: number
    height: number
  }) => string
  widgetGridMoveOrResize: (cell: string) => string
  widgetGridMoving: (cell: string) => string
  widgetGridResizing: (cell: string) => string
  widgetGridLayoutUnchanged: string
  widgetGridLayoutUpdated: string
  widgetGridGestureCancelled: string
  widgetGridEditCancelled: string
  widgetGridMovedCommit: (cell: string) => string
  widgetGridResizedCommit: (cell: string) => string
}

export const defaultStrings: DfStrings = {
  avatarPresenceOnline: "Online",
  avatarPresenceAway: "Away",
  avatarPresenceBusy: "Busy",
  avatarPresenceOffline: "Offline",
  avatarOverflowMore: (overflow) => `${overflow} more`,
  avatarOverflowVisible: (overflow) => `+${overflow}`,

  chartEmpty: "No data",
  chartValuesJoin: (values) => values.join(" to "),

  colorPickerLabel: "Pick color",
  colorPickerClear: "Remove color",
  colorPickerInputMode: "Color input mode",
  colorPickerHex: "Hex color",
  colorPickerModeHex: "Hex",
  colorPickerModeRgb: "RGB",
  colorPickerModeHsl: "HSL",
  colorPickerModeHsb: "HSB",
  colorPickerChannelR: "R",
  colorPickerChannelG: "G",
  colorPickerChannelB: "B",
  colorPickerChannelH: "H",
  colorPickerChannelS: "S",
  colorPickerChannelL: "L",
  colorPickerChannelV: "B",
  colorPickerArea: "Saturation and brightness",
  colorPickerHue: "Hue",
  colorPickerAreaValue: ({ saturation, brightness }) =>
    `Saturation ${saturation}%, brightness ${brightness}%`,
  colorPickerHueValue: (hue) => `${hue} degrees`,

  comboboxClear: "Clear",
  comboboxPlaceholder: "Type to search",
  comboboxLoading: "Loading...",
  comboboxEmpty: "No matches",

  commandPaletteAriaLabel: "Command palette",
  commandPaletteCommands: "Commands",
  commandPalettePlaceholder: "Type a command...",
  commandPaletteEmpty: "No commands found",
  commandPaletteSearching: "Searching",
  commandPaletteNavigate: "navigate",
  commandPaletteRun: "run",
  commandPaletteClose: "close",

  contentsNavToc: "On this page",
  contentsNavIndex: "Contents",

  dataGridAriaLabel: "Data grid",
  dataGridSelectAllRows: "Select all rows",
  dataGridDeselectAllRows: "Deselect all rows",
  dataGridResizeColumn: (column) => `Resize ${column}`,
  dataGridEmpty: "No rows",

  datePickerPreviousMonth: "Previous month",
  datePickerNextMonth: "Next month",
  datePickerToday: "Today",
  datePickerPlaceholder: "Select date",
  datePickerAriaLabel: "Date",
  dateRangePickerPlaceholder: "Select date range",
  dateRangePickerAriaLabel: "Date range",
  dateRangeDisplay: ({ start, end }) => `${start} to ${end}`,
  datePickerWeekdaySu: "Su",
  datePickerWeekdayMo: "Mo",
  datePickerWeekdayTu: "Tu",
  datePickerWeekdayWe: "We",
  datePickerWeekdayTh: "Th",
  datePickerWeekdayFr: "Fr",
  datePickerWeekdaySa: "Sa",

  dialogClose: "Close",
  drawerClose: "Close",

  dockPanelAriaLabel: "Panel",
  dockPanelClose: (label) => `Close ${label}`,
  dockPanelCollapse: (label) => `Collapse ${label}`,
  dockPanelExpand: (label) => `Expand ${label}`,

  editorAriaLabel: "Editor",
  editorPlaceholder: "Write…",
  editorFormatting: "Formatting",
  editorSelectionFormatting: "Selection formatting",
  editorMarkTaskComplete: "Mark task complete",
  editorMarkTaskIncomplete: "Mark task incomplete",
  editorQuote: "Quote",
  editorDivider: "Divider",

  fileUploaderAdd: "Add",
  fileUploaderDropTitle: "Drop an image here",
  fileUploaderDropDescription: "or click to browse. Paste also works.",
  fileUploaderUploadImage: "Upload image",
  fileUploaderUploadFile: "Upload file",
  fileUploaderNoImage: "No image found.",
  fileUploaderNoFile: "No file found.",
  fileUploaderUnsupportedImage:
    "That file type is not supported. Use an image.",

  formatToolbarHeading1: "Heading 1",
  formatToolbarHeading2: "Heading 2",
  formatToolbarHeading3: "Heading 3",
  formatToolbarBold: "Bold",
  formatToolbarItalic: "Italic",
  formatToolbarStrikethrough: "Strikethrough",
  formatToolbarInlineCode: "Inline code",
  formatToolbarLink: "Link",
  formatToolbarLinkUrl: "Link URL",
  formatToolbarLinkPlaceholder: "https://",
  formatToolbarLinkApply: "Apply",
  formatToolbarLinkRemove: "Remove",
  formatToolbarBulletList: "Bullet list",
  formatToolbarOrderedList: "Ordered list",
  formatToolbarTaskList: "Task list",
  formatToolbarBlockquote: "Blockquote",
  formatToolbarCallout: "Callout",
  formatToolbarCalloutNone: "None",
  formatToolbarCalloutNote: "Note",
  formatToolbarCalloutTip: "Tip",
  formatToolbarCalloutImportant: "Important",
  formatToolbarCalloutWarning: "Warning",
  formatToolbarCalloutCaution: "Caution",
  formatToolbarCodeBlock: "Code block",
  formatToolbarHorizontalRule: "Horizontal rule",
  formatToolbarInsertTable: "Insert table",
  formatToolbarAddRow: "Add row",
  formatToolbarAddColumn: "Add column",
  formatToolbarDeleteRow: "Delete row",
  formatToolbarDeleteColumn: "Delete column",
  formatToolbarDeleteTable: "Delete table",

  inputClear: "Clear",
  inputIncrement: "Increment",
  inputDecrement: "Decrement",

  kbdCommand: "Command",
  kbdShift: "Shift",
  kbdOption: "Option",
  kbdControl: "Control",
  kbdEscape: "Escape",
  kbdDelete: "Delete",
  kbdForwardDelete: "Forward Delete",
  kbdReturn: "Return",
  kbdTab: "Tab",
  kbdCapsLock: "Caps Lock",
  kbdSpace: "Space",
  kbdUpArrow: "Up Arrow",
  kbdDownArrow: "Down Arrow",
  kbdLeftArrow: "Left Arrow",
  kbdRightArrow: "Right Arrow",
  kbdPageUp: "Page Up",
  kbdPageDown: "Page Down",
  kbdHome: "Home",
  kbdEnd: "End",

  labelRequired: "(required)",
  labelOptional: "(optional)",
  labelAsterisk: "*",

  optionListSearchPlaceholder: "Search",

  overlayHintOpen: "Open",
  overlayHintAction: "Action",

  progressAriaLabel: "Progress",
  progressIndeterminate: "In progress",

  searchInputClear: "Clear search",

  selectRemove: "Remove",
  selectCountSelected: (count) => `${count} selected`,
  selectMoreInformation: "More information",

  sidebarLabel: "Sidebar",
  sidebarCollapse: (label) => `Collapse ${label}`,
  sidebarExpand: (label) => `Expand ${label}`,
  sidebarCollapseHint: (label) => `Double-click to collapse ${label}`,
  sidebarExpandHint: (label) => `Double-click to expand ${label}`,
  sidebarCollapseSection: "Collapse section",
  sidebarExpandSection: "Expand section",

  sliderValue: "Value",
  sliderMinimum: "Minimum",
  sliderMaximum: "Maximum",
  sliderDecrease: (name) => `Decrease ${name}`,
  sliderIncrease: (name) => `Increase ${name}`,
  sliderMinimumThumb: (name) => `${name} minimum`,
  sliderMaximumThumb: (name) => `${name} maximum`,

  spinnerLoading: "Loading",

  splitSeparator: "Resize",

  tagInputPlaceholder: "Add tag",
  tagInputRemove: (tag) => `Remove ${tag}`,

  timelineAriaLabel: "Timeline",
  timelineNameColumn: "Name",
  timelineItemFallback: "Item",
  timelineEmpty: "No rows",
  timelineBarUnchanged: "Bar unchanged",
  timelineBarDragCancelled: "Bar drag cancelled",
  timelineBarEditCancelled: "Bar edit cancelled",
  timelineUpdated: (range) => `Updated ${range}`,
  timelineMovingBar: (range) => `Moving bar ${range}`,
  timelineResizingBar: (range) => `Resizing bar ${range}`,
  timelineMovedCommit: (range) =>
    `Moved to ${range}. Press Enter to commit.`,
  timelineResizedCommit: (range) =>
    `Resized to ${range}. Press Enter to commit.`,

  toastDismiss: "Dismiss",

  widgetGridAriaLabel: "Widget grid",
  widgetGridEmpty: "No widgets",
  widgetGridCell: ({ column, row, width, height }) =>
    `column ${column}, row ${row}, ${width} by ${height}`,
  widgetGridMoveOrResize: (cell) => `Move or resize widget at ${cell}`,
  widgetGridMoving: (cell) => `Moving widget at ${cell}`,
  widgetGridResizing: (cell) => `Resizing widget at ${cell}`,
  widgetGridLayoutUnchanged: "Layout unchanged",
  widgetGridLayoutUpdated: "Layout updated",
  widgetGridGestureCancelled: "Widget gesture cancelled",
  widgetGridEditCancelled: "Widget edit cancelled",
  widgetGridMovedCommit: (cell) =>
    `Moved to ${cell}. Press Enter to commit.`,
  widgetGridResizedCommit: (cell) =>
    `Resized to ${cell}. Press Enter to commit.`,
}

/** Merge a partial catalogue over English defaults. */
export function mergeDfStrings(overrides?: Partial<DfStrings>): DfStrings {
  if (overrides == null) return defaultStrings
  return { ...defaultStrings, ...overrides }
}

export type DfAvatarPresence = "online" | "away" | "busy" | "offline"

/** Resolve a presence status label from the catalogue. */
export function dfAvatarPresenceLabel(
  strings: DfStrings,
  presence: DfAvatarPresence
): string {
  switch (presence) {
    case "online":
      return strings.avatarPresenceOnline
    case "away":
      return strings.avatarPresenceAway
    case "busy":
      return strings.avatarPresenceBusy
    case "offline":
      return strings.avatarPresenceOffline
  }
}

export type DfFormatToolbarCalloutKind =
  | "note"
  | "tip"
  | "important"
  | "warning"
  | "caution"

/** Resolve a callout kind label from the catalogue. */
export function dfFormatToolbarCalloutLabel(
  strings: DfStrings,
  kind: DfFormatToolbarCalloutKind
): string {
  switch (kind) {
    case "note":
      return strings.formatToolbarCalloutNote
    case "tip":
      return strings.formatToolbarCalloutTip
    case "important":
      return strings.formatToolbarCalloutImportant
    case "warning":
      return strings.formatToolbarCalloutWarning
    case "caution":
      return strings.formatToolbarCalloutCaution
  }
}

export type DfColorPickerMode = "hex" | "rgb" | "hsl" | "hsb"

/** Resolve a color input mode tab label from the catalogue. */
export function dfColorPickerModeLabel(
  strings: DfStrings,
  mode: DfColorPickerMode
): string {
  switch (mode) {
    case "hex":
      return strings.colorPickerModeHex
    case "rgb":
      return strings.colorPickerModeRgb
    case "hsl":
      return strings.colorPickerModeHsl
    case "hsb":
      return strings.colorPickerModeHsb
  }
}

/** Sunday-first weekday labels from the catalogue, matching the date picker grid. */
export function dfDatePickerWeekdays(
  strings: DfStrings
): readonly [string, string, string, string, string, string, string] {
  return [
    strings.datePickerWeekdaySu,
    strings.datePickerWeekdayMo,
    strings.datePickerWeekdayTu,
    strings.datePickerWeekdayWe,
    strings.datePickerWeekdayTh,
    strings.datePickerWeekdayFr,
    strings.datePickerWeekdaySa,
  ]
}

const DfIntlContext = React.createContext<DfStrings>(defaultStrings)

export type DfIntlProviderProps = {
  strings?: Partial<DfStrings>
  children: React.ReactNode
}

export function DfIntlProvider({ strings, children }: DfIntlProviderProps) {
  const value = React.useMemo<DfStrings>(
    () => mergeDfStrings(strings),
    [strings]
  )
  return React.createElement(DfIntlContext.Provider, { value }, children)
}

/**
 * Merged catalogue. Falls back to English defaults when no provider is present.
 * Kit components: `import { useDfStrings } from "../lib/df-intl"`.
 */
export function useDfStrings(): DfStrings {
  return React.useContext(DfIntlContext)
}
