import assert from "node:assert/strict"
import { test } from "node:test"

import { number, object, string } from "./index.ts"

test("df-schema safeParse accepts valid objects", () => {
  const schema = object({
    id: string({ min: 1 }),
    count: number({ int: true, min: 0 }),
  })
  const result = schema.safeParse({ id: "a", count: 2 })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.data, { id: "a", count: 2 })
  }
})

test("df-schema safeParse rejects invalid values", () => {
  const schema = object({ id: string({ min: 2 }) })
  const result = schema.safeParse({ id: "x" })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.issues.length > 0)
  }
})
