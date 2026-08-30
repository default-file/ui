import assert from "node:assert/strict"
import { test } from "node:test"

import {
  defaultStrings,
  dfAvatarPresenceLabel,
  dfColorPickerModeLabel,
  dfFormatToolbarCalloutLabel,
  mergeDfStrings,
} from "./index.ts"

test("default lookup returns English catalogue values", () => {
  assert.equal(defaultStrings.dialogClose, "Close")
  assert.equal(defaultStrings.chartEmpty, "No data")
  assert.equal(defaultStrings.comboboxPlaceholder, "Type to search")
  assert.equal(defaultStrings.dataGridSelectAllRows, "Select all rows")
  assert.equal(defaultStrings.formatToolbarCalloutNote, "Note")
  assert.equal(defaultStrings.timelineBarDragCancelled, "Bar drag cancelled")
  assert.equal(defaultStrings.widgetGridAriaLabel, "Widget grid")
  assert.equal(defaultStrings.contentsNavToc, "On this page")
  assert.equal(defaultStrings.contentsNavIndex, "Contents")
  assert.equal(defaultStrings.labelRequired, "(required)")
  assert.equal(defaultStrings.labelOptional, "(optional)")
  assert.equal(defaultStrings.labelAsterisk, "*")
  assert.equal(defaultStrings.splitSeparator, "Resize")
})

test("partial override keeps unspecified defaults", () => {
  const merged = mergeDfStrings({
    dialogClose: "Fermer",
    chartEmpty: "Aucune donnee",
    labelRequired: "obligatoire",
  })

  assert.equal(merged.dialogClose, "Fermer")
  assert.equal(merged.chartEmpty, "Aucune donnee")
  assert.equal(merged.labelRequired, "obligatoire")
  assert.equal(merged.labelOptional, "(optional)")
  assert.equal(merged.drawerClose, defaultStrings.drawerClose)
  assert.equal(merged.spinnerLoading, "Loading")
  assert.equal(merged.toastDismiss, "Dismiss")
})

test("parameterised entries keep value slots reorderable", () => {
  assert.equal(defaultStrings.avatarOverflowMore(2), "2 more")
  assert.equal(defaultStrings.avatarOverflowVisible(2), "+2")
  assert.equal(defaultStrings.tagInputRemove("design"), "Remove design")
  assert.equal(defaultStrings.sliderDecrease("Opacity"), "Decrease Opacity")
  assert.equal(
    defaultStrings.dateRangeDisplay({ start: "2026-01-01", end: "2026-01-07" }),
    "2026-01-01 to 2026-01-07"
  )
  assert.equal(
    defaultStrings.chartValuesJoin(["10", "20", "30"]),
    "10 to 20 to 30"
  )
  assert.equal(
    defaultStrings.widgetGridCell({
      column: 1,
      row: 2,
      width: 3,
      height: 4,
    }),
    "column 1, row 2, 3 by 4"
  )
  assert.equal(defaultStrings.selectCountSelected(3), "3 selected")
  assert.equal(
    defaultStrings.timelineMovedCommit("2026-01-01 to 2026-01-07"),
    "Moved to 2026-01-01 to 2026-01-07. Press Enter to commit."
  )

  const french = mergeDfStrings({
    avatarOverflowMore: (overflow) => `${overflow} de plus`,
    avatarOverflowVisible: (overflow) => `+${overflow}`,
    dateRangeDisplay: ({ start, end }) => `du ${start} au ${end}`,
    chartValuesJoin: (values) => values.join(" a "),
    widgetGridCell: ({ column, row, width, height }) =>
      `colonne ${column}, ligne ${row}, ${width} sur ${height}`,
    selectCountSelected: (count) => `${count} selectionne(s)`,
  })

  assert.equal(french.avatarOverflowMore(2), "2 de plus")
  assert.equal(
    french.dateRangeDisplay({ start: "2026-01-01", end: "2026-01-07" }),
    "du 2026-01-01 au 2026-01-07"
  )
  assert.equal(french.chartValuesJoin(["10", "20"]), "10 a 20")
  assert.equal(
    french.widgetGridCell({ column: 1, row: 2, width: 3, height: 4 }),
    "colonne 1, ligne 2, 3 sur 4"
  )
  assert.equal(french.selectCountSelected(3), "3 selectionne(s)")
})

test("enum helpers map stable ids to catalogue labels", () => {
  assert.equal(dfAvatarPresenceLabel(defaultStrings, "online"), "Online")
  assert.equal(dfAvatarPresenceLabel(defaultStrings, "away"), "Away")
  assert.equal(
    dfFormatToolbarCalloutLabel(defaultStrings, "tip"),
    "Tip"
  )
  assert.equal(dfColorPickerModeLabel(defaultStrings, "hsb"), "HSB")

  const local = mergeDfStrings({
    avatarPresenceOnline: "En ligne",
    formatToolbarCalloutTip: "Conseil",
    colorPickerModeHsb: "TSV",
  })
  assert.equal(dfAvatarPresenceLabel(local, "online"), "En ligne")
  assert.equal(dfFormatToolbarCalloutLabel(local, "tip"), "Conseil")
  assert.equal(dfColorPickerModeLabel(local, "hsb"), "TSV")
})

test("mergeDfStrings with no overrides returns the default catalogue", () => {
  assert.equal(mergeDfStrings(), defaultStrings)
  assert.equal(mergeDfStrings(undefined), defaultStrings)
})

test("label markers are complete strings with punctuation", () => {
  assert.equal(defaultStrings.labelRequired, "(required)")
  assert.equal(defaultStrings.labelOptional, "(optional)")
  assert.equal(defaultStrings.labelAsterisk, "*")

  const local = mergeDfStrings({
    labelRequired: "*obligatoire",
    labelOptional: "facultatif",
    labelAsterisk: "※",
  })
  assert.equal(local.labelRequired, "*obligatoire")
  assert.equal(local.labelOptional, "facultatif")
  assert.equal(local.labelAsterisk, "※")
})
