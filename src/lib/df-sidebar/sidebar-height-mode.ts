export type SidebarHeightMode = "fill" | "fixed" | "auto"

/** Resolve provider height mode. `height` wins over `fillHeight`. */
export function resolveSidebarHeightMode(
  height: string | undefined,
  fillHeight: boolean
): SidebarHeightMode {
  if (height != null) return "fixed"
  return fillHeight ? "fill" : "auto"
}
