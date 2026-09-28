import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { validateDesignIntent } from '../packages/intent/src/design-intent.js';

const fixturePath = path.resolve(
  'spec/design-intent/fixtures/dai-090-unexpected-prompts-v1.json',
);
const outputDir = path.resolve('artifacts/dai-090');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const phaseArg = process.argv.find((arg) => arg.startsWith('--phase='));
const phase = phaseArg?.slice('--phase='.length) || 'round1';
if (!['round1', 'final'].includes(phase)) {
  console.error('DAI-090 phase must be round1 or final.');
  process.exit(2);
}

const rawBaseUrl = String(
  process.env.DAI_PUBLIC_URL || 'https://dungeon-architect-ai.pages.dev/',
).trim();
if (!/^https:\/\//i.test(rawBaseUrl)) {
  console.error('DAI_PUBLIC_URL must be an https:// URL.');
  process.exit(2);
}
const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const endpoint = `${baseUrl}/api/design-intent`;

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function extractUsage(meta) {
  const usage = meta?.usage ?? {};
  return {
    inputTokens: safeInteger(usage.input_tokens ?? usage.inputTokens),
    outputTokens: safeInteger(usage.output_tokens ?? usage.outputTokens),
    totalTokens: safeInteger(usage.total_tokens ?? usage.totalTokens),
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

const caseResults = [];
const publicCalls = [];

for (const testCase of fixture.cases) {
  const started = performance.now();
  let response;
  let body = null;
  let fetchError = null;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
      body: JSON.stringify({ prompt: testCase.prompt }),
    });

    try {
      body = await response.json();
    } catch (error) {
      fetchError = `response-json:${error instanceof Error ? error.message : String(error)}`;
    }
  } catch (error) {
    fetchError = error instanceof Error ? error.message : String(error);
  }

  const durationMs = round(performance.now() - started, 3);
  const httpStatus = response?.status ?? null;
  const usage = extractUsage(body?.meta);
  const selectedProvider =
    typeof body?.selectedProvider === 'string'
      ? body.selectedProvider
      : null;
  const intent = body?.ok === true ? body.intent ?? null : null;
  const validation = intent
    ? validateDesignIntent(intent)
    : { valid: false, errors: [] };
  const fit = intent
    ? evaluateIntent(intent, testCase.expect)
    : {
        passed: false,
        passedCount: 0,
        totalCount:
          Object.keys(testCase.expect?.min ?? {}).length +
          Object.keys(testCase.expect?.max ?? {}).length +
          Object.keys(testCase.expect?.exact ?? {}).length,
        failed: [],
      };

  const call = {
    caseId: testCase.id,
    httpStatus,
    durationMs,
    responseOk: response?.ok === true && body?.ok === true,
    selectedProvider,
    usage,
    errorCode: body?.error?.code ?? null,
    fetchError,
  };
  publicCalls.push(call);

  const resiliencePassed =
    call.responseOk === true &&
    httpStatus === 200 &&
    validation.valid === true &&
    ['cloud', 'fallback'].includes(selectedProvider);

  caseResults.push({
    id: testCase.id,
    category: testCase.category,
    httpStatus,
    durationMs,
    status: body?.ok === true ? 'success' : 'error',
    selectedProvider,
    intentValid: validation.valid === true,
    validationErrorCodes: (validation.errors ?? []).map(
      (entry) => entry.code ?? entry.path ?? 'VALIDATION_ERROR',
    ),
    resiliencePassed,
    fit,
    providerMeta:
      selectedProvider === 'cloud'
        ? {
            provider: body?.meta?.provider ?? 'cloud',
            model: body?.meta?.model ?? null,
          }
        : null,
    errorCode: body?.error?.code ?? null,
    fetchError,
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
const http200Cases = caseResults.filter(
  (entry) => entry.httpStatus === 200,
).length;
const publicRequestFailures = publicCalls
  .filter((entry) => entry.responseOk !== true)
  .map((entry) => entry.caseId);

const semanticConstraintCount = caseResults.reduce(
  (sum, entry) => sum + entry.fit.totalCount,
  0,
);
const semanticConstraintPassed = caseResults.reduce(
  (sum, entry) => sum + entry.fit.passedCount,
  0,
);

const usage = publicCalls.reduce(
  (acc, entry) => {
    acc.inputTokens += entry.usage.inputTokens;
    acc.outputTokens += entry.usage.outputTokens;
    acc.totalTokens += entry.usage.totalTokens;
    return acc;
  },
  { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
);

const latencies = publicCalls
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
  exactlyOnePublicRequestPerCase: publicCalls.length === totalCases,
  allPublicRequestsHttp200: http200Cases === totalCases,
  allUnexpectedPromptsRemainValidAndBounded:
    resiliencePassedCases === totalCases,
  cloudSelectionRate:
    cloudSelectionRate >= fixture.promotionGates.minCloudSelectionRate,
  semanticConstraintRate:
    semanticConstraintRate >=
    fixture.promotionGates.minSemanticConstraintRate,
  fallbackRate:
    fallbackRate <= fixture.promotionGates.maxFallbackRate,
  noPublicRequestFailures: publicRequestFailures.length === 0,
};

const generatedAt = new Date().toISOString();
const evidence = {
  generatedAt,
  phase,
  node: process.version,
  fixtureId: fixture.fixtureId,
  publicUrl: baseUrl,
  endpoint: '/api/design-intent',
  localApiKeyRequired: false,
  modelExpectation: fixture.model,
  reasoningEffortExpectation: fixture.reasoningEffort,
  pricingSnapshot: fixture.pricingSnapshot,
  liveProviderCallMade: cloudSelectedCases > 0,
  passed: false,
  gates,
  aggregate: {
    totalCases,
    resiliencePassedCases,
    unexpectedPromptPassLabel:
      `${resiliencePassedCases}/${totalCases}`,
    http200Cases,
    publicRequestFailures,
    cloudSelectedCases,
    fallbackSelectedCases,
    cloudSelectionRate: round(cloudSelectionRate),
    fallbackRate: round(fallbackRate),
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
      callCount: latencies.length,
      average: round(
        latencies.length
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
        3,
      ),
      p50: round(percentile(latencies, 0.5), 3),
      p95: round(percentile(latencies, 0.95), 3),
      max: round(
        latencies.length ? Math.max(...latencies) : 0,
        3,
      ),
    },
  },
  cases: caseResults,
  publicCalls,
};

let serialized = JSON.stringify(evidence, null, 2);
const fullPromptLeak = fixture.cases.some((entry) =>
  serialized.includes(entry.prompt),
);

evidence.safety = {
  localApiKeyPresentInEvidence: false,
  fullPromptLeak,
};
evidence.gates.evidenceContainsNoSecretsOrFullPrompts =
  !fullPromptLeak;
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
  publicUrl: baseUrl,
  localApiKeyRequired: false,
  passed: evidence.passed,
  falseChecks: evidence.falseChecks,
  gates: evidence.gates,
  aggregate: evidence.aggregate,
  safety: evidence.safety,
  outputPath,
}, null, 2));

if (!evidence.passed) process.exitCode = 1;
