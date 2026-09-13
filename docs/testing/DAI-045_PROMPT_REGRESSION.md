# DAI-045 Live Prompt Regression

## Status

**IN PROGRESS.** The production live-regression harness and frozen 10-prompt corpus are ready. Permanent provider/model promotion requires reviewed live evidence.

DAI-045 evaluates the DAI-042 initial cloud candidate through the real DAI-043 adapter and DAI-044 bounded routing policy. Unlike DAI-043/044 contract evidence, this phase makes live, billable provider calls.

## Candidate under test

- Provider: OpenAI Responses API
- Model: `gpt-5.6-luna`
- Reasoning effort: `low`
- Structured output: strict `DesignIntent` JSON Schema
- `store: false`
- Max output tokens: 4096
- Local model path: disabled for this first live cloud regression
- Deterministic fallback: enabled through the production DAI-044 router

The candidate is not permanently promoted merely because the live harness runs successfully.

## Pricing snapshot

Checked 2026-09-13 against the official model page:

- input: $0.20 / 1M tokens
- output: $1.20 / 1M tokens
- source: <https://developers.openai.com/api/docs/models/gpt-5.6-luna>

The evidence runner uses this frozen snapshot to estimate cost from observed token usage. The estimate is intentionally conservative and does not apply cached-input discounts.

## Frozen prompt corpus

`spec/design-intent/fixtures/dai-045-prompt-regression-v1.json` contains the ten production categories already required by `docs/testing/TEST_PLAN.md`:

1. beginner / short dungeon
2. short-dangerous vs long-safe
3. greed punishment
4. scary but low combat
5. first run hard, second run learnable
6. mean but fair
7. confusing but not boring
8. contradictory prompt
9. unsupported request
10. unexpected language/input format

The corpus is synthetic project test data and contains no personal information, secret, or third-party creative material.

Each case has directional `DesignIntent` expectations. These are regression constraints, not claims that one exact numeric intent is the only valid design interpretation.

## Candidate promotion gates

The first production gate is deliberately small and interpretable:

- at least 90% of cases must finish with the Cloud candidate selected;
- Cloud-selected intent-fit constraint rate must be at least 80%;
- fallback rate must be at most 10%;
- all ten cases must still end with a valid `DesignIntent` through bounded routing;
- evidence must contain neither the API key nor full prompt strings.

Latency, usage, estimated cost, retry count, HTTP/rate-limit errors, and deterministic-fallback baseline fit are always recorded for review even when the automated gate passes.

A passing run is evidence for the current Luna candidate, not an irreversible provider decision. If the fit gate fails materially, `gpt-5.6-terra` remains the next comparison candidate under DAI-042.

## Live runner

`scripts/run-dai-045-live-prompt-regression.mjs`:

- loads the frozen corpus;
- calls the real backend-only OpenAI transport;
- routes through DAI-044 with Local disabled and deterministic fallback enabled;
- permits at most two Cloud attempts per prompt;
- records prompt IDs but never copies full prompt text into evidence;
- independently validates every accepted `DesignIntent`;
- scores directional expectations;
- records Cloud/fallback selection and retry rates;
- records HTTP status, latency, token usage, and estimated cost;
- compares semantic-fit constraints with the deterministic fallback baseline;
- checks the serialized evidence for API-key or full-prompt leakage before writing it.

The resulting file is:

`artifacts/prompt-regression/dai-045-live-prompt-regression.json`

## Secret handling

`scripts/run-dai-045-validation.ps1` accepts an existing process-local `OPENAI_API_KEY`. If none is present, it requests the key with hidden PowerShell input, exposes it only to the validation process, and removes that environment variable before exit.

Do not paste the API key into chat, GitHub, a command-line argument, a committed `.env`, screenshots, or evidence files.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-045-prompt-regression; git pull --ff-only origin feat/dai-045-prompt-regression; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-045-validation.ps1
```

The runner first executes the complete production Node test suite. It then warns that the next step makes live billable API calls and securely prompts for the API key when needed.

The frozen corpus contains ten prompts. A normal first-pass success uses ten provider calls; bounded retry can raise this to at most twenty provider calls.

## Completion gate

Do not mark DAI-045 DONE or permanently promote the provider/model until:

- the complete production Node suite passes;
- live prompt-regression evidence is generated and reviewed;
- the frozen automated gates pass, or a documented model escalation/comparison is completed;
- latency, token usage, estimated cost, retry/error/fallback rate, and per-case intent fit are reviewed;
- the evidence safety checks show no API-key or full-prompt leak.

## Explicit non-goals

This phase does not:

- deploy the public backend/hosting environment;
- select or package a browser-local LLM;
- use user/private prompts;
- send DungeonSpec to the provider;
- change DAI-044 retry bounds;
- generate or execute arbitrary code;
- complete final unexpected-prompt testing for M9.
