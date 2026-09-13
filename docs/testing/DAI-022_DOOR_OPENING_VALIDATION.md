# DAI-022 Walls / Door Openings / Start / Goal Validation

## Status

**IN PROGRESS.**

DAI-022 closes the structural mismatch where corridor floor geometry previously passed through continuous room walls.
The current implementation carves deterministic wall openings from the corridor rectangle while preserving renderer-independent `DungeonSpec` input.

## Implemented geometry

`packages/renderer-three/src/scene-plan.js` now:

- treats each corridor as an oriented rectangle in the X/Z plane;
- intersects that rectangle with each endpoint room's four wall segments;
- records plain-data `doorOpenings` on the corresponding room scene-plan group;
- carves wall boxes around the resulting opening intervals rather than drawing a continuous wall through the corridor;
- supports cardinal and diagonal corridors;
- supports a corridor crossing a room corner by opening both affected walls;
- merges overlapping opening intervals on the same wall before generating wall segments;
- leaves corridor floor, Start marker, Goal marker, Core contracts, and serialized `DungeonSpec` unchanged.

These are structural passage openings. Lock/unlock door-state logic remains a later event/runtime concern.

## Geometry rules

For each wall point, the implementation projects it into corridor-local coordinates:

- longitudinal coordinate must lie between the corridor endpoint room centers;
- lateral coordinate must lie within half the corridor width;
- the remaining interval on the finite room wall becomes the opening.

This avoids assuming all corridors are axis-aligned. A diagonal corridor can legitimately create an opening on two adjoining walls near a corner.

## Node tests

`packages/renderer-three/test/scene-plan.test.js` covers:

- deterministic planning;
- unchanged corridor center/rotation geometry;
- cardinal corridor openings on matching endpoint walls;
- diagonal corner crossings opening both affected walls;
- merging overlapping openings on one wall;
- invalid `DungeonSpec` rejection.

The production PCE fixture test also remains part of `npm test`.

## Browser smoke fixture

The visible Chrome smoke uses:

`spec/dungeon/fixtures/pce-perspective-combat-20-v1.json`

Expected invariant:

- 20 rooms;
- 22 corridors;
- 2 Start/Goal markers;
- every corridor has at least one wall opening at both endpoint rooms;
- every room participates in at least one opening;
- no console/page/request/HTTP errors.

The test intentionally does not claim dynamic door logic, combat, treasure/trap interactions, or PCE user-study results.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-022-door-openings; git pull --ff-only origin feat/dai-022-door-openings; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-022-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. performs `npm ci --ignore-scripts`;
3. runs the complete production Node test suite;
4. starts Vite locally;
5. renders the 20-room PCE production fixture in visible Chrome;
6. verifies wall-opening coverage for all corridor endpoints;
7. writes JSON evidence and a screenshot under `artifacts/door-smoke/`.

Expected evidence:

- `artifacts/door-smoke/dai-022-door-smoke.json`
- `artifacts/door-smoke/dai-022-door-smoke.png`

## Completion gate

Do not mark DAI-022 DONE until the one-command production validation passes and its JSON/screenshot evidence is reviewed.
