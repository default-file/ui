import assert from "node:assert/strict"
import { test } from "node:test"

import { createStore } from "./index.ts"

test("df-store updates subscribers", () => {
  const store = createStore({ count: 0 })
  let seen = 0
  const unsubscribe = store.subscribe(() => {
    seen = store.getState().count
  })
  store.setState({ count: 3 })
  assert.equal(seen, 3)
  store.setState((state) => ({ count: state.count + 1 }))
  assert.equal(store.getState().count, 4)
  unsubscribe()
})

test("df-store strips prototype keys from setState partials", () => {
  const store = createStore({ count: 1, label: "ok" })
  const polluted = JSON.parse('{"count": 9, "__proto__": {"polluted": true}}') as {
    count: number
    __proto__: { polluted: boolean }
  }
  store.setState(polluted)
  const state = store.getState() as Record<string, unknown>
  assert.equal(state.count, 9)
  assert.equal(Object.hasOwn(state, "__proto__"), false)
  assert.equal(Object.prototype.hasOwnProperty.call(state, "polluted"), false)

  store.setState({
    constructor: "nope",
    prototype: "nope",
  } as Partial<{ count: number; label: string }>)
  assert.equal(Object.hasOwn(store.getState() as object, "constructor"), false)
  assert.equal(Object.hasOwn(store.getState() as object, "prototype"), false)
  assert.equal(store.getState().label, "ok")
})
