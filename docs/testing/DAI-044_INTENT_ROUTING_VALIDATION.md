# DAI-044 Intent Routing / Retry Validation

## Status

**IN PROGRESS.** Production implementation is ready for deterministic contract validation.

DAI-044 completes the provider-neutral routing layer between the DAI-043 cloud adapter, an optional future browser-local intent source, and the deterministic fallback parser.

This task does not make live OpenAI requests and does not approve a local LLM runtime/model. It fixes the retry, timeout, cancellation, fallback, and observability semantics that later live-provider and browser-local implementations must obey.

## Source contract

The production implementation reuses only the clean-room routing knowledge frozen during pre-production EXP-005:

- routing policy is separated from provider adapters;
- preferred order is Cloud → eligible Local → deterministic fallback;
- Cloud and Local may each be attempted at most twice (one retry);
- fallback is attempted once;
- invalid/timeout/unavailable outcomes may move to the next bounded attempt/source;
- cancellation terminates immediately and must not fall through to Local/fallback;
- capability-ineligible sources must not be called;
- raw outputs must still pass the independent production `DesignIntent` validator;
- routing must converge to success, explicit failure, or cancellation.

No pre-production routing implementation source is copied.

## Production API

`packages/cloud-intent/src/intent-router.js` exports:

- `routeDesignIntent(prompt, options)`
- `classifyIntentAttempt(result, context)`
- `parseRetryAfterMs(value, options)`
- `MAX_LLM_ATTEMPTS = 2`
- finite default attempt timeout and retry-delay budget constants

The router accepts injected Cloud / Local / fallback attempt functions. This keeps policy independent of provider-specific HTTP or local-runtime implementations.

## Eligibility

Cloud is eligible only when:

- `cloudConfigured = true`
- `cloudProxyHealthy = true`
- a cloud attempt function exists

Local is eligible only when:

- `localModelCached = true`
- `webgpuAvailable = true`
- a local attempt function exists

Because the production browser-local runtime/model decision is still Open, DAI-044 does not ship or approve a concrete local model. It only defines the contract an approved future local adapter must satisfy.

## Attempt limits

- Cloud: maximum 2 attempts total
- Local: maximum 2 attempts total
- deterministic fallback: exactly 1 attempt

There is no unbounded loop and no third LLM attempt.

## Timeout and cancellation

Every source attempt is wrapped in a finite routing timeout. The router races the attempt against its timeout boundary, so even a non-cooperative source that ignores `AbortSignal` cannot block routing indefinitely.

User/external cancellation is terminal:

- routing returns `status = cancelled`;
- no additional Cloud retry occurs;
- Local is not called;
- deterministic fallback is not called.

## Retry-After behavior

For normalized Cloud `429` failures:

- `Retry-After` delta-seconds and HTTP-date forms can be parsed;
- the observed retry delay is recorded in the sanitized attempt trace;
- one retry may occur only when the delay is within the routing retry-delay budget;
- a `Retry-After` above the budget suppresses the Cloud retry and moves routing onward instead of sleeping without bound.

The retry-delay budget is a project routing safety policy, not an account-specific provider rate limit.

## Outcome normalization

Attempts converge to one of:

- `valid`
- `invalid`
- `timeout`
- `unavailable`
- `cancelled`

DAI-043 normalized Cloud errors are classified into this provider-neutral vocabulary. Future local adapters can supply the same categories without leaking runtime-specific types into `DesignIntent` or `DungeonSpec`.

## Deterministic fallback

If no eligible LLM source returns a valid independently validated intent, routing uses the existing production deterministic fallback parser once.

Fallback failure is explicit (`FALLBACK_FAILED`) rather than silently returning malformed intent.

## Observability / privacy

The attempt trace records only routing metadata such as:

- source/provider class
- attempt number
- normalized outcome
- normalized error code
- duration
- `Retry-After` / retry-delay decision where relevant

It does **not** store the full prompt, provider secret, raw provider response, or DungeonSpec.

## Test coverage

`packages/cloud-intent/test/intent-router.test.js` covers:

- Cloud first-attempt success;
- one Cloud retry after invalid output;
- Cloud timeout exhaustion then Local success;
- capability-ineligible LLM routes falling directly to fallback;
- cancellation stopping all further routing;
- Cloud + Local invalid exhaustion then fallback;
- explicit fallback failure;
- two-attempt upper bound;
- bounded `Retry-After` wait;
- over-budget `Retry-After` retry suppression;
- finite timeout for a source that ignores `AbortSignal`;
- independent validation of apparently successful source output;
- no full-prompt leakage into attempt traces;
- delta-seconds and HTTP-date `Retry-After` parsing.

## Production evidence scenario

`scripts/run-dai-044-intent-routing.mjs` reimplements the production scenarios from the frozen routing contract without importing pre-production source or fixtures.

It exercises Cloud, optional Local, and fallback routes using injected deterministic fake attempts. It makes no provider call and loads no local model.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-044-intent-routing; git pull --ff-only origin feat/dai-044-intent-routing; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-044-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node suite;
4. runs deterministic routing evidence scenarios;
5. writes `artifacts/intent-routing/dai-044-intent-routing.json`.

## Completion gate

Do not mark DAI-044 DONE until:

- the full production Node suite passes;
- evidence reports `passed = true`;
- no scenario exceeds two attempts for an LLM source;
- cancellation never falls through;
- fallback is bounded to one attempt;
- the generated JSON evidence is reviewed.

## Explicit non-goals

DAI-044 does not:

- select or package a browser-local LLM runtime/model;
- make live provider requests;
- determine permanent provider/model quality winner;
- deploy backend hosting;
- set real account rate limits or budgets;
- implement prompt-regression scoring.

Those remain DAI-045 and later browser-local / hosting / security work.
