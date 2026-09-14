# DAI-045 Live Prompt Regression

## Status

**IN PROGRESS — same-corpus rerun required.**

The first live run passed the frozen automated promotion gates, but review found a systematic `targetDuration` interpretation weakness. The frozen ten-prompt corpus and its gates remain unchanged. The production intent instructions now clarify the existing `targetDuration` product semantics, and the same corpus must be rerun before DAI-045 is marked DONE or the current cloud candidate is promoted.

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

The candidate is not permanently promoted merely because a live run passes.

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

The corpus and thresholds are frozen during the duration-semantics refinement. The fix must not weaken or rewrite the failing expectations.

## Candidate promotion gates

The frozen production gate is:

- at least 90% of cases must finish with the Cloud candidate selected;
- Cloud-selected intent-fit constraint rate must be at least 80%;
- fallback rate must be at most 10%;
- all ten cases must still end with a valid `DesignIntent` through bounded routing;
- evidence must contain neither the API key nor full prompt strings.

Latency, usage, estimated cost, retry count, HTTP/rate-limit errors, and deterministic-fallback baseline fit are always recorded for review even when the automated gate passes.

## First reviewed live run — 2026-09-14

Evidence generated at `2026-09-14T02:28:23.862Z` on Node.js `v24.15.0`.

Aggregate result:

- 10 / 10 cases produced a valid `DesignIntent`;
- Cloud selected: 10 / 10 (`100%`);
- deterministic fallback selected: 0 / 10 (`0%`);
- retry cases: 0;
- rate-limited calls: 0;
- HTTP error calls: 0;
- Cloud intent-fit constraint rate: `90.625%`;
- deterministic fallback baseline fit constraint rate: `78.125%`;
- total usage: 2,691 input + 2,412 output = 5,103 tokens;
- estimated total cost: `$0.0034326`;
- average estimated cost/case: `$0.00034326`;
- latency average: `3424.404 ms`;
- latency p50: `3236.191 ms`;
- latency p95/max: `4337.212 ms`;
- API-key leak check: false;
- full-prompt leak check: false.

The frozen automated gates therefore passed. However, manual review found all three failed directional constraints were the same field:

| Case | Expected | Actual | Review |
|---|---:|---:|---|
| `beginner-short` | `targetDuration <= 420` | `509` | explicit ~5-minute request drifted long |
| `short-dangerous` | `targetDuration <= 420` | `1509` | qualitative short / not-long request was interpreted as ~25 minutes |
| `mixed-language-format` | `targetDuration <= 420` | `546` | explicit `5 min` drifted long |

This is treated as a systematic translation weakness rather than three unrelated misses.

## Duration-semantics refinement

The production `DesignIntent` contract already stores `targetDuration` as seconds. The refinement makes its intended meaning explicit without altering the frozen regression corpus:

- `targetDuration` is expected completion time for one normal playthrough;
- an explicit duration is converted directly to seconds and takes priority over qualitative length language;
- `5 minutes` means approximately `300` seconds;
- without an explicit duration, `short` / `brief` targets approximately `240..420` seconds;
- without an explicit duration, `long` targets approximately `720..1200` seconds;
- difficulty/content density must not silently inflate the requested duration;
- negation such as `not long` must not be interpreted as a request for a long duration.

This rule belongs to the product intent contract and provider instruction boundary, not to the test harness. The same frozen prompts and expectations are rerun after the clarification.

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

## Required production rerun

Run from the Windows clone after pulling the duration-semantics refinement:

```powershell
git fetch origin; git switch feat/dai-045-prompt-regression; git pull --ff-only origin feat/dai-045-prompt-regression; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-045-validation.ps1
```

The runner first executes the complete production Node test suite. It then warns that the next step makes live billable API calls and securely prompts for the API key when needed.

The frozen corpus contains ten prompts. A normal run uses ten provider calls; bounded retry can raise this to at most twenty provider calls.

## Completion gate

Do not mark DAI-045 DONE or permanently promote the provider/model until:

- the complete production Node suite passes after the duration-semantics change;
- the same frozen live prompt-regression corpus is rerun and reviewed;
- the frozen automated gates pass;
- the three previously observed duration misses are explicitly reviewed in the rerun;
- latency, token usage, estimated cost, retry/error/fallback rate, and per-case intent fit are reviewed;
- the evidence safety checks show no API-key or full-prompt leak;
- if the systematic duration weakness remains material, a separate model/provider comparison is considered instead of weakening the corpus.

## Explicit non-goals

This phase does not:

- deploy the public backend/hosting environment;
- select or package a browser-local LLM;
- use user/private prompts;
- send DungeonSpec to the provider;
- change DAI-044 retry bounds;
- generate or execute arbitrary code;
- complete final unexpected-prompt testing for M9.
