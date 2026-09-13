import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import {
  MAX_LLM_ATTEMPTS,
  routeDesignIntent,
} from '../packages/cloud-intent/src/intent-router.js';

const outputDir = path.resolve('artifacts/intent-routing');
const prompt = 'A tense but fair dungeon with exploration and meaningful route choices.';

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

const allCapabilities = {
  cloudConfigured: true,
  cloudProxyHealthy: true,
  localModelCached: true,
  webgpuAvailable: true,
};

const cloudOnlyCapabilities = {
  cloudConfigured: true,
  cloudProxyHealthy: true,
  localModelCached: false,
  webgpuAvailable: false,
};

const scenarios = {};

scenarios.cloudFirstSuccess = await routeDesignIntent(prompt, {
  capabilities: allCapabilities,
  cloudAttempt: sequence([ok(validIntent({ tension: 0.82 }), { provider: 'openai' })]),
  localAttempt: sequence([ok()]),
});

scenarios.cloudRetrySuccess = await routeDesignIntent(prompt, {
  capabilities: cloudOnlyCapabilities,
  cloudAttempt: sequence([
    fail('PROVIDER_INTENT_INVALID'),
    ok(validIntent({ fairness: 0.84 })),
  ]),
});

scenarios.cloudTimeoutToLocal = await routeDesignIntent(prompt, {
  capabilities: allCapabilities,
  cloudAttempt: sequence([
    fail('TEST_TIMEOUT', { category: 'timeout' }),
    fail('TEST_TIMEOUT', { category: 'timeout' }),
  ]),
  localAttempt: sequence([ok(validIntent({ exploration: 0.86 }), { provider: 'local' })]),
});

scenarios.noLlmToFallback = await routeDesignIntent('初心者向けで短い探索ダンジョン', {
  capabilities: {
    cloudConfigured: false,
    cloudProxyHealthy: false,
    localModelCached: false,
    webgpuAvailable: false,
  },
});

const cancelLocalCounter = { count: 0 };
const cancelFallbackCounter = { count: 0 };
scenarios.cancelStopsRouting = await routeDesignIntent(prompt, {
  capabilities: allCapabilities,
  cloudAttempt: sequence([fail('TEST_CANCELLED', { category: 'cancelled' })]),
  localAttempt: sequence([ok()], cancelLocalCounter),
  fallbackAttempt: sequence([ok()], cancelFallbackCounter),
});

scenarios.allInvalidToFallback = await routeDesignIntent(prompt, {
  capabilities: allCapabilities,
  cloudAttempt: sequence([
    fail('PROVIDER_INTENT_INVALID'),
    fail('PROVIDER_INTENT_INVALID'),
  ]),
  localAttempt: sequence([
    fail('LOCAL_INTENT_INVALID'),
    fail('LOCAL_INTENT_INVALID'),
  ]),
});

const fallbackFailureCounter = { count: 0 };
scenarios.fallbackFailure = await routeDesignIntent(prompt, {
  capabilities: {},
  fallbackAttempt: sequence([{ ok: true, intent: { schemaVersion: '1.0' } }], fallbackFailureCounter),
});

const waits = [];
scenarios.retryAfterObserved = await routeDesignIntent(prompt, {
  capabilities: cloudOnlyCapabilities,
  cloudAttempt: sequence([
    fail('PROVIDER_RATE_LIMITED', { retryAfter: '0.25' }),
    ok(),
  ]),
  wait: async (ms) => { waits.push(ms); },
});

const longWaits = [];
const longRetryCounter = { count: 0 };
scenarios.retryAfterBudget = await routeDesignIntent(prompt, {
  capabilities: cloudOnlyCapabilities,
  cloudAttempt: sequence([
    fail('PROVIDER_RATE_LIMITED', { retryAfter: '9' }),
    ok(),
  ], longRetryCounter),
  maxRetryDelayMs: 5000,
  wait: async (ms) => { longWaits.push(ms); },
});

const timeoutStarted = Date.now();
scenarios.nonCooperativeTimeout = await routeDesignIntent(prompt, {
  capabilities: cloudOnlyCapabilities,
  cloudAttempt: async () => new Promise(() => {}),
  attemptTimeoutMs: 5,
});
const timeoutElapsedMs = Date.now() - timeoutStarted;

const secretLikePrompt = 'SECRET-LIKE-PROMPT-THAT-MUST-NOT-BE-LOGGED';
scenarios.traceSanitization = await routeDesignIntent(secretLikePrompt, {
  capabilities: cloudOnlyCapabilities,
  cloudAttempt: sequence([
    fail('PROVIDER_TRANSPORT_ERROR'),
    fail('PROVIDER_TRANSPORT_ERROR'),
  ]),
});

