import { useSyncExternalStore } from "react"

export type Listener = () => void

export type StoreApi<T> = {
  getState: () => T
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void
  subscribe: (listener: Listener) => () => void
}

const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"])

function stripPrototypeKeys<T extends object>(partial: Partial<T>): Partial<T> {
  const clean: Partial<T> = {}
  for (const key of Object.keys(partial) as Array<keyof T & string>) {
    if (PROTOTYPE_KEYS.has(key)) continue
    clean[key] = partial[key]
  }
  return clean
}

export function createStore<T extends object>(initial: T): StoreApi<T> {
  let state = initial
  const listeners = new Set<Listener>()

  return {
    getState() {
      return state
    },
    setState(partial) {
      const nextPartial =
        typeof partial === "function" ? partial(state) : partial
      state = { ...state, ...stripPrototypeKeys(nextPartial) }
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function useStore<T extends object, S>(
  store: StoreApi<T>,
  select: (state: T) => S
): S {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getState()),
    () => select(store.getState())
  )
}
