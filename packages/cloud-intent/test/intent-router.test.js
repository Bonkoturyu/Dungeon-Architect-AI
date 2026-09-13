import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESIGN_INTENT } from "../../intent/src/design-intent.js";
import {
  MAX_LLM_ATTEMPTS,
  parseRetryAfterMs,
  routeDesignIntent
} from "../src/intent-router.js";

function validIntent(overrides = {}) {
  return { ...DEFAULT_DESIGN_INTENT, ...overrides };
}

function ok(intent = validIntent(), meta = {}) {
  return { ok: true, intent, meta };
}

function fail(code, extra = {}) {
  return { ok: false, error: { code, message: code, ...extra } };
}

function sequence(values, counter = null) {
  let index = 0;
  return async () => {
    if (counter) counter.count += 1;
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

const allCapabilities = Object.freeze({
  cloudConfigured: true,
  cloudProxyHealthy: true,
  localModelCached: true,
  webgpuAvailable: true
});

const cloudOnlyCapabilities = Object.freeze({
  cloudConfigured: true,
  cloudProxyHealthy: true,
  localModelCached: false,
  webgpuAvailable: false
});

test("cloud first success ends routing immediately", async () => {
  const localCounter = { count: 0 };
  const result = await routeDesignIntent("hard but fair", {
    capabilities: allCapabilities,
    cloudAttempt: sequence([ok(validIntent({ targetDifficulty: 0.8 }), { provider: "openai" })]),
    localAttempt: sequence([ok()], localCounter)
  });

  assert.equal(result.status, "success");
  assert.equal(result.selectedProvider, "cloud");
  assert.equal(result.intent.targetDifficulty, 0.8);
  assert.deepEqual(result.attempts.map((entry) => entry.provider), ["cloud"]);
  assert.equal(localCounter.count, 0);
});

test("cloud invalid output retries once and then succeeds", async () => {
  const counter = { count: 0 };
  const result = await routeDesignIntent("exploration", {
    capabilities: cloudOnlyCapabilities,
    cloudAttempt: sequence([
      fail("PROVIDER_INTENT_INVALID"),
      ok(validIntent({ exploration: 0.9 }))
    ], counter)
  });

  assert.equal(result.status, "success");
  assert.equal(result.selectedProvider, "cloud");
  assert.equal(counter.count, 2);
  assert.equal(result.attempts.length, MAX_LLM_ATTEMPTS);
  assert.deepEqual(result.attempts.map((entry) => entry.outcome), ["invalid", "valid"]);
});

test("two cloud timeouts fall through to eligible local source", async () => {
  const result = await routeDesignIntent("short dungeon", {
    capabilities: allCapabilities,
    cloudAttempt: sequence([
      fail("TEST_TIMEOUT", { category: "timeout" }),
      fail("TEST_TIMEOUT", { category: "timeout" })
    ]),
    localAttempt: sequence([ok(validIntent({ targetDuration: 300 }), { provider: "local" })])
  });

  assert.equal(result.status, "success");
  assert.equal(result.selectedProvider, "local");
  assert.deepEqual(result.attempts.map((entry) => entry.provider), ["cloud", "cloud", "local"]);
});

test("no eligible LLM source uses deterministic fallback once", async () => {
  const result = await routeDesignIntent("初心者向けで短いダンジョン", {
    capabilities: {
      cloudConfigured: false,
      cloudProxyHealthy: false,
      localModelCached: false,
      webgpuAvailable: false
    }
  });

  assert.equal(result.status, "success");
  assert.equal(result.selectedProvider, "fallback");
  assert.deepEqual(result.attempts.map((entry) => entry.provider), ["fallback"]);
  assert.equal(result.intent.targetDuration, 300);
});

test("cancelled cloud attempt stops routing without local or fallback", async () => {
  const localCounter = { count: 0 };
  const fallbackCounter = { count: 0 };
  const result = await routeDesignIntent("cancel case", {
    capabilities: allCapabilities,
    cloudAttempt: sequence([fail("LOCAL_CANCELLED")]),
    localAttempt: sequence([ok()], localCounter),
    fallbackAttempt: sequence([ok()], fallbackCounter)
  });

  assert.equal(result.status, "cancelled");
  assert.equal(result.selectedProvider, null);
  assert.equal(localCounter.count, 0);
  assert.equal(fallbackCounter.count, 0);
  assert.deepEqual(result.attempts.map((entry) => entry.provider), ["cloud"]);
});

test("all LLM invalid attempts converge to deterministic fallback", async () => {
  const result = await routeDesignIntent("fallback after invalid", {
    capabilities: allCapabilities,
    cloudAttempt: sequence([
      fail("PROVIDER_INTENT_INVALID"),
      fail("PROVIDER_INTENT_INVALID")
    ]),
    localAttempt: sequence([
      fail("LOCAL_INTENT_INVALID"),
      fail("LOCAL_INTENT_INVALID")
    ])
  });

  assert.equal(result.status, "success");
  assert.equal(result.selectedProvider, "fallback");
  assert.deepEqual(
    result.attempts.map((entry) => entry.provider),
    ["cloud", "cloud", "local", "local", "fallback"]
  );
});

test("fallback failure is explicit and never retried", async () => {
  const fallbackCounter = { count: 0 };
  const result = await routeDesignIntent("bad fallback", {
    capabilities: {},
    fallbackAttempt: sequence([{ ok: true, intent: { schemaVersion: "1.0" } }], fallbackCounter)
  });

  assert.equal(result.status, "failed");
  assert.equal(result.error.code, "FALLBACK_FAILED");
  assert.equal(fallbackCounter.count, 1);
  assert.deepEqual(result.attempts.map((entry) => entry.provider), ["fallback"]);
});

test("LLM sources never exceed two attempts", async () => {
  const counter = { count: 0 };
  const result = await routeDesignIntent("bounded retry", {
    capabilities: cloudOnlyCapabilities,
    cloudAttempt: sequence([
      fail("PROVIDER_INTENT_INVALID"),
      fail("PROVIDER_INTENT_INVALID"),
      ok()
    ], counter)
  });

  assert.equal(counter.count, 2);
  assert.equal(result.selectedProvider, "fallback");
  assert.deepEqual(result.attempts.map((entry) => entry.provider), ["cloud", "cloud", "fallback"]);
});

test("Retry-After is observed before the single cloud retry", async () => {
  const waits = [];
  const result = await routeDesignIntent("rate limited", {
    capabilities: cloudOnlyCapabilities,
    cloudAttempt: sequence([
      fail("PROVIDER_RATE_LIMITED", { retryAfter: "0.25" }),
      ok()
    ]),
    wait: async (ms) => { waits.push(ms); }
  });

  assert.equal(result.selectedProvider, "cloud");
  assert.deepEqual(waits, [250]);
  assert.equal(result.attempts[0].retryAfter, "0.25");
  assert.equal(result.attempts[0].retryDelayMs, 250);
});

test("Retry-After beyond routing budget suppresses cloud retry", async () => {
  const waits = [];
  const cloudCounter = { count: 0 };
  const result = await routeDesignIntent("long retry after", {
    capabilities: cloudOnlyCapabilities,
    cloudAttempt: sequence([
      fail("PROVIDER_RATE_LIMITED", { retryAfter: "9" }),
      ok()
    ], cloudCounter),
    maxRetryDelayMs: 5000,
    wait: async (ms) => { waits.push(ms); }
  });

  assert.equal(cloudCounter.count, 1);
  assert.deepEqual(waits, []);
  assert.equal(result.selectedProvider, "fallback");
  assert.equal(result.attempts[0].retrySuppressed, "retry-after-exceeds-budget");
});

test("attempt timeout is finite even when source ignores AbortSignal", async () => {
  const started = Date.now();
  const result = await routeDesignIntent("non cooperative timeout", {
    capabilities: cloudOnlyCapabilities,
    cloudAttempt: async () => new Promise(() => {}),
    attemptTimeoutMs: 5
  });

  assert.equal(result.status, "success");
  assert.equal(result.selectedProvider, "fallback");
  assert.deepEqual(result.attempts.map((entry) => entry.outcome), ["timeout", "timeout", "valid"]);
  assert.ok(Date.now() - started < 500);
});

test("successful-looking invalid intent is independently rejected", async () => {
  const invalid = { ...validIntent(), providerOnlyField: "must-not-pass" };
  const result = await routeDesignIntent("semantic boundary", {
    capabilities: cloudOnlyCapabilities,
    cloudAttempt: sequence([ok(invalid), ok(invalid)])
  });

  assert.equal(result.selectedProvider, "fallback");
  assert.deepEqual(result.attempts.slice(0, 2).map((entry) => entry.outcome), ["invalid", "invalid"]);
});

test("routing trace never includes full prompt text", async () => {
  const prompt = "SECRET-LIKE-PROMPT-THAT-MUST-NOT-BE-LOGGED";
  const result = await routeDesignIntent(prompt, {
    capabilities: cloudOnlyCapabilities,
    cloudAttempt: sequence([fail("PROVIDER_TRANSPORT_ERROR"), fail("PROVIDER_TRANSPORT_ERROR")])
  });

  assert.equal(JSON.stringify(result.attempts).includes(prompt), false);
});

test("Retry-After supports both delta seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterMs("1.5", { nowMs: 0 }), 1500);
  assert.equal(
    parseRetryAfterMs("Thu, 01 Jan 1970 00:00:03 GMT", { nowMs: 1000 }),
    2000
  );
  assert.equal(parseRetryAfterMs("not-a-date", { nowMs: 0 }), null);
});
