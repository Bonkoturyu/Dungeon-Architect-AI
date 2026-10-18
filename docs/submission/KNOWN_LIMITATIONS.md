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

The integrated AI Edit V3 path returns exactly one safe `EditCommand` from 11 supported command types:

`move-entity`, `move-room`, `resize-room`, `add-entity`, `remove-entity`, `add-room`, `remove-room`, `add-corridor`, `remove-corridor`, `reconnect-corridor`, `set-corridor-doors`.

Batch transactions, Event editing, arbitrary runtime code, corridor-width editing and doorway-offset editing remain unsupported. Independent validation and editor preflight can reject an unsafe or unrouteable command. Fixture coverage of the command set is distinct from live-provider semantic coverage; see [AI Edit V3](../../spec/edit-command/NATURAL_EDIT_V3.md) and [the acceptance record](../testing/ACCEPTANCE_GAP_2026-10-03.md).

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

## 8. Submission packaging requires a refreshed candidate

The historical hosted demo, under-three-minute demo video, short description, focus category, and DAI-084 rollback point were completed for the earlier M8 candidate.

The browser Recommended selection is V3 with 11 selectable strategies, the current content layer and fixed-Seed 70% trap avoidance. These changes supersede the older M8 / September DAI-099 runtime. The 150-second v2 video is retained as the current video candidate; the older videos and rollback points remain historical.

The initial recovery baseline is saved at `rollback/pre-submission-2026-10-04` (`8bcce65246663bc16625a0f915ec2f202c63b5e4`). This is a recovery point, not final acceptance. The [Windows r3 local integrated suite](../testing/WINDOWS_PR75_R3_FINAL_LOCAL_2026-10-04.md) passed all 24 stages at PR #75 commit `8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531` (Node 628/628; 15 browser stages / 253 checks). This measured SHA is distinct from subsequent commits, which include runtime changes outside the r3 scope (2026-10-05 review remediation, GLB Export in PR #78, and the detail-HUD module split in PR #81). Remaining checks include public build identity / full public E2E, public Generate/Edit abnormal-input coverage, subjective audio review, DAI-090 Final, candidate/video/evidence consistency, final freeze, repository visibility and submission; see [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) and the r3 scope boundaries. A missing old audit script alone is not evidence that prior security/provenance audits were never performed.

Final compliance/submission remains DAI-091/DAI-092.

## 9. GLB export is a static, single-floor appearance export

**GLB · current floor (3D visuals)** saves only the currently displayed floor's geometry and materials for other 3D tools. Multiple floors are not stacked automatically; switch floors to export each one separately.

The GLB contains no gameplay rules, progress, editing handles, camera, lighting, fog, audio or animation, and it cannot be re-imported into Dungeon Architect AI. Use JSON export for re-editing.

## 10. Behavior when the cloud AI is unavailable

If the cloud AI path is unavailable (for example provider errors or rate limits), the server switches to the bounded deterministic fallback, which understands a narrower Japanese/English vocabulary and always attaches review warnings. With **Manual** generation (the default), the review dialog shows those warnings and generation can continue after review. With **Auto** generation, the warnings stop generation and the current dungeon is left unchanged. **AI Edit** has no fallback: it reports an error code and leaves the current dungeon unchanged, while manual editing remains available.

## Reopen rule

If a later candidate removes one of these limitations, update this document in the same candidate change.
