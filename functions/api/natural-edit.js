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

export async function handleNaturalEditRequest(request, env, {
  createTransport = createOpenAIHttpTransport,
  generate = generateOpenAIEditCommand,
} = {}) {
  if (!env?.OPENAI_API_KEY || typeof env.OPENAI_API_KEY !== 'string') {
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
  const transport = createTransport({ apiKey: env.OPENAI_API_KEY });
  const result = await generate(prompt, context, {
    transport,
    model: DEFAULT_CLOUD_EDIT_MODEL,
    reasoningEffort: 'low',
    maxOutputTokens: 512,
  });

  if (!result.ok) {
    const status = result.error?.code === 'PROVIDER_RATE_LIMITED' ? 429 : 422;
    return jsonResponse(status, { ok: false, error: { code: result.error?.code ?? 'NATURAL_EDIT_FAILED' } });
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
