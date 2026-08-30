/** Result of a durable write attempt. */
export type LocalStoreWriteStatus =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "quota" | "error"; message?: string }

/** Persisted envelope around a stored value. */
export type LocalStoreEntry<T> = {
  version: number
  updatedAt: number
  value: T
}

/** Typed async key value store with per entry metadata. */
export type LocalStore = {
  get<T>(key: string): Promise<LocalStoreEntry<T> | undefined>
  set<T>(key: string, entry: LocalStoreEntry<T>): Promise<LocalStoreWriteStatus>
  delete(key: string): Promise<LocalStoreWriteStatus>
  keys(prefix?: string): Promise<string[]>
  clear(): Promise<LocalStoreWriteStatus>
}
