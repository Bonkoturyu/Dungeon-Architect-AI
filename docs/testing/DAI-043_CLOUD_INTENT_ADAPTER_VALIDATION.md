# DAI-043 Cloud Intent Adapter Validation

## Status

**DONE.** Production contract validation passed on 2026-09-13.

DAI-043 adds the first provider-neutral cloud `DesignIntent` adapter boundary and the reviewed OpenAI Responses API implementation candidate selected by DAI-042.

No live provider request is required for this task's contract evidence. Live model quality, latency, token use, cost, and fallback behavior belong to DAI-045 prompt regression.

## Reviewed production evidence

- generated at: `2026-09-13T14:49:48.983Z`
- Node.js: `v24.15.0`
- JSON SHA-256: `429b3eb9d6ce1bdf286f1ddcbaf3055ec9ea6bea06e88c926a277da22f88e9ea`
- `passed = true`
- `liveProviderCallMade = false`
- 14 / 14 evidence checks passed
- exact DesignIntent schema rejects additional properties and requires all fields
- default request model is `gpt-5.6-luna`
- `store = false`
- strict JSON Schema structured output is enabled
- no tools are present
- output is bounded to 4096 tokens in the evidence request
- provider secret stays in the backend Authorization header
- valid structured output passes independent validation
- semantic-invalid and extra-field outputs are rejected
- 429 is normalized with `Retry-After`
- DAI-043 performs exactly one transport attempt; retry remains DAI-044 scope

## Architecture boundary

Browser/UI code must not own provider credentials or call a provider directly.

The intended deployment flow is:

```text
Browser prompt
  -> project backend/proxy
  -> cloud intent adapter
  -> provider HTTP API
  -> strict structured output
  -> independent validateDesignIntent
  -> normalized DesignIntent or normalized provider failure
```

Provider/model metadata must not enter serialized `DesignIntent` or `DungeonSpec`.

## DesignIntent schema

`packages/intent/src/design-intent.js` exports `DESIGN_INTENT_JSON_SCHEMA` from the same production field contract used by `validateDesignIntent`.

The schema:

- requires all 16 MVP fields;
- rejects additional properties;
- constrains all design axes to 0..1;
- constrains target duration to 120..1800 seconds;
- fixes `schemaVersion` to `1.0`;
- fixes `instantDeathAllowed` to false.

The independent validator also rejects unsupported extra fields, so a provider response cannot silently preserve provider-only metadata.

## OpenAI request contract

`createOpenAIIntentRequest()` builds a backend request with:

- default model `gpt-5.6-luna`;
- `store: false` explicitly;
- bounded `max_output_tokens` (4096 default);
- `reasoning.effort = low` as the initial cost/latency candidate;
- `text.format.type = json_schema`;
- `strict = true`;
- production `DESIGN_INTENT_JSON_SCHEMA`;
- no tools;
- no executable-code request.

The prompt is bounded to 12,000 characters before provider dispatch.

## HTTP transport boundary

`packages/cloud-intent/src/openai-http-transport.js`:

- accepts the API key only when constructing the backend transport;
- sends the key only in the `Authorization` header;
- sends provider request data as JSON to an HTTPS endpoint;
- does not put the key into the request body or returned response envelope;
- exposes only status, `Retry-After`, and parsed provider body to the adapter.

The module uses the platform `fetch` API and introduces no provider SDK dependency.

## Response parsing and validation

The adapter:

- accepts the raw Responses body without relying on SDK-only helpers;
- supports the provider `output` message/content structure and an `output_text` convenience value when present;
- normalizes refusal, incomplete, missing-output, invalid-JSON, semantic-validation, HTTP, transport, abort, and 429 failures;
- returns only validated `DesignIntent` plus sanitized provider/model/request-id/token-usage metadata on success;
- does not return the original full prompt or provider raw response to browser code.

DAI-043 performs a single provider attempt. Retry/fallback orchestration remains DAI-044.

## Production contract evidence

`scripts/run-dai-043-cloud-intent-adapter.mjs` uses an injected fake HTTP boundary to verify the exact production request/response contract without a real secret or billable provider call.

The reviewed evidence confirms the completion gate. A live API key is **not** a DAI-043 completion requirement. Live-provider evaluation is deliberately deferred to DAI-045 so model quality/cost evidence is collected under the same frozen prompt corpus rather than through an ad-hoc one-off call.

## Explicit non-goals

DAI-043 does not implement:

- retry orchestration;
- deterministic fallback selection;
- provider/model quality comparison;
- live API billing setup;
- hosting deployment;
- browser storage of credentials;
- arbitrary runtime code generation;
- DungeonSpec generation directly from provider output.

Those remain DAI-044/045 and later hosting/security work.
