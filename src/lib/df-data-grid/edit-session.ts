export type EditSessionAction = "commit" | "cancel" | "ignore"

export type EditSessionEventInput =
  | {
      kind: "keydown"
      key: string
      defaultPrevented?: boolean
    }
  | {
      kind: "focusout"
      focusRemainsInCell: boolean
      defaultPrevented?: boolean
    }

/**
 * Resolve Enter, Escape, and focus leave while a cell is in edit mode.
 * Events already handled by the editor (defaultPrevented) are left alone.
 */
export function resolveEditSessionEvent(
  input: EditSessionEventInput
): EditSessionAction {
  if (input.defaultPrevented) return "ignore"

  if (input.kind === "focusout") {
    return input.focusRemainsInCell ? "ignore" : "commit"
  }

  if (input.key === "Enter") return "commit"
  if (input.key === "Escape") return "cancel"
  return "ignore"
}
