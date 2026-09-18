# DAI-081 Hosted Demo — Generation Surface Integration

## Status

**DONE.** Both hosted-demo functional gates and the required DAI-074/080 post-integration re-audits passed.

1. integrate the missing DESCRIBE → GENERATE surface into the production browser build and validate it locally;
2. deploy the merged candidate to Cloudflare Pages, configure the production secret, and validate the real public HTTPS URL end-to-end.

Gate 1 and Gate 2 are complete; this document records the final hosted-demo evidence.

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
6. run `scripts/run-dai-081-public-validation.ps1` against the resulting `https://*.pages.dev` URL.

DAI-081 functional acceptance is complete because the public HTTPS smoke passed, and the required post-integration privacy/public-doc re-audits also passed.

The Gate-2 public smoke requires:

- HTTPS deployment;
- five-step onboarding including Describe;
- live DesignIntent generation selecting `cloud` rather than fallback;
- generated START-eligible 5..20 room DungeonSpec;
- generated Start/Goal/enemy/treasure/trap and supported event;
- live natural-language edit against the generated spec;
- both `/api/design-intent` and `/api/natural-edit` returning HTTP 200;
- generated dungeon clearing to Goal;
- Return to Edit preserving the generated spec;
- zero browser/page/request/HTTP errors.

Run:

```powershell
$env:DAI_PUBLIC_URL = 'https://<project>.pages.dev'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-081-public-validation.ps1
```

Expected evidence:

- `artifacts/hosting-public/dai-081-public.json`;
- `artifacts/hosting-public/dai-081-public.png`.

## Gate-2 public production evidence

Reviewed public evidence generated at `2026-09-18T15:58:08.818Z` with Node.js `v24.15.0` and Chrome `153.0.8010.50`.

- public URL: `https://dungeon-architect-ai.pages.dev/`;
- evidence JSON SHA-256: `2fdd088c8de25be64169ce0dd617e40c04467d9303e1ca686a312d55b817a8b1`;
- screenshot PNG SHA-256: `6d35333cf4e21f0766ca0c0e6477803b2a35f7cde37754b5d8dcb47566dee3fb`;
- navigation ready: ~1787.257 ms;
- `passed = true`;
- all 13 public gates passed;
- live generation selected `cloud`;
- generated 5 rooms, routeChoice 0.55, 8 entities and 1 event;
- generated entity types included enemy / goal / recovery / start / trap / treasure;
- live natural-language edit produced `move-entity / treasure-1 / room-005`;
- `/api/design-intent` returned 200;
- `/api/natural-edit` returned 200;
- generated dungeon cleared in 4 moves, visiting all 5 rooms;
- Return to Edit preserved the generated spec;
- console/page/request/HTTP errors were empty;
- local API key was not required and full prompts were excluded from evidence.

## Governance finalization

The required DAI-074 and DAI-080 re-audits passed after the hosted generation endpoint and public claims were added.

- DAI-074 re-audit JSON SHA-256: `087af17acc04f4a46b7522e18e97d45de503ea9a9ba74bdcb9eeff726cfb2d18`;
- DAI-080 re-audit JSON SHA-256: `ff1f8fbeee18ea8143ffc07bb7594461eaad1c90ebaa7cb0e125755fdee5bc1e`.

DAI-081 is complete.

## Boundaries

- local gate-1 smoke mocks provider HTTP responses; it proves browser integration, not live provider availability;
- cloud intent quality remains backed by DAI-045 live regression;
- live public generation/natural-edit calls passed Gate 2;
- this task does not select Perspective/Combat or add mobile support.
