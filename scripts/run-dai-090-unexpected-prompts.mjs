import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createOpenAIHttpTransport } from '../packages/cloud-intent/src/openai-http-transport.js';
import { generateOpenAIIntent } from '../packages/cloud-intent/src/cloud-intent-adapter.js';
import { routeDesignIntent } from '../packages/cloud-intent/src/intent-router.js';
import { validateDesignIntent } from '../packages/intent/src/design-intent.js';

const fixturePath = path.resolve(
  'spec/design-intent/fixtures/dai-090-unexpected-prompts-v1.json',
);
const outputDir = path.resolve('artifacts/dai-090');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const apiKey = String(process.env.OPENAI_API_KEY ?? '').trim();

const phaseArg = process.argv.find((arg) => arg.startsWith('--phase='));
const phase = phaseArg?.slice('--phase='.length) || 'round1';
if (!['round1', 'final'].includes(phase)) {
  console.error('DAI-090 phase must be round1 or final.');
  process.exit(2);
}
if (!apiKey) {
  console.error('OPENAI_API_KEY is required for DAI-090 live unexpected-prompt validation.');
  process.exit(2);
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function extractUsage(body) {
  return {
    inputTokens: safeInteger(body?.usage?.input_tokens),
    outputTokens: safeInteger(body?.usage?.output_tokens),
    totalTokens: safeInteger(body?.usage?.total_tokens),
  };
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[index];
}

function evaluateIntent(intent, expect = {}) {
  const checks = [];

  for (const [key, threshold] of Object.entries(expect.min ?? {})) {
    const actual = intent?.[key];
    checks.push({
      key,
      operator: '>=',
      expected: threshold,
      actual,
      passed: typeof actual === 'number' && actual >= threshold,
    });
  }

  for (const [key, threshold] of Object.entries(expect.max ?? {})) {
    const actual = intent?.[key];
    checks.push({
      key,
      operator: '<=',
      expected: threshold,
      actual,
      passed: typeof actual === 'number' && actual <= threshold,
    });
  }

  for (const [key, expected] of Object.entries(expect.exact ?? {})) {
    const actual = intent?.[key];
    checks.push({
      key,
      operator: '===',
      expected,
      actual,
      passed: actual === expected,
    });
  }

  const passedCount = checks.filter((entry) => entry.passed).length;
  return {
    passed: checks.length === 0 || passedCount === checks.length,
    passedCount,
    totalCount: checks.length,
    failed: checks.filter((entry) => !entry.passed),
  };
}

function estimateCostUsd(usage, pricing) {
  const input =
    (usage.inputTokens * Number(pricing.inputUsdPer1M ?? 0)) / 1_000_000;
  const output =
    (usage.outputTokens * Number(pricing.outputUsdPer1M ?? 0)) / 1_000_000;
  return input + output;
}

const baseTransport = createOpenAIHttpTransport({ apiKey });
const caseResults = [];
const cloudCalls = [];

for (const testCase of fixture.cases) {
  const perCaseCalls = [];

  const cloudAttempt = async (prompt, { attempt, signal } = {}) => {
    const call = {
      caseId: testCase.id,
      attempt,
      httpStatus: null,
      durationMs: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      resultOk: false,
      errorCode: null,
    };

    const instrumentedTransport = async (request, options = {}) => {
      const started = performance.now();
      const response = await baseTransport(request, options);
      call.durationMs = round(performance.now() - started, 3);
      call.httpStatus = Number.isInteger(response?.status)
        ? response.status
        : null;
      call.usage = extractUsage(response?.body);
      return response;
    };

    const result = await generateOpenAIIntent(prompt, {
      transport: instrumentedTransport,
      model: fixture.model,
      maxOutputTokens: fixture.maxOutputTokens,
      reasoningEffort: fixture.reasoningEffort,
      signal,
    });

    call.resultOk = result?.ok === true;
    call.errorCode = result?.ok
      ? null
      : result?.error?.code ?? 'UNKNOWN';
    perCaseCalls.push(call);
    cloudCalls.push(call);
    return result;
  };

  const started = performance.now();
  const routed = await routeDesignIntent(testCase.prompt, {
    cloudAttempt,
    capabilities: {
      cloudConfigured: true,
      cloudProxyHealthy: true,
      localModelCached: false,
      webgpuAvailable: false,
    },
  });
  const routeDurationMs = round(performance.now() - started, 3);

  const validation = routed.intent
    ? validateDesignIntent(routed.intent)
    : { valid: false, errors: [] };
  const fit = routed.intent
    ? evaluateIntent(routed.intent, testCase.expect)
    : {
        passed: false,
        passedCount: 0,
        totalCount: Object.keys(testCase.expect ?? {}).length,
        failed: [],
      };

  const attemptBoundPassed =
    perCaseCalls.length <= fixture.promotionGates.maxCloudAttemptsPerCase;
  const resiliencePassed =
    routed.status === 'success' &&
    validation.valid === true &&
    attemptBoundPassed;

  caseResults.push({
    id: testCase.id,
    category: testCase.category,
    status: routed.status,
    selectedProvider: routed.selectedProvider,
    routeDurationMs,
    cloudAttemptCount: perCaseCalls.length,
    attemptOutcomes: (routed.attempts ?? []).map((entry) => entry.outcome),
    attemptBoundPassed,
    intentValid: validation.valid === true,
    validationErrorCodes: (validation.errors ?? []).map(
      (entry) => entry.code ?? entry.path ?? 'VALIDATION_ERROR',
    ),
    resiliencePassed,
    fit,
    providerMeta:
      routed.selectedProvider === 'cloud' ? routed.meta ?? null : null,
    errorCode: routed.error?.code ?? null,
  });
}

const totalCases = caseResults.length;
const resiliencePassedCases = caseResults.filter(
  (entry) => entry.resiliencePassed,
).length;
const cloudSelectedCases = caseResults.filter(
  (entry) => entry.selectedProvider === 'cloud',
).length;
const fallbackSelectedCases = caseResults.filter(
  (entry) => entry.selectedProvider === 'fallback',
).length;
const retryCases = caseResults.filter(
  (entry) => entry.cloudAttemptCount > 1,
).length;
const rateLimitedCalls = cloudCalls.filter(
  (entry) => entry.httpStatus === 429,
).length;
const httpErrorCalls = cloudCalls.filter(
  (entry) =>
    Number.isInteger(entry.httpStatus) &&
    entry.httpStatus >= 400,
).length;
const attemptBoundFailures = caseResults.filter(
  (entry) => !entry.attemptBoundPassed,
).map((entry) => entry.id);

const semanticConstraintCount = caseResults.reduce(
  (sum, entry) => sum + entry.fit.totalCount,
  0,
);
const semanticConstraintPassed = caseResults.reduce(
  (sum, entry) => sum + entry.fit.passedCount,
  0,
);

const usage = cloudCalls.reduce(
  (acc, entry) => {
    acc.inputTokens += entry.usage.inputTokens;
    acc.outputTokens += entry.usage.outputTokens;
    acc.totalTokens += entry.usage.totalTokens;
    return acc;
  },
  { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
);

const billableLatencies = cloudCalls
  .map((entry) => entry.durationMs)
  .filter(Number.isFinite);
const estimatedCostUsd = estimateCostUsd(
  usage,
  fixture.pricingSnapshot,
);

const cloudSelectionRate =
  totalCases === 0 ? 0 : cloudSelectedCases / totalCases;
const fallbackRate =
  totalCases === 0 ? 0 : fallbackSelectedCases / totalCases;
const semanticConstraintRate =
  semanticConstraintCount === 0
    ? 1
    : semanticConstraintPassed / semanticConstraintCount;

const gates = {
  exactlyTwentyCases: totalCases === 20,
  allUnexpectedPromptsRemainValidAndBounded:
    resiliencePassedCases === totalCases,
  cloudSelectionRate:
    cloudSelectionRate >= fixture.promotionGates.minCloudSelectionRate,
  semanticConstraintRate:
    semanticConstraintRate >=
    fixture.promotionGates.minSemanticConstraintRate,
  fallbackRate:
    fallbackRate <= fixture.promotionGates.maxFallbackRate,
  cloudAttemptBound: attemptBoundFailures.length === 0,
};

const generatedAt = new Date().toISOString();
const evidence = {
  generatedAt,
  phase,
  node: process.version,
  fixtureId: fixture.fixtureId,
  model: fixture.model,
  reasoningEffort: fixture.reasoningEffort,
  maxOutputTokens: fixture.maxOutputTokens,
  pricingSnapshot: fixture.pricingSnapshot,
  liveProviderCallMade: cloudCalls.length > 0,
  passed: false,
  gates,
  aggregate: {
    totalCases,
    resiliencePassedCases,
    unexpectedPromptPassLabel:
      `${resiliencePassedCases}/${totalCases}`,
    cloudSelectedCases,
    fallbackSelectedCases,
    cloudSelectionRate: round(cloudSelectionRate),
    fallbackRate: round(fallbackRate),
    retryCases,
    rateLimitedCalls,
    httpErrorCalls,
    attemptBoundFailures,
    semanticConstraintCount,
    semanticConstraintPassed,
    semanticConstraintRate: round(semanticConstraintRate),
    usage,
    estimatedCostUsd: round(estimatedCostUsd, 8),
    averageEstimatedCostUsdPerCase: round(
      totalCases > 0 ? estimatedCostUsd / totalCases : 0,
      8,
    ),
    latencyMs: {
      callCount: billableLatencies.length,
      average: round(
        billableLatencies.length
          ? billableLatencies.reduce((a, b) => a + b, 0) /
              billableLatencies.length
          : 0,
        3,
      ),
      p50: round(percentile(billableLatencies, 0.5), 3),
      p95: round(percentile(billableLatencies, 0.95), 3),
      max: round(
        billableLatencies.length
          ? Math.max(...billableLatencies)
          : 0,
        3,
      ),
    },
  },
  cases: caseResults,
  cloudCalls,
};

let serialized = JSON.stringify(evidence, null, 2);
const apiKeyLeak = serialized.includes(apiKey);
const fullPromptLeak = fixture.cases.some((entry) =>
  serialized.includes(entry.prompt),
);

evidence.safety = {
  apiKeyLeak,
  fullPromptLeak,
};
evidence.gates.evidenceContainsNoSecretsOrFullPrompts =
  !apiKeyLeak && !fullPromptLeak;
evidence.passed = Object.values(evidence.gates).every(Boolean);
evidence.falseChecks = Object.entries(evidence.gates)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

serialized = JSON.stringify(evidence, null, 2) + '\n';
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(
  outputDir,
  `dai-090-unexpected-prompts-${phase}.json`,
);
fs.writeFileSync(outputPath, serialized);

console.log(JSON.stringify({
  generatedAt,
  phase,
  passed: evidence.passed,
  falseChecks: evidence.falseChecks,
  gates: evidence.gates,
  aggregate: evidence.aggregate,
  safety: evidence.safety,
  outputPath,
}, null, 2));

if (!evidence.passed) process.exitCode = 1;
