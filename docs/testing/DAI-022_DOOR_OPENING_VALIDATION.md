# DAI-022 Walls / Door Openings / Start / Goal Validation

## Status

**DONE — production Windows/Chrome validation passed on 2026-09-13.**

DAI-022 closes the structural mismatch where corridor floor geometry previously passed through continuous room walls.
The implementation carves deterministic wall openings from the corridor rectangle while preserving renderer-independent `DungeonSpec` input.

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

## Production Chrome evidence

Visible Chrome smoke used:

`spec/dungeon/fixtures/pce-perspective-combat-20-v1.json`

Reviewed raw evidence:

- JSON file: `dai-022-door-smoke.json`
- JSON SHA-256: `652c0972b4a4761e3c69370a994f0f84af2349e383a386d01253b8dc8c16499d`
- screenshot: `dai-022-door-smoke.png`
- screenshot SHA-256: `1e82abc9e01ba686b57b4d98040171a1115a4847b7511b8173e743a8f0861347`
- source Spec: `pce-perspective-combat-20-v1`

Observed result:

- `ready = true`
- `failed = false`
- rooms: 20
- corridors: 22
- Start/Goal markers: 2
- runtime object groups: 44
- total structural wall openings: 50
- rooms with at least one opening: 20
- diagonal/corner corridor count: 3
- missing corridor endpoint openings: 0
- `consoleErrors = []`
- `pageErrors = []`
- `failedRequests = []`
- `httpErrors = []`

The screenshot visually confirms the 20-room PCE fixture renders as one connected structural layout with wall passages instead of continuous walls blocking the corridors.

## Completion gate result

DAI-022 acceptance conditions are satisfied for the structural passage slice:

- cardinal passage openings are deterministic;
- diagonal corridor corner crossings are supported;
- overlapping openings on one wall are merged before wall segmentation;
- every one of the 22 corridors has an opening at both endpoint rooms;
- all 20 rooms participate in at least one opening;
- Start and Goal remain present;
- the renderer-independent `DungeonSpec` boundary is preserved;
- the visible Chrome smoke completed without browser/network errors.

## Explicit non-goals

This result does not claim dynamic lock/unlock door logic, keys, combat, treasure/trap interactions, final art direction, or a PCE-1.0 Perspective/Combat winner. Those remain later scope / Pending Evidence.
