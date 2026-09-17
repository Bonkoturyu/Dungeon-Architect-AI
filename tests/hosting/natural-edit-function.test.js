import assert from 'node:assert/strict';
import test from 'node:test';
import { handleNaturalEditRequest, onRequest } from '../../functions/api/natural-edit.js';

const context = {
  rooms: [{ id: 'room-start' }, { id: 'room-goal' }],
  entities: [
    { id: 'treasure-1', type: 'treasure', roomId: 'room-start' },
    { id: 'goal-1', type: 'goal', roomId: 'room-goal' },
  ],
};

function request(body) {
  return new Request('https://example.pages.dev/api/natural-edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('fails closed when OPENAI_API_KEY is not configured', async () => {
  const response = await handleNaturalEditRequest(request({ prompt: 'move treasure', context }), {});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: { code: 'PROVIDER_NOT_CONFIGURED' } });
});

test('rejects invalid JSON without invoking provider dependencies', async () => {
  let called = false;
  const response = await handleNaturalEditRequest(request('{'), { OPENAI_API_KEY: 'test-secret' }, {
    createTransport: () => { called = true; return async () => ({}); },
    generate: async () => { called = true; return { ok: false }; },
  });
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.equal((await response.json()).error.code, 'REQUEST_INVALID');
});

test('returns one sanitized command and never echoes the secret or full prompt', async () => {
  const secret = 'test-secret-do-not-leak';
  const prompt = 'Move the treasure to the goal room.';
  let transportApiKey = null;
  let observedPrompt = null;
  let observedContext = null;

  const response = await handleNaturalEditRequest(request({ prompt, context }), { OPENAI_API_KEY: secret }, {
    createTransport: ({ apiKey }) => {
      transportApiKey = apiKey;
      return async () => ({ ok: true });
    },
    generate: async (inputPrompt, inputContext) => {
      observedPrompt = inputPrompt;
      observedContext = inputContext;
      return {
        ok: true,
        command: { type: 'move-entity', entityId: 'treasure-1', roomId: 'room-goal' },
        meta: { provider: 'openai', model: 'test-model', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(transportApiKey, secret);
  assert.equal(observedPrompt, prompt);
  assert.deepEqual(observedContext, context);
  const text = await response.text();
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(prompt), false);
  assert.deepEqual(JSON.parse(text).command, { type: 'move-entity', entityId: 'treasure-1', roomId: 'room-goal' });
});

test('non-POST fallback is method-not-allowed', async () => {
  const response = onRequest();
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error.code, 'METHOD_NOT_ALLOWED');
});