const checks = {
  maxAttemptsFixedAtTwo: MAX_LLM_ATTEMPTS === 2,
  cloudFirstSuccess:
    scenarios.cloudFirstSuccess.status === 'success' &&
    scenarios.cloudFirstSuccess.selectedProvider === 'cloud' &&
    JSON.stringify(scenarios.cloudFirstSuccess.attempts.map((entry) => entry.provider)) === JSON.stringify(['cloud']),
  cloudRetrySuccess:
    scenarios.cloudRetrySuccess.selectedProvider === 'cloud' &&
    JSON.stringify(scenarios.cloudRetrySuccess.attempts.map((entry) => entry.outcome)) === JSON.stringify(['invalid', 'valid']),
  timeoutFallsToLocal:
    scenarios.cloudTimeoutToLocal.selectedProvider === 'local' &&
    JSON.stringify(scenarios.cloudTimeoutToLocal.attempts.map((entry) => entry.provider)) === JSON.stringify(['cloud', 'cloud', 'local']),
  noLlmUsesFallback:
    scenarios.noLlmToFallback.selectedProvider === 'fallback' &&
    JSON.stringify(scenarios.noLlmToFallback.attempts.map((entry) => entry.provider)) === JSON.stringify(['fallback']),
  cancellationIsTerminal:
    scenarios.cancelStopsRouting.status === 'cancelled' &&
    cancelLocalCounter.count === 0 &&
    cancelFallbackCounter.count === 0 &&
    JSON.stringify(scenarios.cancelStopsRouting.attempts.map((entry) => entry.provider)) === JSON.stringify(['cloud']),
  allInvalidConvergesToFallback:
    scenarios.allInvalidToFallback.selectedProvider === 'fallback' &&
    JSON.stringify(scenarios.allInvalidToFallback.attempts.map((entry) => entry.provider)) ===
      JSON.stringify(['cloud', 'cloud', 'local', 'local', 'fallback']),
  fallbackFailureExplicit:
    scenarios.fallbackFailure.status === 'failed' &&
    scenarios.fallbackFailure.error?.code === 'FALLBACK_FAILED' &&
    fallbackFailureCounter.count === 1,
  retryAfterObserved:
    scenarios.retryAfterObserved.selectedProvider === 'cloud' &&
    JSON.stringify(waits) === JSON.stringify([250]) &&
    scenarios.retryAfterObserved.attempts[0]?.retryDelayMs === 250,
  retryAfterBudgetStopsRetry:
    longRetryCounter.count === 1 &&
    longWaits.length === 0 &&
    scenarios.retryAfterBudget.selectedProvider === 'fallback' &&
    scenarios.retryAfterBudget.attempts[0]?.retrySuppressed === 'retry-after-exceeds-budget',
  nonCooperativeTimeoutFinite:
    scenarios.nonCooperativeTimeout.selectedProvider === 'fallback' &&
    JSON.stringify(scenarios.nonCooperativeTimeout.attempts.map((entry) => entry.outcome)) ===
      JSON.stringify(['timeout', 'timeout', 'valid']) &&
    timeoutElapsedMs < 500,
  traceDoesNotContainPrompt:
    JSON.stringify(scenarios.traceSanitization.attempts).includes(secretLikePrompt) === false,
};

const passed = Object.values(checks).every(Boolean);
fs.mkdirSync(outputDir, { recursive: true });
const generatedAt = new Date().toISOString();

const evidence = {
  generatedAt,
  node: process.version,
  passed,
  liveProviderCallMade: false,
  liveLocalModelCallMade: false,
  checks,
  routingPolicy: {
    order: ['cloud', 'local', 'fallback'],
    maxLlmAttemptsPerSource: MAX_LLM_ATTEMPTS,
    fallbackAttempts: 1,
    cancelIsTerminal: true,
    defaultAttemptTimeoutMs: 15000,
    defaultMaxRetryDelayMs: 5000,
  },
  scenarioSummaries: Object.fromEntries(
    Object.entries(scenarios).map(([name, result]) => [name, {
      status: result.status,
      selectedProvider: result.selectedProvider,
      attemptProviders: result.attempts.map((entry) => entry.provider),
      attemptOutcomes: result.attempts.map((entry) => entry.outcome),
      retrySuppressed: result.attempts.map((entry) => entry.retrySuppressed ?? null),
      errorCode: result.error?.code ?? null,
    }])
  ),
  retryAfterWaitsMs: waits,
  retryAfterBudgetWaitsMs: longWaits,
  nonCooperativeTimeoutElapsedMs: timeoutElapsedMs,
};

const outputPath = path.join(outputDir, 'dai-044-intent-routing.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ generatedAt, passed, checks, outputPath }, null, 2));
if (!passed) process.exitCode = 1;
