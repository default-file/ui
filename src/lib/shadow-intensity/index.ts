type DfShadowIntensityScaleStep =
  | "2xs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"

type DfShadowIntensityAlias = "subtle" | "default" | "strong"

type DfShadowIntensityStep = DfShadowIntensityScaleStep | DfShadowIntensityAlias

/** Named kit step or a 0 to 1 custom strength. */
type DfShadowIntensity = DfShadowIntensityStep | number

const DF_SHADOW_INTENSITY_BY_STEP: Record<DfShadowIntensityStep, string> = {
  "2xs": "var(--df-shadow-intensity-2xs)",
  xs: "var(--df-shadow-intensity-xs)",
  sm: "var(--df-shadow-intensity-sm)",
  md: "var(--df-shadow-intensity-md)",
  lg: "var(--df-shadow-intensity-lg)",
  xl: "var(--df-shadow-intensity-xl)",
  "2xl": "var(--df-shadow-intensity-2xl)",
  "3xl": "var(--df-shadow-intensity-3xl)",
  "4xl": "var(--df-shadow-intensity-4xl)",
  subtle: "var(--df-shadow-intensity-subtle)",
  default: "var(--df-shadow-intensity-default)",
  strong: "var(--df-shadow-intensity-strong)",
}

function clampUnit(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function resolveDfShadowIntensity(
  value: DfShadowIntensity | undefined
): string | undefined {
  if (value == null) return undefined
  if (typeof value === "number") {
    return `${Math.round(clampUnit(value) * 100)}%`
  }
  return DF_SHADOW_INTENSITY_BY_STEP[value]
}

export { DF_SHADOW_INTENSITY_BY_STEP, resolveDfShadowIntensity }
export type {
  DfShadowIntensity,
  DfShadowIntensityAlias,
  DfShadowIntensityScaleStep,
  DfShadowIntensityStep,
}
