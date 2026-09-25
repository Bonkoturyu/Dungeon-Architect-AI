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

## 8. Refreshed submission packaging is complete; final compliance remains

The earlier M8 candidate remains historical evidence only.

The current DAI-099 refreshed candidate completed:

- refreshed build and Cloudflare production deployment;
- fingerprint-matched public E2E on the current 2-floor runtime;
- refreshed legal/privacy/security checks;
- refreshed under-three-minute demo video and manual visual review;
- freeze preparation;
- immutable rollback point at `rollback/submission-candidate-dai-099-2026-09-24`.

DAI-090 then completed a 20-case unexpected-prompt regression against the same frozen runtime with an empty false-check list.

The remaining submission blocker is repository visibility: the GitHub repository is still private and must be made public before final submission and kept accessible during judging.

Final compliance/submission remains DAI-091/DAI-092.

## Reopen rule

If a later candidate removes one of these limitations, update this document in the same candidate change.
