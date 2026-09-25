import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateDesignIntent } from '../packages/intent/src/design-intent.js';
import { validateNaturalEditCommand } from '../packages/cloud-intent/src/openai-edit-command-adapter.js';

const fixturePath = path.resolve(
  'spec/prompt-regression/fixtures/dai-090-unexpected-prompt-v1.json',
);
const outputDir = path.resolve('artifacts/dai-090');
const outputPath = path.join(outputDir, 'dai-090-unexpected-prompt-regression.json');
const rawBaseUrl = String(
  process.env.DAI_PUBLIC_URL || 'https://dungeon-architect-ai.pages.dev/',
).trim();
const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 60_000;

const allowedVerificationChanges = new Set([
  'README.md',
  'docs/submission/CHECKLIST.md',
  'docs/submission/DEMO_STORYBOARD.md',
  'docs/submission/JUDGE_QUICKSTART.md',
  'docs/submission/KNOWN_LIMITATIONS.md',
  'docs/submission/SAMPLE_PROMPTS.md',
  'docs/testing/DAI-090_UNEXPECTED_PROMPT_REGRESSION.md',
  'docs/testing/DAI-091_FINAL_COMPLIANCE.md',
  'scripts/run-dai-080-public-docs-audit.mjs',
  'scripts/run-dai-090-unexpected-prompt-regression.mjs',
  'scripts/run-dai-091-final-compliance.mjs',
  'scripts/run-dai-091-pre-public-audit.mjs',
  'spec/prompt-regression/fixtures/dai-090-unexpected-prompt-v1.json',
]);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sortedKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
}

function exactFailureEnvelope(payload) {
  return (
    payload?.ok === false &&
    sortedKeys(payload).join(',') === 'error,ok' &&
    payload.error &&
    typeof payload.error === 'object' &&
    !Array.isArray(payload.error) &&
    sortedKeys(payload.error).join(',') === 'code' &&
    typeof payload.error.code === 'string' &&
    /^[A-Z0-9_]+$/.test(payload.error.code)
  );
}

function materializeCase(testCase, fixture) {
  if (testCase.requestKind === 'raw') {
    return {
      bodyText: String(testCase.rawBody ?? ''),
      promptText: null,
    };
  }

  if (testCase.requestKind === 'generated') {
    if (testCase.generator === 'designOverCharLimit') {
      const prompt = 'x'.repeat(12_001);
      return {
        bodyText: JSON.stringify({ prompt }),
        promptText: prompt,
      };
    }
    if (testCase.generator === 'designOverBodyLimit') {
      const prompt = 'x'.repeat(17_000);
      return {
        bodyText: JSON.stringify({ prompt }),
        promptText: prompt,
      };
    }
    if (testCase.generator === 'editOverCharLimit') {
      const prompt = 'x'.repeat(4_001);
      return {
        bodyText: JSON.stringify({
          prompt,
          context: fixture.naturalEditContext,
        }),
        promptText: prompt,
      };
    }
    if (testCase.generator === 'editOverBodyLimit') {
      const prompt = 'x'.repeat(66 * 1024);
      return {
        bodyText: JSON.stringify({
          prompt,
          context: fixture.naturalEditContext,
        }),
        promptText: prompt,
      };
    }
    throw new Error(`Unknown DAI-090 generator: ${testCase.generator}`);
  }

  const body = JSON.parse(JSON.stringify(testCase.body ?? {}));
  if (body.contextRef === 'naturalEditContext') {
    delete body.contextRef;
    body.context = fixture.naturalEditContext;
  }

  return {
    bodyText: JSON.stringify(body),
    promptText: typeof body.prompt === 'string' ? body.prompt : null,
  };
}

async function requestCase(testCase, materialized) {
  const endpoint =
    testCase.endpoint === 'design-intent'
      ? '/api/design-intent'
      : testCase.endpoint === 'natural-edit'
        ? '/api/natural-edit'
        : null;
  if (!endpoint) throw new Error(`Unknown DAI-090 endpoint: ${testCase.endpoint}`);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('DAI-090 request timeout')),
    REQUEST_TIMEOUT_MS,
  );

  const startedAt = performance.now();
  try {
    const response = await fetch(baseUrl + endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-cache',
      },
      body: materialized.bodyText,
      signal: controller.signal,
    });
    const text = await response.text();

    let payload = null;
    let parseError = null;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    return {
      status: response.status,
      text,
      payload,
      parseError,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };
  } finally {
    clearTimeout(timer);
  }
}

