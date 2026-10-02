import { DESIGN_INTENT_JSON_SCHEMA, validateDesignIntent } from '../../intent/src/design-intent.js';
import { ROOM_REQUESTS_JSON_SCHEMA, validateRoomRequests } from '../../intent/src/room-requests.js';
import { createOpenAIIntentRequest, parseOpenAIIntentResponse } from './cloud-intent-adapter.js';

export async function generateOpenAIRoomDesign(prompt, { transport, signal } = {}) {
  const request = createOpenAIIntentRequest(prompt);
  request.instructions += ' Also extract special room requests: monster-house, trap-house, shop. Preserve explicit room counts, enemies/traps per room, floor numbers, exact room IDs, targetRole=start or goal for Start/Goal rooms (null otherwise), and shop prices/stock/healing/equipment tiers. Distinguish room count from enemy/trap count. Never invent missing numbers: use null. Return presence=exclude for explicit negation, include for requested kinds, and random only if explicitly requested as random. Omit unmentioned kinds so seeded random policy can resolve them locally. Never turn unspecified kinds into exclusions. Empty offers means the user did not specify merchandise. For each offer use null for nonapplicable healing or tier. If a location cannot be represented as an exact room ID/floor or targetRole, explain it in warnings, do not pretend it was honored. Interpret easy/beginner, normal/moderate, hard/challenging difficulty into the difficulty enum; use null if unspecified. For an explicitly normal Start/Goal room use kind=normal, presence=include, targetRole=start/goal, entityCount=null and offers=[]. For an explicitly random Start/Goal kind use kind=normal, presence=random and that targetRole. Do not use kind=normal without a targetRole. Return roomRequests=[] when no room configuration is requested.';
  request.text.format.name = 'room_design_v1';
  request.text.format.schema = {
    type: 'object', additionalProperties: false,
    properties: { intent: DESIGN_INTENT_JSON_SCHEMA, roomRequests: ROOM_REQUESTS_JSON_SCHEMA,
      difficulty: { type: ['string', 'null'], enum: ['easy', 'normal', 'hard', null] },
      warnings: { type: 'array', items: { type: 'string' } } },
    required: ['intent', 'roomRequests', 'difficulty', 'warnings'],
  };
  try {
    const response = await transport(request, { signal });
    if (response?.status === 429) return { ok: false, error: { code: 'PROVIDER_RATE_LIMITED', retryAfter: response.retryAfter ?? null } };
    if (!response?.ok) return { ok: false, error: { code: 'PROVIDER_HTTP_ERROR', status: response?.status } };
    const body = response.body;
    if (body?.error || (body?.status && body.status !== 'completed')) return { ok: false, error: { code: 'PROVIDER_RESPONSE_INCOMPLETE' } };
    const content = body?.output?.flatMap((item) => item.content ?? []) ?? [];
    if (content.some((item) => item.type === 'refusal')) return { ok: false, error: { code: 'PROVIDER_REFUSAL' } };
    const output = body?.output_text ?? content.filter((item) => item.type === 'output_text').map((item) => item.text).join('');
    let parsed;
    try { parsed = JSON.parse(output); }
    catch { return { ok: false, error: { code: 'PROVIDER_OUTPUT_NOT_JSON' } }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some((key) => !['intent', 'roomRequests', 'difficulty', 'warnings'].includes(key))) return { ok: false, error: { code: 'PROVIDER_INTENT_INVALID' } };
    if (!validateDesignIntent(parsed.intent).valid || !validateRoomRequests(parsed.roomRequests).valid || parsed.roomRequests.some((room) => room.presence === undefined) ||
      !['easy', 'normal', 'hard', null].includes(parsed.difficulty) || !Array.isArray(parsed.warnings) || parsed.warnings.some((item) => typeof item !== 'string')) return { ok: false, error: { code: 'PROVIDER_INTENT_INVALID' } };
    const standard = parseOpenAIIntentResponse({ ...body, output_text: JSON.stringify(parsed.intent), output: [] });
    return { ...standard, roomRequests: parsed.roomRequests, difficulty: parsed.difficulty, warnings: parsed.warnings };
  } catch {
    return { ok: false, error: { code: signal?.aborted ? 'PROVIDER_ABORTED' : 'PROVIDER_TRANSPORT_ERROR' } };
  }
}
