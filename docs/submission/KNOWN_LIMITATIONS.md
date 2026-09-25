# Known Limitations — Current Submission Candidate

These limitations keep judge-facing claims narrower than verified production evidence.

## 1. DesignIntent → DungeonSpec mapping is deliberately bounded

The public demo now supports DESCRIBE → GENERATE, but not every DesignIntent axis has a unique authored mechanic.

The current mapping uses production-backed controls such as:

- prompt-derived deterministic Seed;
- target duration → bounded room count;
- routeChoice → alternate-route structure;
- combat/reward/trap density → bounded entity counts;
- fairness/difficulty → recovery presence;
- at least one supported treasure-triggered event.

This is not a claim that every nuanced intent is perfectly realized.

## 2. Natural-language edit vocabulary is narrow

The integrated AI edit path returns exactly one safe `EditCommand` and currently supports entity relocation (`move-entity`).

It does not expose arbitrary multi-command editing, free-form runtime code, room/corridor generation, or event editing from natural language.

## 3. Perspective and combat selection are Pending Evidence

PCE-1.0 remains blocked by:

- three candidate Play cameras with equivalent controls/tasks;
- remaining Perspective/Combat evaluation interactions;
- P01–P12 participant sessions.

The current top-down Play slice is an engineering implementation, **not** a declared PCE winner.

## 4. Player locomotion is room-graph based

The current Play UI moves by selecting connected rooms. It is not a first/third-person physics character controller and does not claim final physical collision gameplay.

## 5. Mobile is outside the supported submission scope

ADR-003 confirms desktop Google Chrome on Windows as the supported judging target. Mobile/narrow is best-effort only.

## 6. Browser support is deliberately narrow

Production acceptance evidence exists for desktop Google Chrome on Windows.

No Safari or Firefox support claim is made.

## 7. No persistence/accounts

The MVP has no accounts, cloud save, database, analytics/telemetry, or persistent browser project storage.

Authoring/play state is in memory for the active page session.

## 8. Submission freeze and final compliance

The refreshed DAI-099 candidate is complete:

- 22/22 predeploy acceptance passed;
- refreshed Cloudflare production deployment completed;
- public E2E passed against the exact candidate commit/runtime-source fingerprint;
- legal/privacy/metadata gates passed;
- the refreshed 59.9-second demo video was captured and manually reviewed;
- freeze preparation passed;
- rollback branch `rollback/submission-candidate-dai-099-2026-09-24` was created.

DAI-090 unexpected-prompt verification subsequently passed 20/20 malformed, contradictory, oversized, mixed-language, injection-like and unsupported-input cases without requiring a runtime fix.

The remaining submission work is DAI-091 final compliance/public repository readiness and DAI-092 submission.

## Reopen rule

If a later candidate removes one of these limitations, update this document in the same candidate change.
