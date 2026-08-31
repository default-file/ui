import assert from "node:assert/strict"
import { test } from "node:test"

import { childEnv } from "./fs-utils.mjs"

test("childEnv drops the runner invocation config", () => {
  const env = childEnv({
    npm_config_package: "@default-file/ui",
    npm_config_call: "df-ui init",
    PATH: "/usr/bin",
  })
  assert.equal(env.npm_config_package, undefined)
  assert.equal(env.npm_config_call, undefined)
  assert.equal(env.PATH, "/usr/bin")
})

test("childEnv ignores key casing", () => {
  const env = childEnv({ NPM_CONFIG_PACKAGE: "@default-file/ui" })
  assert.deepEqual(Object.keys(env), [])
})

test("childEnv keeps registry, cache, and proxy settings", () => {
  const env = childEnv({
    npm_config_registry: "https://registry.example.com/",
    npm_config_cache: "/tmp/npm-cache",
    npm_config_userconfig: "/home/dev/.npmrc",
    npm_config_https_proxy: "http://proxy.example.com:8080",
    npm_config_user_agent: "pnpm/11.2.2 npm/? node/v25.8.0",
  })
  assert.equal(env.npm_config_registry, "https://registry.example.com/")
  assert.equal(env.npm_config_cache, "/tmp/npm-cache")
  assert.equal(env.npm_config_userconfig, "/home/dev/.npmrc")
  assert.equal(env.npm_config_https_proxy, "http://proxy.example.com:8080")
  assert.equal(env.npm_config_user_agent, "pnpm/11.2.2 npm/? node/v25.8.0")
})

test("childEnv omits unset keys", () => {
  const env = childEnv({ SET: "1", UNSET: undefined })
  assert.deepEqual(Object.keys(env), ["SET"])
})
