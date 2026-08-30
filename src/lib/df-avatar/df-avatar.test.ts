import assert from "node:assert/strict"
import { test } from "node:test"

import { initialsFromName } from "./initials.ts"
import {
  AVATAR_TONE_TOKENS,
  avatarToneToken,
  avatarToneVar,
  hashName,
} from "./tone.ts"

test("initialsFromName uses first and last word", () => {
  assert.equal(initialsFromName("Ada Lovelace"), "AL")
  assert.equal(initialsFromName("  Grace  Hopper  "), "GH")
})

test("initialsFromName truncates a single word to two characters", () => {
  assert.equal(initialsFromName("Cher"), "CH")
  assert.equal(initialsFromName("A"), "A")
})

test("initialsFromName falls back for empty input", () => {
  assert.equal(initialsFromName(""), "?")
  assert.equal(initialsFromName("   "), "?")
})

test("hashName is stable and deterministic", () => {
  assert.equal(hashName("Ada Lovelace"), hashName("Ada Lovelace"))
  assert.notEqual(hashName("Ada Lovelace"), hashName("Grace Hopper"))
})

test("avatarToneToken maps into the kit tone ladder", () => {
  const tone = avatarToneToken("Ada Lovelace")
  assert.ok(AVATAR_TONE_TOKENS.includes(tone))
  assert.equal(avatarToneVar("Ada Lovelace"), `var(${tone})`)
})

test("avatarToneToken is stable for the same name", () => {
  assert.equal(avatarToneToken("Runway"), avatarToneToken("Runway"))
})
