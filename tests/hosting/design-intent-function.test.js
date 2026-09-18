import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN_INTENT } from '../../packages/intent/src/design-intent.js';
import { handleDesignIntentRequest, onRequest } from '../../functions/api/design-intent.js';

function request(body) {
  return new Request('https://example.pages.dev/api/design-intent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('uses deterministic fallback when provider secret is not configured', async () => {
  const response = await handleDesignIntentRequest(request({ prompt: '初心者向けで探索が多い短いダンジョン' }), {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.selectedProvider, 'fallback');
  assert.equal(payload.intent.schemaVersion, '1.0');
});

test('routes configured cloud result without echoing the prompt or secret', async () => {
  const prompt = 'A fair tense dungeon.';
  const secret = 'test-secret-do-not-leak';
  let observedKey = null;
  let observedPrompt = null;
  const response = await handleDesignIntentRequest(request({ prompt }), { OPENAI_API_KEY: secret }, {
    createTransport: ({ apiKey }) => {
      observedKey = apiKey;
      return async () => ({ ok: true });
    },
    generate: async (inputPrompt) => {
      observedPrompt = inputPrompt;
      return {
        ok: true,
        intent: { ...DEFAULT_DESIGN_INTENT, tension: 0.8 },
        meta: { provider: 'openai', model: 'test-model', usage: null },
      };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(observedKey, secret);
  assert.equal(observedPrompt, prompt);
  const text = await response.text();
  assert.equal(text.includes(prompt), false);
  assert.equal(text.includes(secret), false);
  const payload = JSON.parse(text);
  assert.equal(payload.selectedProvider, 'cloud');
  assert.equal(payload.intent.tension, 0.8);
});

test('rejects invalid request and unsupported method', async () => {
  const invalid = await handleDesignIntentRequest(request('{'), {});
  assert.equal(invalid.status, 400);
  const method = onRequest();
  assert.equal(method.status, 405);
});
