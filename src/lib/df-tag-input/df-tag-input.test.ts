import assert from "node:assert/strict"
import { test } from "node:test"

import {
  canCommitTag,
  commitTagBatch,
  dedupeTags,
  filterTagSuggestions,
  TYPE_COMMIT_SEPARATORS,
  tagKey,
  tokenizeTagText,
} from "./tokenize.ts"

test("tokenizeTagText splits on commas, semicolons, and whitespace", () => {
  assert.deepEqual(tokenizeTagText("alpha, beta;gamma\ndelta"), [
    "alpha",
    "beta",
    "gamma",
    "delta",
  ])
})

test("tokenizeTagText splits space-separated paste into multiple tags", () => {
  assert.deepEqual(tokenizeTagText("a b c"), ["a", "b", "c"])
  assert.deepEqual(tokenizeTagText("design system  ship"), [
    "design",
    "system",
    "ship",
  ])
})

test("tokenizeTagText trims and drops empty parts", () => {
  assert.deepEqual(tokenizeTagText("  , alpha ,  ,beta,"), ["alpha", "beta"])
})

test("TYPE_COMMIT_SEPARATORS do not treat space as a separator", () => {
  assert.deepEqual(
    tokenizeTagText("design system", TYPE_COMMIT_SEPARATORS),
    ["design system"]
  )
})

test("tagKey normalizes case and surrounding space", () => {
  assert.equal(tagKey("  Design  "), "design")
})

test("dedupeTags keeps the first casing and drops later duplicates", () => {
  assert.deepEqual(dedupeTags(["Design", " design ", "Ship", "DESIGN"]), [
    "Design",
    "Ship",
  ])
})

test("canCommitTag rejects empty, duplicate, and max capacity", () => {
  assert.deepEqual(canCommitTag("  ", []), { ok: false, reason: "empty" })
  assert.deepEqual(canCommitTag("Design", ["design"]), {
    ok: false,
    reason: "duplicate",
  })
  assert.deepEqual(canCommitTag("New", ["a", "b"], 2), {
    ok: false,
    reason: "max",
  })
  assert.deepEqual(canCommitTag(" New ", ["a"]), { ok: true, tag: "New" })
})

test("commitTagBatch appends unique tokens and reports rejects", () => {
  const result = commitTagBatch("alpha, Alpha, beta, gamma", ["alpha"], {
    maxTags: 3,
  })
  assert.deepEqual(result.tags, ["alpha", "beta", "gamma"])
  assert.deepEqual(result.accepted, ["beta", "gamma"])
  assert.deepEqual(result.rejected, [
    { tag: "alpha", reason: "duplicate" },
    { tag: "Alpha", reason: "duplicate" },
  ])
})

test("commitTagBatch stops accepting once max is reached", () => {
  const result = commitTagBatch("one, two, three", ["keep"], { maxTags: 2 })
  assert.deepEqual(result.tags, ["keep", "one"])
  assert.deepEqual(result.accepted, ["one"])
  assert.ok(result.rejected.some((entry) => entry.reason === "max"))
})

test("filterTagSuggestions hides taken tags and matches the draft", () => {
  assert.deepEqual(
    filterTagSuggestions(["Design", "Ship", "Polish"], "shi", ["Design"]),
    ["Ship"]
  )
  assert.deepEqual(
    filterTagSuggestions(["Design", "Ship"], "", ["ship"]),
    ["Design"]
  )
})
