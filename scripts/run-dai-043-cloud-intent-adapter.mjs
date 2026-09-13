import fs from 'node:fs';
import path from 'node:path';
import {
  createOpenAIIntentRequest,
  generateOpenAIIntent,
  parseOpenAIIntentResponse,
} from '../packages/cloud-intent/src/cloud-intent-adapter.js';
import { createOpenAIHttpTransport } from '../packages/cloud-intent/src/openai-http-transport.js';
import { DESIGN_INTENT_JSON_SCHEMA, validateDesignIntent } from '../packages/intent/src/design-intent.js';

const outputDir = path.resolve('artifacts/cloud-intent');
const secret = 'sk-dai-043-test-secret-never-log';
const prompt = '探索を重視しつつ公平で、宝箱に欲張ると少し危険な10分程度のダンジョン';
const validIntent = {
  schemaVersion: '1.0',
  fairness: 0.82,
  tension: 0.58,
  exploration: 0.82,
  greedPunishment: 0.7,
  routeChoice: 0.78,
  learnability: 0.75,
  combatDensity: 0.3,
  trapDensity: 0.45,
  rewardDensity: 0.65,
  deception: 0.4,
  telegraphStrength: 0.72,
  backtracking: 0.4,
  targetDifficulty: 0.55,
  targetDuration: 600,
  instantDeathAllowed: false,
};

let captured = null;
const fakeFetch = async (url, options) => {
  captured = { url, options: { ...options, headers: { ...options.headers } } };
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      id: 'resp_dai_043_contract',
      model: 'gpt-5.6-luna',
      status: 'completed',
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(validIntent) }],
      }],
      usage: { input_tokens: 120, output_tokens: 80, total_tokens: 200 },
    }),
  };
};

const httpTransport = createOpenAIHttpTransport({ apiKey: secret, fetchImpl: fakeFetch });
const success = await generateOpenAIIntent(prompt, { transport: httpTransport });

let rateLimitCalls = 0;
const rateLimited = await generateOpenAIIntent('rate-limit-test', {
  transport: async () => {
    rateLimitCalls += 1;
    return { ok: false, status: 429, retryAfter: '3', body: { error: { message: 'rate' } } };
  },
});

const invalidIntent = parseOpenAIIntentResponse({
  id: 'resp_invalid',
  model: 'gpt-5.6-luna',
  status: 'completed',
  output_text: JSON.stringify({ ...validIntent, fairness: 1.2 }),
});

const extraFieldValidation = validateDesignIntent({ ...validIntent, providerMetadata: 'forbidden' });
const request = createOpenAIIntentRequest(prompt);
const capturedBody = captured ? JSON.parse(captured.options.body) : null;

const checks = {
  exactSchemaAdditionalPropertiesFalse: DESIGN_INTENT_JSON_SCHEMA.additionalProperties === false,
  exactSchemaAllFieldsRequired: DESIGN_INTENT_JSON_SCHEMA.required.length === 16,
  requestUsesLuna: request.model === 'gpt-5.6-luna',
  requestStoreFalse: request.store === false,
  requestUsesStrictJsonSchema:
    request.text?.format?.type === 'json_schema' && request.text?.format?.strict === true,
  requestHasNoTools: !Object.hasOwn(request, 'tools'),
  requestUsesBoundedOutput: request.max_output_tokens === 4096,
  backendAuthorizationHeaderOnly:
    captured?.options?.headers?.authorization === `Bearer ${secret}` &&
    capturedBody && JSON.stringify(capturedBody).includes(secret) === false,
  liveResultValid: success.ok === true && validateDesignIntent(success.intent).valid === true,
  resultMetadataSanitized:
    success.ok === true && success.meta.provider === 'openai' &&
    JSON.stringify(success).includes(prompt) === false && JSON.stringify(success).includes(secret) === false,
  independentSemanticInvalidRejected:
    invalidIntent.ok === false && invalidIntent.error?.code === 'PROVIDER_INTENT_INVALID',
  independentExtraFieldRejected:
    extraFieldValidation.valid === false &&
    extraFieldValidation.errors.some((entry) => entry.code === 'INTENT_FIELD_UNSUPPORTED'),
  rateLimitNormalized:
    rateLimited.ok === false && rateLimited.error?.code === 'PROVIDER_RATE_LIMITED' &&
    rateLimited.error?.retryAfter === '3',
  noRetryInsideDai043: rateLimitCalls === 1,
};

const passed = Object.values(checks).every(Boolean);
fs.mkdirSync(outputDir, { recursive: true });
const generatedAt = new Date().toISOString();
const evidence = {
  generatedAt,
  node: process.version,
  passed,
  liveProviderCallMade: false,
  checks,
  requestSummary: {
    model: request.model,
    store: request.store,
    maxOutputTokens: request.max_output_tokens,
    reasoningEffort: request.reasoning?.effort ?? null,
    structuredOutputType: request.text?.format?.type ?? null,
    strict: request.text?.format?.strict ?? null,
    schemaName: request.text?.format?.name ?? null,
    toolsPresent: Object.hasOwn(request, 'tools'),
  },
  successSummary: success.ok ? {
    provider: success.meta.provider,
    model: success.meta.model,
    responseId: success.meta.responseId,
    usage: success.meta.usage,
    intentValid: validateDesignIntent(success.intent).valid,
  } : success,
  failureNormalization: {
    rateLimitCode: rateLimited.error?.code ?? null,
    retryAfter: rateLimited.error?.retryAfter ?? null,
    rateLimitTransportCalls: rateLimitCalls,
    semanticInvalidCode: invalidIntent.error?.code ?? null,
  },
};

const serialized = JSON.stringify(evidence, null, 2);
if (serialized.includes(secret) || serialized.includes(prompt)) {
  throw new Error('Evidence contains a forbidden secret or full prompt.');
}

const outputPath = path.join(outputDir, 'dai-043-cloud-intent-adapter.json');
fs.writeFileSync(outputPath, serialized);
console.log(JSON.stringify({ generatedAt, passed, liveProviderCallMade: false, checks, outputPath }, null, 2));
if (!passed) process.exitCode = 1;
