import assert from "node:assert/strict"
import { test } from "node:test"

import { tweenNumber } from "./index.ts"

function installAnimationFramePolyfill() {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return () => {}
  }
  const originalRequest = globalThis.requestAnimationFrame
  const originalCancel = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    return setTimeout(() => callback(performance.now()), 0) as unknown as number
  }) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number) => {
    clearTimeout(id)
  }) as typeof cancelAnimationFrame
  return () => {
    globalThis.requestAnimationFrame = originalRequest
    globalThis.cancelAnimationFrame = originalCancel
  }
}

test("tweenNumber cancel clears the wait timer before frames run", async () => {
  const restore = installAnimationFramePolyfill()
  try {
    let frames = 0
    const cancel = tweenNumber({
      from: 0,
      to: 100,
      ms: 50,
      waitMs: 20,
      onFrame: () => {
        frames += 1
      },
    })
    cancel()
    await new Promise((resolve) => setTimeout(resolve, 60))
    assert.equal(frames, 0)
  } finally {
    restore()
  }
})

test("tweenNumber calls onDone exactly once when the tween settles", async () => {
  const restore = installAnimationFramePolyfill()
  try {
    let frames = 0
    let doneCount = 0
    tweenNumber({
      from: 0,
      to: 10,
      ms: 30,
      waitMs: 0,
      onFrame: () => {
        frames += 1
      },
      onDone: () => {
        doneCount += 1
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 120))
    assert.ok(frames > 0)
    assert.equal(doneCount, 1)
  } finally {
    restore()
  }
})

test("tweenNumber does not call onDone after cancel", async () => {
  const restore = installAnimationFramePolyfill()
  try {
    let doneCount = 0
    const cancel = tweenNumber({
      from: 0,
      to: 10,
      ms: 40,
      waitMs: 10,
      onFrame: () => {},
      onDone: () => {
        doneCount += 1
      },
    })
    cancel()
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.equal(doneCount, 0)
  } finally {
    restore()
  }
})

test("tweenNumber with ms 0 jumps to the final value once", async () => {
  const restore = installAnimationFramePolyfill()
  try {
    const frames: number[] = []
    let doneCount = 0
    tweenNumber({
      from: 0,
      to: 42,
      ms: 0,
      waitMs: 0,
      onFrame: (value) => {
        frames.push(value)
      },
      onDone: () => {
        doneCount += 1
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(frames, [42])
    assert.equal(doneCount, 1)
    assert.ok(Number.isFinite(frames[0]))
  } finally {
    restore()
  }
})

test("tweenNumber honours reduced motion by delivering the final value once", async () => {
  const restore = installAnimationFramePolyfill()
  const previousWindow = globalThis.window
  const media = {
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
    onchange: null,
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      matchMedia(query: string) {
        return {
          ...media,
          matches: String(query).includes("prefers-reduced-motion"),
          media: query,
        }
      },
    },
  })

  try {
    const frames: number[] = []
    let doneCount = 0
    tweenNumber({
      from: 0,
      to: 100,
      ms: 500,
      waitMs: 0,
      onFrame: (value) => {
        frames.push(value)
      },
      onDone: () => {
        doneCount += 1
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.deepEqual(frames, [100])
    assert.equal(doneCount, 1)
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: previousWindow,
    })
    restore()
  }
})
