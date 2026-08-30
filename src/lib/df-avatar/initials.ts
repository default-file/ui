/** Derive up to two initials from a display name. */
export function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0)
  const firstPart = parts[0]
  if (firstPart === undefined) return "?"
  if (parts.length === 1) {
    return Array.from(firstPart).slice(0, 2).join("").toUpperCase()
  }
  const lastPart = parts[parts.length - 1]
  if (lastPart === undefined) return "?"
  const first = Array.from(firstPart)[0] ?? ""
  const last = Array.from(lastPart)[0] ?? ""
  return `${first}${last}`.toUpperCase()
}
