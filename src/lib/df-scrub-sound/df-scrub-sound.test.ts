import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"

import {
  clearUiScrubSoundFailure,
  getUiScrubSoundFailure,
  isUiScrubSoundAvailable,
  startUiScrub,
  stopUiScrub,
  updateUiScrub,
} from "./index.ts"

const globalRef = globalThis as typeof globalThis & {
  window?: Window & typeof globalThis
  document?: Document
}

type StopMode = "ok" | "fail" | "invalid-state"

let stopMode: StopMode = "ok"
let oscCreated = 0

function installAudioGlobals() {
  stopMode = "ok"
  oscCreated = 0

  class FakeOscillator {
    type = "sine"
    frequency = { value: 0, setTargetAtTime() {} }
    context = { currentTime: 0 }
    connect() {
      return this
    }
    start() {}
    stop() {
      if (stopMode === "fail") {
        throw new Error("unexpected scrub graph failure")
      }
      if (stopMode === "invalid-state") {
        throw new DOMException("already stopped", "InvalidStateError")
      }
    }
    disconnect() {}
  }

  class FakeFilter {
    type = "lowpass"
    frequency = { value: 0, setTargetAtTime() {} }
    Q = { value: 0 }
    connect() {
      return this
    }
    disconnect() {}
  }

  class FakeGain {
    gain = {
      value: 0,
      setTargetAtTime() {},
      cancelScheduledValues() {},
    }
    connect() {
      return this
    }
    disconnect() {}
  }

  class FakeAudioContext {
    state = "running"
    destination = {}
    currentTime = 0
    resume() {
      return Promise.resolve()
    }
    createOscillator() {
      oscCreated += 1
      return new FakeOscillator()
    }
    createBiquadFilter() {
      return new FakeFilter()
    }
    createGain() {
      return new FakeGain()
    }
  }

  globalRef.window = {
    AudioContext: FakeAudioContext,
    matchMedia: () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    }),
  } as unknown as Window & typeof globalThis

  globalRef.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document
}

/** Cancel any fade timer and leave the module with no active session. */
function resetScrubModule() {
  stopMode = "ok"
  clearUiScrubSoundFailure()
  startUiScrub(0)
  stopMode = "fail"
  startUiScrub(0)
  clearUiScrubSoundFailure()
  stopMode = "ok"
  oscCreated = 0
}

installAudioGlobals()

beforeEach(() => {
  resetScrubModule()
})

afterEach(() => {
  resetScrubModule()
})

test("startUiScrub dispose of a failing graph does not throw and clears session", () => {
  startUiScrub(0.25)
  assert.equal(oscCreated, 1)
  assert.equal(isUiScrubSoundAvailable(), true)

  stopMode = "fail"
  assert.doesNotThrow(() => {
    startUiScrub(0.75)
  })

  assert.equal(oscCreated, 1)
  assert.ok(getUiScrubSoundFailure() instanceof Error)
  assert.equal(isUiScrubSoundAvailable(), false)

  assert.doesNotThrow(() => {
    updateUiScrub(0.9)
    stopUiScrub()
    startUiScrub(0.5)
  })
  assert.equal(oscCreated, 1)

  clearUiScrubSoundFailure()
  stopMode = "ok"
  assert.doesNotThrow(() => {
    startUiScrub(0.4)
  })
  assert.equal(oscCreated, 2)
  assert.equal(getUiScrubSoundFailure(), null)
  assert.equal(isUiScrubSoundAvailable(), true)
})

test("InvalidStateError on stop is benign and leaves scrub available", () => {
  startUiScrub(0.1)
  assert.equal(oscCreated, 1)

  stopMode = "invalid-state"
  assert.doesNotThrow(() => {
    startUiScrub(0.2)
  })

  assert.equal(oscCreated, 2)
  assert.equal(getUiScrubSoundFailure(), null)
  assert.equal(isUiScrubSoundAvailable(), true)

  assert.doesNotThrow(() => {
    updateUiScrub(0.55)
  })
})

test("stopUiScrub timer dispose never surfaces an unhandled error", async () => {
  startUiScrub(0.4)
  assert.equal(oscCreated, 1)

  const uncaught: unknown[] = []
  const onUncaught = (error: unknown) => {
    uncaught.push(error)
  }
  process.on("uncaughtException", onUncaught)

  stopMode = "fail"
  assert.doesNotThrow(() => {
    stopUiScrub()
  })

  await new Promise((resolve) => setTimeout(resolve, 180))

  process.off("uncaughtException", onUncaught)

  assert.deepEqual(uncaught, [])
  assert.ok(getUiScrubSoundFailure() instanceof Error)
  assert.equal(isUiScrubSoundAvailable(), false)
})
