import assert from "node:assert/strict"
import { test } from "node:test"

import { composeEventHandlers } from "./index.ts"

test("composeEventHandlers runs ours when default is not prevented", () => {
  const calls: string[] = []
  const handler = composeEventHandlers(
    () => {
      calls.push("theirs")
    },
    () => {
      calls.push("ours")
    }
  )
  handler({ defaultPrevented: false })
  assert.deepEqual(calls, ["theirs", "ours"])
})

test("composeEventHandlers skips ours when consumer prevents default", () => {
  const calls: string[] = []
  const handler = composeEventHandlers(
    (event: { defaultPrevented: boolean; preventDefault: () => void }) => {
      calls.push("theirs")
      event.preventDefault()
    },
    () => {
      calls.push("ours")
    }
  )
  const event = {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
  handler(event)
  assert.deepEqual(calls, ["theirs"])
})
