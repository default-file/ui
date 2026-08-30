import type { LocalStore, LocalStoreEntry, LocalStoreWriteStatus } from "./types"

export const DF_LOCAL_STORE_DB_NAME = "df-local-store"
export const DF_LOCAL_STORE_DB_VERSION = 1
export const DF_LOCAL_STORE_OBJECT_STORE = "entries"

type IdbWindow = {
  indexedDB: IDBFactory
}

function getIdbFactory(): IDBFactory | null {
  if (typeof globalThis === "undefined") return null
  const candidate = globalThis as unknown as Partial<IdbWindow>
  return candidate.indexedDB ?? null
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted"))
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed"))
  })
}

function classifyWriteError(cause: unknown): LocalStoreWriteStatus {
  if (cause instanceof DOMException) {
    if (cause.name === "QuotaExceededError") {
      return { ok: false, reason: "quota", message: cause.message }
    }
    if (
      cause.name === "InvalidStateError" ||
      cause.name === "UnknownError" ||
      cause.name === "AbortError"
    ) {
      return { ok: false, reason: "unavailable", message: cause.message }
    }
  }
  if (cause instanceof Error) {
    const message = cause.message.toLowerCase()
    if (message.includes("quota")) {
      return { ok: false, reason: "quota", message: cause.message }
    }
    return { ok: false, reason: "error", message: cause.message }
  }
  return { ok: false, reason: "error" }
}

async function openDatabase(
  dbName: string,
  version: number,
  storeName: string
): Promise<IDBDatabase> {
  const factory = getIdbFactory()
  if (!factory) {
    throw new Error("IndexedDB unavailable")
  }
  return new Promise((resolve, reject) => {
    const request = factory.open(dbName, version)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    }
  })
}

export type IndexedDbLocalStoreOptions = {
  dbName?: string
  version?: number
  storeName?: string
}

type StoredRow = {
  key: string
  entry: LocalStoreEntry<unknown>
}

/**
 * IndexedDB LocalStore adapter.
 * Writes degrade to a reported noop when the database is unavailable or full.
 */
export function createIndexedDbLocalStore(
  options: IndexedDbLocalStoreOptions = {}
): LocalStore {
  const dbName = options.dbName ?? DF_LOCAL_STORE_DB_NAME
  const version = options.version ?? DF_LOCAL_STORE_DB_VERSION
  const storeName = options.storeName ?? DF_LOCAL_STORE_OBJECT_STORE

  let dbPromise: Promise<IDBDatabase> | null = null

  const open = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = openDatabase(dbName, version, storeName).catch((cause) => {
        dbPromise = null
        throw cause
      })
    }
    return dbPromise
  }

  return {
    async get<T>(key: string): Promise<LocalStoreEntry<T> | undefined> {
      if (!getIdbFactory()) return undefined
      try {
        const db = await open()
        const tx = db.transaction(storeName, "readonly")
        const store = tx.objectStore(storeName)
        const row = await requestToPromise<StoredRow | undefined>(
          store.get(key)
        )
        await transactionDone(tx)
        if (!row) return undefined
        return row.entry as LocalStoreEntry<T>
      } catch {
        return undefined
      }
    },

    async set<T>(
      key: string,
      entry: LocalStoreEntry<T>
    ): Promise<LocalStoreWriteStatus> {
      if (!getIdbFactory()) {
        return { ok: false, reason: "unavailable" }
      }
      try {
        const db = await open()
        const tx = db.transaction(storeName, "readwrite")
        const store = tx.objectStore(storeName)
        const row: StoredRow = { key, entry }
        store.put(row, key)
        await transactionDone(tx)
        return { ok: true }
      } catch (cause) {
        return classifyWriteError(cause)
      }
    },

    async delete(key: string): Promise<LocalStoreWriteStatus> {
      if (!getIdbFactory()) {
        return { ok: false, reason: "unavailable" }
      }
      try {
        const db = await open()
        const tx = db.transaction(storeName, "readwrite")
        const store = tx.objectStore(storeName)
        store.delete(key)
        await transactionDone(tx)
        return { ok: true }
      } catch (cause) {
        return classifyWriteError(cause)
      }
    },

    async keys(prefix?: string): Promise<string[]> {
      if (!getIdbFactory()) return []
      try {
        const db = await open()
        const tx = db.transaction(storeName, "readonly")
        const store = tx.objectStore(storeName)
        const all = await requestToPromise<IDBValidKey[]>(store.getAllKeys())
        await transactionDone(tx)
        const asStrings = all
          .filter((key): key is string => typeof key === "string")
          .sort()
        if (prefix == null || prefix === "") return asStrings
        return asStrings.filter((key) => key.startsWith(prefix))
      } catch {
        return []
      }
    },

    async clear(): Promise<LocalStoreWriteStatus> {
      if (!getIdbFactory()) {
        return { ok: false, reason: "unavailable" }
      }
      try {
        const db = await open()
        const tx = db.transaction(storeName, "readwrite")
        const store = tx.objectStore(storeName)
        store.clear()
        await transactionDone(tx)
        return { ok: true }
      } catch (cause) {
        return classifyWriteError(cause)
      }
    },
  }
}
