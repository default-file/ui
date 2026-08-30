type DfHoverBorderAttr = "true" | "false"

type DfHoverBorderColorVar =
  | "--df-input-hover-border"
  | "--df-select-hover-border"
  | "--df-color-picker-hover-border"

function dfHoverBorderAttr(
  hoverBorder: boolean | undefined
): DfHoverBorderAttr | undefined {
  if (hoverBorder === undefined) return undefined
  return hoverBorder ? "true" : "false"
}

function dfHoverBorderColorStyle(
  cssVar: DfHoverBorderColorVar,
  hoverBorder: boolean | undefined,
  hoverBorderColor: string | undefined
): { [K in DfHoverBorderColorVar]?: string } | undefined {
  if (hoverBorder === false || hoverBorderColor == null) return undefined
  return { [cssVar]: hoverBorderColor }
}

export { dfHoverBorderAttr, dfHoverBorderColorStyle }
export type { DfHoverBorderAttr, DfHoverBorderColorVar }