function inspectResponse(testCase, materialized, response, fixture) {
  const expectedStatus =
    Array.isArray(testCase.expectedStatus) &&
    testCase.expectedStatus.includes(response.status);

  const noPromptEcho =
    materialized.promptText === null ||
    materialized.promptText.length === 0 ||
    !response.text.includes(materialized.promptText);

  const noSensitiveTerms = ![
    'OPENAI_API_KEY',
    'test-secret-do-not-leak',
    'BEGIN PRIVATE KEY',
  ].some((term) => response.text.includes(term));

  const expectedErrorCodes = testCase.expectedErrorCodes ?? [];
  const errorCode = response.payload?.error?.code ?? null;
  const expectedError =
    expectedErrorCodes.length === 0 ||
    expectedErrorCodes.includes(errorCode);

  const failureEnvelopeSafe =
    response.status < 400 ||
    exactFailureEnvelope(response.payload);

  let validDesignIntent = null;
  let safeEditCommand = null;
  let semanticOutcomeSafe = true;

  if (testCase.expectValidDesignIntent === true) {
    const validation = validateDesignIntent(response.payload?.intent);
    validDesignIntent =
      response.status === 200 &&
      response.payload?.ok === true &&
      validation.valid === true &&
      response.payload.intent?.instantDeathAllowed === false;
    semanticOutcomeSafe = validDesignIntent;
  }

  if (
    testCase.expectSafeEditCommand === true ||
    testCase.expectSafeEditOrSanitizedFailure === true
  ) {
    if (response.status === 200) {
      const validation = validateNaturalEditCommand(
        response.payload?.command,
        fixture.naturalEditContext,
      );
      safeEditCommand =
        response.payload?.ok === true &&
        validation.ok === true &&
        response.payload.command?.type === 'move-entity' &&
        sortedKeys(response.payload.command).join(',') === 'entityId,roomId,type';
      semanticOutcomeSafe = safeEditCommand;
    } else if (
      testCase.expectSafeEditOrSanitizedFailure === true &&
      response.status === 422
    ) {
      safeEditCommand = null;
      semanticOutcomeSafe = exactFailureEnvelope(response.payload);
    } else {
      semanticOutcomeSafe = false;
    }
  }

  const passed =
    expectedStatus &&
    response.parseError === null &&
    expectedError &&
    failureEnvelopeSafe &&
    noPromptEcho &&
    noSensitiveTerms &&
    semanticOutcomeSafe;

  return {
    passed,
    expectedStatus,
    expectedError,
    failureEnvelopeSafe,
    noPromptEcho,
    noSensitiveTerms,
    validDesignIntent,
    safeEditCommand,
    status: response.status,
    errorCode,
    selectedProvider: response.payload?.selectedProvider ?? null,
    responseKeys: sortedKeys(response.payload),
    commandType: response.payload?.command?.type ?? null,
    durationMs: response.durationMs,
    requestBytes: Buffer.byteLength(materialized.bodyText, 'utf8'),
    promptChars: materialized.promptText?.length ?? null,
    responseSha256: sha256(response.text),
    parseError: response.parseError,
  };
}

if (!/^https:\/\//i.test(baseUrl)) {
  throw new Error('DAI_PUBLIC_URL must be an https:// URL.');
}
if (!fs.existsSync(fixturePath)) {
  throw new Error('DAI-090 fixture is missing.');
}

const fixture = readJson(fixturePath);
if (
  fixture?.schemaVersion !== '1.0' ||
  fixture?.fixtureId !== 'dai-090-unexpected-prompt-v1' ||
  !Array.isArray(fixture?.cases) ||
  fixture.cases.length < 20
) {
  throw new Error('DAI-090 fixture shape is invalid.');
}

const candidateCommit = fixture.publicCandidate?.commitSha;
const expectedRuntimeSourceSha256 =
  fixture.publicCandidate?.runtimeSourceSha256;

