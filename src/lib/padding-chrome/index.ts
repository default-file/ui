import type * as React from "react"

type PaddingChromeProps = {
  padding?: string | undefined
  paddingX?: string | undefined
  paddingY?: string | undefined
  paddingTop?: string | undefined
  paddingRight?: string | undefined
  paddingBottom?: string | undefined
  paddingLeft?: string | undefined
}

type ResolvedPaddingSides = {
  top?: string | undefined
  right?: string | undefined
  bottom?: string | undefined
  left?: string | undefined
}

function resolvePaddingSides({
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
}: PaddingChromeProps): ResolvedPaddingSides {
  return {
    top: paddingTop ?? paddingY ?? padding,
    right: paddingRight ?? paddingX ?? padding,
    bottom: paddingBottom ?? paddingY ?? padding,
    left: paddingLeft ?? paddingX ?? padding,
  }
}

function hasResolvedPadding(sides: ResolvedPaddingSides): boolean {
  return (
    sides.top != null ||
    sides.right != null ||
    sides.bottom != null ||
    sides.left != null
  )
}

function dfPaddingChromeStyle(
  varPrefix: string,
  sides: ResolvedPaddingSides
): React.CSSProperties {
  return {
    ...(sides.top != null ? { [`${varPrefix}-top`]: sides.top } : null),
    ...(sides.right != null ? { [`${varPrefix}-right`]: sides.right } : null),
    ...(sides.bottom != null ? { [`${varPrefix}-bottom`]: sides.bottom } : null),
    ...(sides.left != null ? { [`${varPrefix}-left`]: sides.left } : null),
  } as React.CSSProperties
}

export {
  dfPaddingChromeStyle,
  hasResolvedPadding,
  resolvePaddingSides,
}
export type { PaddingChromeProps, ResolvedPaddingSides }
