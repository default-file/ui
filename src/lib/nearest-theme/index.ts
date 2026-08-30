/**
 * Returns "dark" when the node sits under a .dark ancestor so portaled
 * overlays can carry the same theme tokens outside that subtree.
 */
function nearestDarkClass(
  node: Element | null | undefined
): "dark" | undefined {
  if (node == null || typeof node.closest !== "function") return undefined
  return node.closest(".dark") != null ? "dark" : undefined
}

export { nearestDarkClass }
