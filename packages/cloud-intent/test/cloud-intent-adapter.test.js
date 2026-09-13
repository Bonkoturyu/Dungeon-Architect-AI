import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CLOUD_INTENT_MODEL,
  createOpenAIIntentRequest,
  generateOpenAIIntent,
  parseOpenAIIntentResponse
} from "../src/cloud-intent-adapter.js";
import {
  OPENAI_RESPONSES_ENDPOINT,
  createOpenAIHttpTransport
} from "../src/openai-http-transport.js";
import { DESIGN_INTENT_JSON_SCHEMA, validateDesignIntent } from "../../intent/src/design-intent.js";

const VALID_INTENT = Object.freeze({
  schemaVersion: "1.0",
  fairness: 0.8,
  tension: 0.65,
  exploration: 0.7,
  greedPunishment: 0.55,
  routeChoice: 0.75,
  learnability: 0.72,
  combatDensity: 0.3,
  trapDensity: 0.45,
  rewardDensity: 0.6,
  deception: 0.35,
  telegraphStrength: 0.7,
  backtracking: 0.4,
  targetDifficulty: 0.62,
  targetDuration: 600,
  instantDeathAllowed: false
});

function completedBody(intent = VALID_INTENT) {
  return {
    id: "resp_test",
    model: DEFAULT_CLOUD_INTENT_MODEL,
    status: "completed",
    output_text: JSON.stringify(intent),
    usage: { input_tokens: 100, output_tokens: 60, total_tokens: 160 }
  };
}

test("DesignIntent exposes an exact strict JSON schema", () => {
  assert.equal(DESIGN_INTENT_JSON_SCHEMA.type, "object");
  assert.equal(DESIGN_INTENT_JSON_SCHEMA.additionalProperties, false);
  assert.equal(DESIGN_INTENT_JSON_SCHEMA.required.length, 16);
  assert.equal(DESIGN_INTENT_JSON_SCHEMA.properties.instantDeathAllowed.enum[0], false);
});

test("independent DesignIntent validator rejects extra provider fields", () => {
  const result = validateDesignIntent({ ...VALID_INTENT, providerNote: "should not survive" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === "INTENT_FIELD_UNSUPPORTED"));
});

test("OpenAI request is stateless structured output and contains no tools", () => {
  const request = createOpenAIIntentRequest("探索を重視した公平なダンジョン");
  assert.equal(request.model, "gpt-5.6-luna");
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.additionalProperties, false);
  assert.equal(request.reasoning.effort, "low");
  assert.equal("tools" in request, false);
});

test("valid provider structured output passes independent validation", async () => {
  const transport = async () => ({ ok: true, status: 200, body: completedBody() });
  const result = await generateOpenAIIntent("fair but tense", { transport });
  assert.equal(result.ok, true);
  assert.deepEqual(result.intent, VALID_INTENT);
  assert.deepEqual(result.meta.usage, { inputTokens: 100, outputTokens: 60, totalTokens: 160 });
  assert.equal("output_text" in result, false);
});

test("response output array fallback is parsed without SDK helpers", () => {
  const body = completedBody();
  delete body.output_text;
  body.output = [{
    type: "message",
    content: [{ type: "output_text", text: JSON.stringify(VALID_INTENT) }]
  }];
  const result = parseOpenAIIntentResponse(body);
  assert.equal(result.ok, true);
  assert.deepEqual(result.intent, VALID_INTENT);
});

test("invalid JSON and semantic-invalid output are rejected", () => {
  const invalidJson = parseOpenAIIntentResponse({ status: "completed", output_text: "not-json" });
  assert.equal(invalidJson.ok, false);
  assert.equal(invalidJson.error.code, "PROVIDER_OUTPUT_NOT_JSON");

  const semanticInvalid = parseOpenAIIntentResponse(completedBody({ ...VALID_INTENT, fairness: 2 }));
  assert.equal(semanticInvalid.ok, false);
  assert.equal(semanticInvalid.error.code, "PROVIDER_INTENT_INVALID");
});

test("provider refusal and incomplete response are normalized", () => {
  const refused = parseOpenAIIntentResponse({
    status: "completed",
    output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }]
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, "PROVIDER_REFUSAL");

  const incomplete = parseOpenAIIntentResponse({ status: "incomplete", output: [] });
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.error.code, "PROVIDER_RESPONSE_INCOMPLETE");
});

test("429 is normalized without retrying inside DAI-043", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return { ok: false, status: 429, retryAfter: "2", body: { error: { message: "rate" } } };
  };
  const result = await generateOpenAIIntent("test", { transport });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PROVIDER_RATE_LIMITED");
  assert.equal(result.error.retryAfter, "2");
  assert.equal(calls, 1);
});

test("backend HTTP transport keeps the API key out of the request body and result envelope", async () => {
  const secret = "sk-test-secret-value";
  let capturedUrl = null;
  let capturedOptions = null;
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => completedBody()
    };
  };

  const transport = createOpenAIHttpTransport({ apiKey: secret, fetchImpl: fakeFetch });
  const request = createOpenAIIntentRequest("test prompt");
  const result = await transport(request);

  assert.equal(capturedUrl, OPENAI_RESPONSES_ENDPOINT);
  assert.equal(capturedOptions.headers.authorization, `Bearer ${secret}`);
  assert.equal(capturedOptions.body.includes(secret), false);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("HTTP transport requires backend secret configuration", () => {
  assert.throws(() => createOpenAIHttpTransport({ apiKey: "" }), /API key is required/);
});
