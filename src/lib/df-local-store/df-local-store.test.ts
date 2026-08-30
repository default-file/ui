import assert from "node:assert/strict"
import { test } from "node:test"

import {
  createEntry,
  createMemoryLocalStore,
  isStale,
  isVersionMismatch,
  namespaceKey,
  readFreshValue,
} from "./index.ts"

test("namespaceKey joins trimmed non-empty segments", () => {
  assert.equal(namespaceKey("ws", " member ", "board"), "ws/member/board")
  assert.equal(namespaceKey("", "a", "  ", "b"), "a/b")
})

test("createEntry stamps version and updatedAt", () => {
  const entry = createEntry({ x: 1 }, 3, 1_700_000_000_000)
  assert.deepEqual(entry, {
    version: 3,
    updatedAt: 1_700_000_000_000,
    value: { x: 1 },
  })
})

test("isVersionMismatch and isStale", () => {
  const entry = createEntry("v", 2, 1000)
  assert.equal(isVersionMismatch(entry, 2), false)
  assert.equal(isVersionMismatch(entry, 3), true)
  assert.equal(isStale(entry, 500, 1499), false)
  assert.equal(isStale(entry, 500, 1501), true)
  assert.equal(isStale(entry, 500, 1500), false)
})

test("readFreshValue discards version bump and age", () => {
  const entry = createEntry({ ok: true }, 1, 1000)
  assert.deepEqual(readFreshValue(entry, 1, 1000, 2000), { ok: true })
  assert.equal(readFreshValue(entry, 2, 1000, 2000), undefined)
  assert.equal(readFreshValue(entry, 1, 999, 2000), undefined)
  assert.equal(readFreshValue(undefined, 1, 1000, 2000), undefined)
})

test("memory adapter honors LocalStore contract", async () => {
  const store = createMemoryLocalStore()
  const write = await store.set("a/b", createEntry({ n: 1 }, 1, 10))
  assert.equal(write.ok, true)

  const got = await store.get<{ n: number }>("a/b")
  assert.deepEqual(got, { version: 1, updatedAt: 10, value: { n: 1 } })

  await store.set("a/c", createEntry({ n: 2 }, 1, 11))
  await store.set("z", createEntry(null, 1, 12))
  assert.deepEqual(await store.keys("a/"), ["a/b", "a/c"])
  assert.deepEqual(await store.keys(), ["a/b", "a/c", "z"])

  const del = await store.delete("a/b")
  assert.equal(del.ok, true)
  assert.equal(await store.get("a/b"), undefined)

  const cleared = await store.clear()
  assert.equal(cleared.ok, true)
  assert.deepEqual(await store.keys(), [])
})
