# DAI-054 Validation / START Gate

## Status

**IN PROGRESS.** The editor now exposes live validation state and a START gate that bridges the authoring surface into the existing PlaySession runtime. Production visible-Chrome evidence is required before DAI-054 is marked DONE.

## Product rule

Critical validation errors must block START.

For the current production validator, every `validateDungeonSpec()` error is treated as Critical at the START boundary. `packages/editor-core/src/start-gate.js` converts validator output into:

- `allowed`
- `criticalCount`
- Critical error entries with code/path/message

The gate does not repair or weaken an invalid spec.

## Editor integration

The DAI editor now includes:

- a visible validation status (`PASS` or `BLOCKED`);
- a START button enabled only when the current authoring Spec has zero Critical errors;
- an immutable PlaySession snapshot created by `startPlaySession()`;
- editing controls disabled while Play/Result mode is active;
- room-click movement through `movePlaySession()`;
- Goal completion and Result generation through `createPlayResult()`;
- Return to Edit without mutating the authoring Spec.

This joins the existing DAI-051/053 authoring surface and DAI-016 play runtime in one browser experience.

## Production smoke scenario

`scripts/run-dai-054-start-gate-smoke.mjs` launches visible Chrome and verifies:

1. the current minimal authoring fixture reports validation PASS and enables START;
2. a deliberately unreachable clone (`corridors = []`) is rejected by the same gate and includes `GOAL_UNREACHABLE` without replacing the live authoring Spec;
3. START creates a PlaySession in `room-start`;
4. the execution snapshot matches the authoring rooms/entities at START;
5. authoring controls are disabled during Play mode;
6. room clicks move `room-start -> room-middle -> room-goal`;
7. Goal produces a cleared Result with two moves and three visited rooms;
8. Return to Edit preserves the original authoring state and re-enables START;
9. browser console/page/request/HTTP errors remain empty.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-054-validation-start-gate; git pull --ff-only origin feat/dai-054-validation-start-gate; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-054-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node suite, including START-gate unit tests;
4. launches the integrated editor/play flow in visible Chrome;
5. writes:
   - `artifacts/start-gate/dai-054-start-gate.json`
   - `artifacts/start-gate/dai-054-start-gate.png`

## Completion gate

Do not mark DAI-054 DONE until:

- complete production Node tests pass;
- valid authoring state enables START;
- invalid/unreachable Spec is blocked as Critical;
- START creates a fixed execution snapshot;
- authoring actions are disabled during Play;
- the integrated browser flow reaches Goal and creates a cleared Result;
- Return to Edit preserves authoring state;
- browser/network error arrays are empty;
- generated JSON evidence and screenshot are reviewed.

## Explicit non-goals

DAI-054 does not yet:

- implement final production art or gameplay UX;
- replace the pending PCE perspective/combat decision;
- add simulation/agent scoring;
- deploy the public hosted backend;
- expand the natural-language edit vocabulary beyond DAI-053.
