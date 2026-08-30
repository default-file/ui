import type { LocalStore, LocalStoreEntry, LocalStoreWriteStatus } from "./types"

/** In memory LocalStore for tests and SSR guards. */
export function createMemoryLocalStore(): LocalStore {
  const map = new Map<string, LocalStoreEntry<unknown>>()

  return {
    async get<T>(key: string): Promise<LocalStoreEntry<T> | undefined> {
      const entry = map.get(key)
      if (!entry) return undefined
      return entry as LocalStoreEntry<T>
    },

    async set<T>(
      key: string,
      entry: LocalStoreEntry<T>
    ): Promise<LocalStoreWriteStatus> {
      map.set(key, entry)
      return { ok: true }
    },

    async delete(key: string): Promise<LocalStoreWriteStatus> {
      map.delete(key)
      return { ok: true }
    },

    async keys(prefix?: string): Promise<string[]> {
      const all = [...map.keys()].sort()
      if (prefix == null || prefix === "") return all
      return all.filter((key) => key.startsWith(prefix))
    },

    async clear(): Promise<LocalStoreWriteStatus> {
      map.clear()
      return { ok: true }
    },
  }
}
