export function shouldInsertSidebarContentSeparator(
  isSeparatorAtIndex: readonly boolean[],
  index: number
): boolean {
  if (index <= 0 || index >= isSeparatorAtIndex.length) return false
  return !isSeparatorAtIndex[index] && !isSeparatorAtIndex[index - 1]
}
