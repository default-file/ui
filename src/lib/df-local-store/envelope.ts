import type { LocalStoreEntry } from "./types"

/** Join namespace segments into a stable store key. */
export function namespaceKey(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("/")
}

/** Build a versioned entry with the current timestamp. */
export function createEntry<T>(
  value: T,
  version: number,
  updatedAt: number = Date.now()
): LocalStoreEntry<T> {
  return { version, updatedAt, value }
}

/** True when the entry schema version does not match the expected version. */
export function isVersionMismatch(
  entry: LocalStoreEntry<unknown>,
  expectedVersion: number
): boolean {
  return entry.version !== expectedVersion
}

/**
 * True when the entry is older than maxAgeMs relative to nowMs.
 * Entries at exactly maxAgeMs remain usable.
 */
export function isStale(
  entry: LocalStoreEntry<unknown>,
  maxAgeMs: number,
  nowMs: number = Date.now()
): boolean {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) return true
  if (!Number.isFinite(entry.updatedAt)) return true
  return nowMs - entry.updatedAt > maxAgeMs
}

/** Return the entry value when version and age checks pass; otherwise undefined. */
export function readFreshValue<T>(
  entry: LocalStoreEntry<T> | undefined,
  expectedVersion: number,
  maxAgeMs: number,
  nowMs: number = Date.now()
): T | undefined {
  if (!entry) return undefined
  if (isVersionMismatch(entry, expectedVersion)) return undefined
  if (isStale(entry, maxAgeMs, nowMs)) return undefined
  return entry.value
}
