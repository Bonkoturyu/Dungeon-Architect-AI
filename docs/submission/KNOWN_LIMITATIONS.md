# Known Limitations — Current Submission Candidate

These limitations are intentionally public so the judge-facing claims remain narrower than the verified evidence.

## 1. Initial full-dungeon generation UI is not integrated yet

The backend DesignIntent pipeline and procedural DungeonSpec generator both exist and have production tests, but the current integrated editor/play page opens a valid sample dungeon.

The initial **DESCRIBE → GENERATE** prompt UI is therefore still a submission blocker. The current page must not be described as proving the full hackathon end-to-end requirement until that integration exists.

## 2. Current browser fixture is intentionally small

The integrated judge-facing editor/play surface currently uses a small three-room sample fixture for deterministic authoring, validation, START, Play, and Result evidence.

Other production tests exercise larger/generated structures, including the migrated 20-room PCE fixture, but those are not the same as a final polished judge demo.

## 3. Natural-language edit vocabulary is narrow

The current integrated AI edit path returns exactly one safe `EditCommand` and presently supports entity relocation (`move-entity`).

It does not yet expose arbitrary multi-command editing, free-form runtime code, room generation, corridor editing, or event editing from natural language.

## 4. Perspective and combat selection are still Pending Evidence

PCE-1.0 remains blocked by:

- three candidate Play cameras with equivalent controls/tasks;
- the remaining Perspective/Combat evaluation interactions;
- P01–P12 participant sessions.

The current top-down Play slice is an engineering implementation, **not** a declared PCE winner.

## 5. Mobile is outside the supported submission scope

ADR-003 confirms:

- supported judging target: desktop Google Chrome on Windows;
- mobile/narrow: best-effort only.

The 390 × 844 smoke only verifies graceful limitation disclosure and layout integrity. It is not Android/iOS acceptance.

## 6. Browser support is deliberately narrow

Production browser evidence exists for desktop Google Chrome on Windows.

No Safari or Firefox support claim is made.

## 7. No persistence/accounts

The current MVP has:

- no accounts;
- no cloud save;
- no database;
- no analytics/telemetry;
- no persistent browser project storage.

Authoring/play state is in memory for the active page session.

## 8. Public deployment is not final yet

Cloudflare Pages + Pages Functions is the confirmed hosting architecture, but the final judge-facing `pages.dev` URL and deployed end-to-end acceptance remain DAI-081 work.

## 9. Final submission media/metadata remain open

The under-three-minute video, short written description, focus category, and frozen candidate hash are M8 follow-up tasks.

## Reopen rule

If a later candidate removes one of these limitations, the public docs must be updated in the same PR or candidate-freeze change that removes it.
