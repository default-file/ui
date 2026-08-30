type DfCornerShape = "round" | "smooth"

const DF_CORNER_SHAPE_VAR: Record<DfCornerShape, string> = {
  round: "var(--df-corner-shape-round)",
  smooth: "var(--df-corner-shape-smooth)",
}

function dfCornerShapeStyle(
  cornerShape: DfCornerShape | undefined
): { "--df-corner-shape": string } | undefined {
  if (cornerShape == null) return undefined
  return { "--df-corner-shape": DF_CORNER_SHAPE_VAR[cornerShape] }
}

export { DF_CORNER_SHAPE_VAR, dfCornerShapeStyle }
export type { DfCornerShape }
