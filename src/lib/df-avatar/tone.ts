/**
 * Mid tone kit scale steps used for initials avatars.
 * Values are CSS custom property names without the surrounding var().
 */
export const AVATAR_TONE_TOKENS = [
  "--df-blue-400",
  "--df-green-400",
  "--df-purple-400",
  "--df-orange-400",
  "--df-teal-400",
  "--df-rose-400",
  "--df-indigo-400",
  "--df-amber-400",
  "--df-cyan-400",
  "--df-violet-400",
  "--df-emerald-400",
  "--df-coral-400",
  "--df-fuchsia-400",
  "--df-jade-400",
  "--df-orchid-400",
  "--df-azure-400",
] as const

export type AvatarToneToken = (typeof AVATAR_TONE_TOKENS)[number]

/** Stable hash of a display name. Not for cryptography. */
export function hashName(name: string): number {
  let hash = 2166136261
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Pick a deterministic kit tone token for a display name. */
export function avatarToneToken(name: string): AvatarToneToken {
  const index = hashName(name.trim() || "?") % AVATAR_TONE_TOKENS.length
  return AVATAR_TONE_TOKENS[index]!
}

/** CSS `var(--…)` reference for the hashed avatar tone. */
export function avatarToneVar(name: string): string {
  return `var(${avatarToneToken(name)})`
}
