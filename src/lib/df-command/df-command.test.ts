import assert from "node:assert/strict"
import { test } from "node:test"

import { mergeCommands, rankByQuery, rankRecentFirst } from "./rank.ts"
import { scoreFuzzy } from "./score.ts"

test("scoreFuzzy returns null when the query is not a subsequence", () => {
  assert.equal(scoreFuzzy("xyz", "Open file"), null)
})

test("scoreFuzzy rewards exact prefixes over scattered matches", () => {
  const prefix = scoreFuzzy("open", "Open file")
  const scattered = scoreFuzzy("open", "Shop menu")
  assert.ok(prefix)
  assert.ok(scattered)
  assert.ok(prefix.score > scattered.score)
})

test("scoreFuzzy rewards word-start matches", () => {
  const wordStart = scoreFuzzy("nf", "New file")
  const midWord = scoreFuzzy("nf", "Confetti")
  assert.ok(wordStart)
  assert.ok(midWord)
  assert.ok(wordStart.score > midWord.score)
})

test("scoreFuzzy rewards consecutive runs", () => {
  const consecutive = scoreFuzzy("fil", "Open file")
  const gapped = scoreFuzzy("fil", "Find item list")
  assert.ok(consecutive)
  assert.ok(gapped)
  assert.ok(consecutive.score > gapped.score)
})

test("scoreFuzzy returns highlight ranges for matched characters", () => {
  const match = scoreFuzzy("of", "Open file")
  assert.ok(match)
  assert.deepEqual(match.ranges, [
    { start: 0, end: 1 },
    { start: 5, end: 6 },
  ])
})

test("scoreFuzzy merges consecutive matched indices into one range", () => {
  const match = scoreFuzzy("open", "Open file")
  assert.ok(match)
  assert.deepEqual(match.ranges, [{ start: 0, end: 4 }])
})

test("rankByQuery orders by score and drops non-matches", () => {
  const ranked = rankByQuery(
    [
      { id: "1", label: "Close tab" },
      { id: "2", label: "Open file" },
      { id: "3", label: "Open folder", keywords: ["directory"] },
    ],
    "open"
  )
  assert.deepEqual(
    ranked.map((entry) => entry.command.id),
    ["2", "3"]
  )
  assert.ok((ranked[0]?.score ?? 0) >= (ranked[1]?.score ?? 0))
})

test("rankByQuery sorts lower rankTier before higher tiers", () => {
  const ranked = rankByQuery(
    [
      { id: "hit", label: "Open search hit", rankTier: 1 },
      { id: "local", label: "Open file", rankTier: 0 },
    ],
    "open"
  )
  assert.deepEqual(
    ranked.map((entry) => entry.command.id),
    ["local", "hit"]
  )
})

test("rankByQuery orders by score within the same rankTier", () => {
  const ranked = rankByQuery(
    [
      { id: "scattered", label: "Shop menu", rankTier: 1 },
      { id: "prefix", label: "Open file", rankTier: 1 },
      { id: "local", label: "Open folder", rankTier: 0 },
    ],
    "open"
  )
  assert.deepEqual(
    ranked.map((entry) => entry.command.id),
    ["local", "prefix", "scattered"]
  )
  assert.ok((ranked[1]?.score ?? 0) >= (ranked[2]?.score ?? 0))
})

test("rankByQuery treats missing rankTier as 0", () => {
  const ranked = rankByQuery(
    [
      { id: "deferred", label: "Open deferred", rankTier: 1 },
      { id: "default", label: "Open default" },
    ],
    "open"
  )
  assert.deepEqual(
    ranked.map((entry) => entry.command.id),
    ["default", "deferred"]
  )
})

test("rankRecentFirst places host recent ids first when query is empty", () => {
  const ranked = rankRecentFirst(
    [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" },
    ],
    ["c", "a"]
  )
  assert.deepEqual(
    ranked.map((entry) => entry.command.id),
    ["c", "a", "b"]
  )
})

test("rankRecentFirst ignores rankTier when the query is empty", () => {
  const ranked = rankRecentFirst(
    [
      { id: "a", label: "Alpha", rankTier: 1 },
      { id: "b", label: "Beta", rankTier: 0 },
      { id: "c", label: "Gamma", rankTier: 2 },
    ],
    ["c", "a"]
  )
  assert.deepEqual(
    ranked.map((entry) => entry.command.id),
    ["c", "a", "b"]
  )
})

test("mergeCommands prefers the first occurrence of an id", () => {
  const merged = mergeCommands(
    [{ id: "a", label: "Static A" }],
    [
      { id: "a", label: "Async A" },
      { id: "b", label: "Async B" },
    ]
  )
  assert.deepEqual(
    merged.map((entry) => entry.label),
    ["Static A", "Async B"]
  )
})