const currentHead = git(['rev-parse', 'HEAD']);
let candidateIsAncestor = false;
try {
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', candidateCommit, currentHead],
    { stdio: 'ignore' },
  );
  candidateIsAncestor = true;
} catch {}

const changedPaths = git(['diff', '--name-only', `${candidateCommit}..HEAD`])
  .split(/\r?\n/)
  .filter(Boolean);
const unexpectedVerificationChanges = changedPaths.filter(
  (file) => !allowedVerificationChanges.has(file),
);

const buildInfoResponse = await fetch(
  `${baseUrl}/build-info.json?nocache=${Date.now()}`,
  {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  },
);
const buildInfoText = await buildInfoResponse.text();
let publicBuildInfo = null;
try {
  publicBuildInfo = JSON.parse(buildInfoText);
} catch {}

const caseResults = [];
for (const testCase of fixture.cases) {
  const materialized = materializeCase(testCase, fixture);
  process.stdout.write(`[DAI-090] ${testCase.id} ... `);
  try {
    const response = await requestCase(testCase, materialized);
    const inspected = inspectResponse(
      testCase,
      materialized,
      response,
      fixture,
    );
    caseResults.push({
      id: testCase.id,
      endpoint: testCase.endpoint,
      ...inspected,
    });
    console.log(inspected.passed ? 'PASS' : 'FAIL');
  } catch (error) {
    caseResults.push({
      id: testCase.id,
      endpoint: testCase.endpoint,
      passed: false,
      transportError:
        error instanceof Error ? error.message : String(error),
    });
    console.log('FAIL');
  }
}

const failedCaseIds = caseResults
  .filter((entry) => entry.passed !== true)
  .map((entry) => entry.id);

const checks = {
  publicHttps: baseUrl.startsWith('https://'),
  publicBuildInfoAvailable:
    buildInfoResponse.status === 200 &&
    publicBuildInfo?.schemaVersion === '1.0',
  exactFrozenCandidatePublished:
    publicBuildInfo?.commitSha === candidateCommit,
  runtimeSourceFingerprintMatches:
    publicBuildInfo?.runtimeSourceSha256 ===
    expectedRuntimeSourceSha256,
  verificationBranchDescendsFromCandidate:
    candidateIsAncestor,
  verificationBranchOnlyAddsDAI090Evidence:
    unexpectedVerificationChanges.length === 0,
  corpusHasTwentyCases:
    fixture.cases.length === 20,
  allCasesPassed:
    failedCaseIds.length === 0,
  allResponsesAvoidFullPromptEcho:
    caseResults.every((entry) => entry.noPromptEcho !== false),
  allResponsesAvoidSensitiveTerms:
    caseResults.every((entry) => entry.noSensitiveTerms !== false),
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  publicUrl: baseUrl + '/',
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  candidate: {
    expectedCommit: candidateCommit,
    expectedRuntimeSourceSha256,
    publicBuildInfo,
    verificationHead: currentHead,
    changedPaths,
    unexpectedVerificationChanges,
  },
  corpus: {
    fixtureId: fixture.fixtureId,
    caseCount: fixture.cases.length,
    caseIds: fixture.cases.map((entry) => entry.id),
    fullPromptTextStored: false,
  },
  results: caseResults,
  failedCaseIds,
  safety: {
    rawResponseBodiesStored: false,
    fullPromptTextStored: false,
    providerSecretRequiredLocally: false,
  },
};

const serialized = JSON.stringify(evidence, null, 2);
for (const testCase of fixture.cases) {
  const materialized = materializeCase(testCase, fixture);
  if (
    materialized.promptText &&
    serialized.includes(materialized.promptText)
  ) {
    throw new Error(
      `DAI-090 evidence unexpectedly contains full prompt for ${testCase.id}`,
    );
  }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, serialized + '\n');
console.log('');
console.log(serialized);

if (!evidence.passed) {
  throw new Error(
    'DAI-090 unexpected-prompt regression failed: ' +
      falseChecks.join(', ') +
      (failedCaseIds.length
        ? `; cases: ${failedCaseIds.join(', ')}`
        : ''),
  );
}
