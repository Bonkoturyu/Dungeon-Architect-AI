# DAI-081 Hosted Demo — Generation Surface Integration

## Status

**IN PROGRESS — Gate 1 DONE.** DAI-081 is split into two evidence gates.

1. integrate the missing DESCRIBE → GENERATE surface into the production browser build and validate it locally;
2. deploy the merged candidate to Cloudflare Pages, configure the production secret, and validate the real public HTTPS URL end-to-end.

This document covers gate 1. DAI-081 remains open until gate 2 passes.

## Generation path

The integrated browser flow is:

```text
DESCRIBE
  ↓
POST /api/design-intent
  ↓
Cloud DesignIntent when configured
  or deterministic fallback
  ↓
validated DesignIntent
  ↓
deterministic browser DungeonSpec generation
  ↓
EDIT → VALIDATE → START → PLAY → RESULT
```

Provider credentials remain server-side.

## Deterministic DesignIntent → DungeonSpec mapping

The current MVP generation profile deliberately maps only production-backed fields:

- Seed: deterministic hash of the normalized prompt;
- room count: approximately one room per requested minute, clamped to 5..20;
- `routeChoice`: mapped directly to the production room-graph routeChoice parameter;
- enemy / treasure / trap counts: bounded 1..4 from their DesignIntent densities;
- recovery: one when difficulty/fairness calls for it;
- generated content always contains Start, Goal, enemy, treasure, trap;
- at least one supported working-logic event is emitted: opening the first treasure reveals a one-shot hint.

This is a bounded MVP mapping, not a claim that every DesignIntent axis has a full semantic generator implementation.

## Hosted DesignIntent Function

`functions/api/design-intent.js`:

- accepts prompt only;
- caps request body size;
- uses the server-side OpenAI credential when configured;
- routes through the existing DAI-044 Cloud → fallback semantics;
- uses deterministic fallback when no cloud credential is present;
- returns validated DesignIntent + provider/model/usage metadata only;
- uses `Cache-Control: no-store`;
- does not echo the full prompt or secret.

## Updated onboarding

The browser guide becomes:

`welcome → describe → edit → validate → play`.

The valid sample remains available at startup so judges can still evaluate the editor/play loop even if the provider is unavailable.

## Gate-1 production evidence contract

The built production surface must verify:

- five-step onboarding includes Describe;
- a generation request is sent once;
- response DesignIntent generates a deterministic 5-room spec for the frozen smoke request;
- generated spec is valid and START-eligible;
- generated spec contains Start / Goal / enemy / treasure / trap;
- generated spec contains at least one supported event;
- existing natural-language edit still works against the generated spec;
- generated dungeon can START and clear to Goal;
- Return to Edit preserves the generated authoring spec;
- browser/page/request/HTTP errors remain empty.

Expected gate-1 evidence:

- `artifacts/generation-surface/dai-081-generation-surface.json`;
- `artifacts/generation-surface/dai-081-generation-surface.png`.

## Gate-1 production evidence

Reviewed evidence generated at `2026-09-18T14:03:18.185Z` with Node.js `v24.15.0` and Chrome `153.0.8010.50`.

- evidence JSON SHA-256: `43c527c79c65ffe29dfb0a9fed33bb31881a5f5f93932627353d11ad7c353f56`;
- screenshot PNG SHA-256: `045965983d2c45655968b540670ae98acd99453c13490b99ef4802e92aefa66f`;
- `passed = true`;
- all 12 integration checks passed;
- onboarding order: `welcome → describe → edit → validate → play`;
- one DesignIntent request was emitted;
- generated profile: provider `cloud`, seed `4171513421`, 5 rooms, routeChoice `0.6`, 9 entities, 1 event;
- generated entity types included enemy / goal / recovery / start / trap / treasure;
- generated authoring state was valid and START-eligible;
- natural-language edit continued to work against the generated spec;
- generated dungeon cleared Goal in 4 moves across all 5 rooms;
- Return to Edit preserved the generated authoring spec;
- console/page/request/HTTP error collections were empty;
- evidence stored neither the full generation prompt nor a provider secret.

Gate 1 is complete. DAI-081 remains open only because the real public HTTPS deployment and live provider E2E gate has not run yet.

## Gate 2 — public deployment

After gate 1 merges to `main`:

1. create/connect the Cloudflare Pages project;
2. production build command: `npm run build:hosting`;
3. output: `dist/`;
4. add `OPENAI_API_KEY` as a production Secret;
5. deploy `main`;
6. run a public smoke against the resulting `https://*.pages.dev` URL.

DAI-081 is **not DONE** until the public HTTPS smoke passes.

## Boundaries

- local gate-1 smoke mocks provider HTTP responses; it proves browser integration, not live provider availability;
- cloud intent quality remains backed by DAI-045 live regression;
- final live public generation/natural-edit calls are required in gate 2;
- this task does not select Perspective/Combat or add mobile support.
