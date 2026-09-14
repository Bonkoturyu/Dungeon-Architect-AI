# DAI-045 Live Prompt Regression

## Status

**DONE.** The same frozen ten-prompt corpus was rerun after clarifying the production `targetDuration` semantics. The rerun passed every frozen promotion gate and every directional intent-fit constraint. The current MVP cloud intent path may use OpenAI Responses API with `gpt-5.6-luna`, while provider/model selection remains server-configurable and reversible.

DAI-045 evaluates the DAI-042 initial cloud candidate through the real DAI-043 adapter and DAI-044 bounded routing policy. Unlike DAI-043/044 contract evidence, this phase makes live, billable provider calls.

## Candidate evaluated

- Provider: OpenAI Responses API
- Model: `gpt-5.6-luna`
- Reasoning effort: `low`
- Structured output: strict `DesignIntent` JSON Schema
- `store: false`
- Max output tokens: 4096
- Local model path: disabled for this live cloud regression
- Deterministic fallback: enabled through the production DAI-044 router

## Pricing snapshot

Checked 2026-09-13 against the official model page:

- input: $0.20 / 1M tokens
- output: $1.20 / 1M tokens
- source: <https://developers.openai.com/api/docs/models/gpt-5.6-luna>

The evidence runner uses this frozen snapshot to estimate cost from observed token usage. The estimate intentionally does not apply cached-input discounts.

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

The corpus and thresholds were not changed between the first live run and the duration-semantics rerun.

## Frozen candidate promotion gates

- at least 90% of cases finish with the Cloud candidate selected;
- Cloud-selected intent-fit constraint rate is at least 80%;
- fallback rate is at most 10%;
- all ten cases end with a valid `DesignIntent` through bounded routing;
- evidence contains neither the API key nor full prompt strings.

Latency, usage, estimated cost, retry count, HTTP/rate-limit errors, and deterministic-fallback baseline fit are also reviewed.

## First reviewed live run — 2026-09-14

Evidence generated at `2026-09-14T02:28:23.862Z` on Node.js `v24.15.0`.

Aggregate result:

- 10 / 10 valid `DesignIntent` results;
- Cloud selected: 10 / 10 (`100%`);
- fallback selected: 0 / 10 (`0%`);
- retry / rate-limit / HTTP errors: 0;
- Cloud intent-fit constraint rate: `90.625%`;
- deterministic fallback baseline fit: `78.125%`;
- total usage: 5,103 tokens;
- estimated total cost: `$0.0034326`;
- latency average: `3424.404 ms`;
- latency p50: `3236.191 ms`;
- latency p95/max: `4337.212 ms`;
- API-key leak: false;
- full-prompt leak: false.

Manual review found all three failed directional constraints were `targetDuration`:

| Case | Expected | First-run actual |
|---|---:|---:|
| `beginner-short` | `targetDuration <= 420` | `509` |
| `short-dangerous` | `targetDuration <= 420` | `1509` |
| `mixed-language-format` | `targetDuration <= 420` | `546` |

This was treated as a systematic translation weakness rather than three unrelated misses.

## Duration-semantics refinement

The production `DesignIntent` contract stores `targetDuration` as seconds. The clarification fixes its intended semantics without weakening the regression corpus:

- `targetDuration` is expected completion time for one normal playthrough;
- explicit durations are converted directly to seconds and take priority over qualitative length language;
- `5 minutes` means approximately `300` seconds;
- without an explicit duration, `short` / `brief` targets approximately `240..420` seconds;
- without an explicit duration, `long` targets approximately `720..1200` seconds;
- difficulty/content density must not silently inflate requested duration;
- negation such as `not long` must not be interpreted as a request for a long duration.

This rule belongs to the production intent contract and provider instruction boundary, not to the test harness.

## Reviewed rerun — 2026-09-14

Evidence generated at `2026-09-14T05:19:54.705Z` on Node.js `v24.15.0`.

Evidence SHA-256:

`6cd665167bdd21e1ee4e752e714e44d98b66e7ae171cfdd2a68b3c4cf3330f87`

Aggregate result:

- `passed = true`;
- all four frozen automated gates passed;
- 10 / 10 cases produced a valid `DesignIntent`;
- Cloud selected: 10 / 10 (`100%`);
- fallback selected: 0 / 10 (`0%`);
- retry cases: 0;
- rate-limited calls: 0;
- HTTP error calls: 0;
- Cloud intent-fit constraint rate: `100%`;
- deterministic fallback baseline fit constraint rate: `78.125%`;
- total usage: 3,741 input + 2,335 output = 6,076 tokens;
- estimated total cost: `$0.0035502`;
- average estimated cost/case: `$0.00035502`;
- latency average: `4576.104 ms`;
- latency p50: `4524.251 ms`;
- latency p95/max: `5374.432 ms`;
- API-key leak: false;
- full-prompt leak: false.

The three duration cases that failed in the first run now all satisfy the unchanged constraints:

| Case | Expected | First run | Rerun |
|---|---:|---:|---:|
| `beginner-short` | `<= 420 s` | `509 s` | `300 s` |
| `short-dangerous` | `<= 420 s` | `1509 s` | `300 s` |
| `mixed-language-format` | `<= 420 s` | `546 s` | `300 s` |

The intent-fit rate improved from `90.625%` to `100%`. The rerun used 973 more total tokens and the estimated total cost increased only from `$0.0034326` to `$0.0035502`. Latency increased versus the first run, but remained finite with no retry, fallback, rate-limit, HTTP error, or invalid-output event in the ten-case corpus.

## Decision

The current production MVP cloud intent path is accepted as:

- OpenAI Responses API;
- `gpt-5.6-luna`;
- `reasoning.effort = low`;
- strict `DesignIntent` structured output;
- DAI-044 bounded retry/fallback policy;
- deterministic fallback retained as the resilience path.

This is a project selection, not an irreversible architecture coupling. Provider/model remains backend configuration, and `DesignIntent`, `DungeonSpec`, Renderer, Editor, and Play Core remain provider-neutral. A future provider/model comparison is only required if later regression, cost, latency, availability, policy, or product requirements justify reopening the decision.

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

The generated local evidence path is:

`artifacts/prompt-regression/dai-045-live-prompt-regression.json`

## Secret handling

`scripts/run-dai-045-validation.ps1` accepts an existing process-local `OPENAI_API_KEY`. If none is present, it requests the key with hidden PowerShell input, exposes it only to the validation process, and removes that environment variable before exit.

Do not paste the API key into chat, GitHub, command-line arguments, a committed `.env`, screenshots, or evidence files.

## Completion gate result

DAI-045 completion gates are satisfied:

- complete production Node suite passed before the live rerun;
- same frozen live corpus rerun completed successfully;
- all frozen automated gates passed;
- all three previously observed duration misses were resolved without changing the corpus;
- latency, token usage, estimated cost, retry/error/fallback rates, and per-case fit were reviewed;
- evidence safety checks detected no API-key or full-prompt leak.

## Explicit non-goals

DAI-045 does not:

- deploy the public backend/hosting environment;
- select or package a browser-local LLM;
- use user/private prompts;
- send DungeonSpec to the provider;
- change DAI-044 retry bounds;
- generate or execute arbitrary code;
- complete final unexpected-prompt testing for M9.
