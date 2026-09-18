import { createOpenAIHttpTransport } from '../../packages/cloud-intent/src/openai-http-transport.js';
import { generateOpenAIIntent } from '../../packages/cloud-intent/src/cloud-intent-adapter.js';
import { routeDesignIntent } from '../../packages/cloud-intent/src/intent-router.js';

const MAX_BODY_BYTES = 16 * 1024;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RangeError('request body exceeds limit');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new RangeError('request body exceeds limit');
  }
  return JSON.parse(text);
}

export async function handleDesignIntentRequest(request, env, {
  createTransport = createOpenAIHttpTransport,
  generate = generateOpenAIIntent,
  route = routeDesignIntent,
} = {}) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { ok: false, error: { code: 'REQUEST_INVALID' } });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 12000) {
    return jsonResponse(400, { ok: false, error: { code: 'PROMPT_INVALID' } });
  }

  const apiKey = typeof env?.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
  const cloudAttempt = apiKey
    ? async (inputPrompt, { signal } = {}) => {
        const transport = createTransport({ apiKey });
        return generate(inputPrompt, {
          transport,
          reasoningEffort: 'low',
          maxOutputTokens: 4096,
          signal,
        });
      }
    : undefined;

  let result;
  try {
    result = await route(prompt, {
      cloudAttempt,
      capabilities: {
        cloudConfigured: Boolean(apiKey),
        cloudProxyHealthy: Boolean(apiKey),
        localModelCached: false,
        webgpuAvailable: false,
      },
      signal: request.signal,
    });
  } catch {
    return jsonResponse(502, { ok: false, error: { code: 'DESIGN_INTENT_BACKEND_ERROR' } });
  }

  if (result.status !== 'success' || !result.intent) {
    return jsonResponse(422, { ok: false, error: { code: 'DESIGN_INTENT_UNAVAILABLE' } });
  }

  return jsonResponse(200, {
    ok: true,
    intent: result.intent,
    selectedProvider: result.selectedProvider,
    meta: result.meta ? {
      provider: result.meta.provider ?? result.selectedProvider,
      model: result.meta.model ?? null,
      usage: result.meta.usage ?? null,
    } : null,
  });
}

export async function onRequestPost({ request, env }) {
  return handleDesignIntentRequest(request, env);
}

export function onRequest() {
  return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
}
