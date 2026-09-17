import { createOpenAIHttpTransport } from '../../packages/cloud-intent/src/openai-http-transport.js';
import {
  DEFAULT_CLOUD_EDIT_MODEL,
  generateOpenAIEditCommand,
} from '../../packages/cloud-intent/src/openai-edit-command-adapter.js';

const MAX_BODY_BYTES = 64 * 1024;

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

function providerFailureStatus(code) {
  if (code === 'PROVIDER_RATE_LIMITED') return 429;
  if (code === 'PROVIDER_TRANSPORT_ERROR' || code === 'PROVIDER_HTTP_ERROR' || code === 'PROVIDER_TRANSPORT_INVALID') return 502;
  return 422;
}

export async function handleNaturalEditRequest(request, env, {
  createTransport = createOpenAIHttpTransport,
  generate = generateOpenAIEditCommand,
} = {}) {
  const apiKey = typeof env?.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
  if (!apiKey) {
    return jsonResponse(503, { ok: false, error: { code: 'PROVIDER_NOT_CONFIGURED' } });
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { ok: false, error: { code: 'REQUEST_INVALID' } });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const context = body?.context;

  let result;
  try {
    const transport = createTransport({ apiKey });
    result = await generate(prompt, context, {
      transport,
      model: DEFAULT_CLOUD_EDIT_MODEL,
      reasoningEffort: 'low',
      maxOutputTokens: 512,
    });
  } catch {
    return jsonResponse(502, { ok: false, error: { code: 'NATURAL_EDIT_BACKEND_ERROR' } });
  }

  if (!result.ok) {
    const code = result.error?.code ?? 'NATURAL_EDIT_FAILED';
    return jsonResponse(providerFailureStatus(code), { ok: false, error: { code } });
  }

  return jsonResponse(200, {
    ok: true,
    command: result.command,
    meta: {
      provider: result.meta.provider,
      model: result.meta.model,
      usage: result.meta.usage,
    },
  });
}

export async function onRequestPost({ request, env }) {
  return handleNaturalEditRequest(request, env);
}

export function onRequest() {
  return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
}
