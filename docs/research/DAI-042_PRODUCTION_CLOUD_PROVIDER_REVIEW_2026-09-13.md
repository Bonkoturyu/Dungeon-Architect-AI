# DAI-042 Production Cloud Provider Review — 2026-09-13

## Status

**DONE for provider review / Initial integration candidate selected.**

This review selects the first production integration candidate for DAI-043. It does **not** claim a permanent provider winner before production prompt-regression evidence exists.

The pre-production audit is used only as transferable research knowledge. Current provider facts below were rechecked against official documentation on 2026-09-13.

## Product requirement

Dungeon Architect AI needs a cloud model only for transforming normalized natural-language design intent into the existing renderer-independent `DesignIntent` contract.

The cloud provider must not generate arbitrary runtime code. Runtime game logic remains the fixed validated vocabulary implemented by DAI-033.

## Non-negotiable production gates

1. Provider credentials are backend-only. The browser must never receive an API key.
2. Browser code talks only to a project-owned backend/proxy boundary.
3. The provider response must be constrained to a structured `DesignIntent` payload and then passed through the independent production validator.
4. Provider output is never trusted merely because it is syntactically valid JSON.
5. Provider retry is finite: maximum one provider retry before deterministic fallback.
6. Timeout and cancellation are finite and explicit.
7. `429` / rate-limit handling must use provider response data such as `Retry-After`; no account-specific rate limit is hard-coded.
8. Standard application logs may contain request ID, provider, model ID, attempt, latency, token counts, status/failure category, and fallback use. They must not contain API secrets, full prompt text, or full generated DungeonSpec.
9. User input sent to a cloud model must not contain secrets, unnecessary personal information, or unlicensed third-party material.
10. Provider/model choice is server configuration, not a serialized `DungeonSpec` dependency.

## Current official candidate review

### Candidate A — OpenAI Responses API + GPT-5.6 Luna

Production model candidate: `gpt-5.6-luna`.

Current official properties checked 2026-09-13:

- Responses API supported;
- Structured Outputs supported;
- current standard token price: USD 0.20 / 1M input tokens and USD 1.20 / 1M output tokens;
- API/business inputs and outputs are not used to train OpenAI models by default unless the customer explicitly opts in;
- OpenAI may retain API inputs/outputs for up to 30 days for service/abuse-monitoring purposes except where different documented controls apply;
- eligible customers can request Zero Data Retention, but DAI does not make ZDR a launch prerequisite;
- Responses `store` defaults to true when omitted, therefore DAI must explicitly send `store: false`;
- `store: false` is a response-storage control and must not be represented as equivalent to ZDR.

DAI-043 must use JSON Schema Structured Outputs and then run the independent local `DesignIntent` validator.

Official sources:

- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/reference/cli/resources/responses/methods/create
- https://openai.com/enterprise-privacy/
- https://openai.com/index/offering-zero-data-retention-for-frontier-models/
- https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/

### Candidate B — Gemini Developer API Paid + Gemini 3.8 Flash

Production comparison candidate: `gemini-3.8-flash` on a billing-enabled Paid project.

Current official properties checked 2026-09-13:

- Gemini Interactions API is the recommended default interface for new projects as of June 2026;
- structured JSON output is supported, using a documented JSON Schema subset;
- application-side semantic validation is still required;
- introductory standard price through 2026-12-31: USD 0.75 / 1M input tokens and USD 3.75 / 1M output tokens;
- Paid-tier content is not used to improve Google products;
- Gemini API logging on billing-enabled projects is configurable and, when used, has documented retention windows; shared log datasets have different data-use implications.

DAI must not use the Free tier for the public production demo because the Free/Paid data-use boundary differs.

Official sources:

- https://ai.google.dev/gemini-api/docs
- https://ai.google.dev/gemini-api/docs/interactions-overview
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/latest-model
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/logs-policy

### Candidate C — Claude API + Claude Sonnet 5

Production comparison candidate: `claude-sonnet-5`.

Current official properties checked 2026-09-13:

- structured JSON output is supported through `output_config.format`;
- current standard price is USD 2 / 1M input tokens and USD 10 / 1M output tokens;
- structured outputs are ZDR-eligible subject to the documented Covered Models/account boundary;
- prompt/response content is not retained for eligible structured-output ZDR processing, while the JSON schema may be cached for up to 24 hours;
- schema definitions therefore must not contain user secrets or sensitive user data.

Official sources:

- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5

## Production decision for DAI-043

### Initial integration candidate

Use **OpenAI Responses API with `gpt-5.6-luna`** as the first production cloud adapter candidate.

Rationale:

- it satisfies the required Structured Output path;
- its current direct token price is materially lower than the other reviewed primary candidates;
- the Responses API exposes the controls DAI needs for stateless structured generation, including explicit `store: false`;
- it allows DAI-043 to be implemented with a small server-side HTTP adapter and no provider SDK dependency;
- the provider-independent adapter boundary makes replacement or A/B evaluation possible without coupling `DesignIntent`, `DungeonSpec`, Renderer, Editor, or Play Core to OpenAI types.

This is an **integration selection**, not yet a permanent quality winner.

### Quality escalation candidate

`gpt-5.6-terra` may be evaluated as a higher-cost quality escalation candidate in DAI-045 if Luna fails prompt-regression or semantic intent-fit gates. It is not enabled automatically by DAI-042.

## DAI-043 required request boundary

The first OpenAI adapter must:

- execute only on the backend/proxy side;
- obtain its API key from server-side secret configuration;
- call `/v1/responses`;
- set `model` from server configuration, default candidate `gpt-5.6-luna`;
- explicitly set `store: false`;
- use `text.format.type = json_schema` with the production DesignIntent schema and strict mode;
- use a bounded `max_output_tokens` value;
- send no tools because this stage is extraction/translation only;
- parse provider output without executing it;
- run independent `validateDesignIntent` after parse;
- expose normalized provider failure categories rather than raw provider exceptions to browser code;
- never return the API key, authorization header, or internal provider request body to the browser.

## DAI-045 evidence gate before permanent provider adoption

Run the same prompt-regression corpus with fixed schema/version and comparable output limits. Record at least:

- schema/parse valid rate;
- independent semantic-valid rate;
- intent-fit fixture pass rate;
- p50/p95 end-to-end latency;
- input/output token counts;
- estimated per-request cost;
- provider 429/error rate;
- retry rate;
- deterministic fallback rate.

A provider/model can be promoted as the permanent production default only after this evidence exists. If Luna misses the required quality gate, compare Terra and/or the other reviewed providers through the same adapter contract rather than weakening validation.

## Decision boundary

Confirmed by DAI-042:

- first cloud integration candidate: OpenAI Responses API + `gpt-5.6-luna`;
- browser-secret prohibition;
- `store: false` for OpenAI Responses;
- structured output plus independent validation;
- provider-neutral backend adapter boundary;
- finite retry/fallback/logging constraints.

Still Open / Pending Evidence:

- permanent cloud-provider/model winner;
- Luna vs Terra quality escalation policy;
- production hosting provider;
- actual account/project rate limits and spend cap;
- hosted-demo latency/cost measurements;
- final PII/data-retention disclosure for public deployment.
