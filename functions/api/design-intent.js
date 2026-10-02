import { generateOpenAIRoomDesign } from '../../packages/cloud-intent/src/room-design-adapter.js';
import { parseFallbackRoomRequests, inferRequestedDifficulty } from '../../packages/intent/src/room-requests.js';
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
  generateRoomDesign = generateOpenAIRoomDesign,
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
        return (body.includeRoomRequests === true ? generateRoomDesign : generate)(inputPrompt, {
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

  let fallbackRooms;
  if (body.includeRoomRequests === true && result.roomRequests === undefined) {
    try { fallbackRooms = parseFallbackRoomRequests(prompt); }
    catch (error) { return jsonResponse(422, { ok: false, error: { code: 'ROOM_REQUEST_INVALID', message: error.message } }); }
  }
  return jsonResponse(200, {
    ok: true,
    intent: result.intent,
    ...(body.includeRoomRequests === true ? {
      roomRequests: result.roomRequests ?? fallbackRooms,
      difficulty: result.roomRequests !== undefined ? result.difficulty ?? null : inferRequestedDifficulty(prompt),
      warnings: result.warnings ?? (result.selectedProvider === "fallback" ? [
        "Special-room fallback supports a limited Japanese/English vocabulary; review every count, location and price before generation.",
        ...(/near|before|after|entrance|入口|出口|近く|手前|奥/i.test(prompt) && !/room-\d+/i.test(prompt) ? ["Relative room locations were not applied. Choose a floor and exact room ID in the review, or leave the room ID blank for seeded placement."] : []),
        ...(/\d+\s*G\b/i.test(prompt) && fallbackRooms?.some((room) => room.kind === 'shop' && room.offers.length === 0) ? ["A price was mentioned without a supported item-price phrase. The proposed shop prices need review."] : []),
      ] : []),
    } : {}),
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
