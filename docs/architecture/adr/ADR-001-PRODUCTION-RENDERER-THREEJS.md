# ADR-001 — Production Renderer: Three.js 0.185.1

## Status

**Confirmed**

Decision date: 2026-09-13

## Context

Dungeon Architect AI requires a browser experience that can:

1. render a generated `DungeonSpec`,
2. transition quickly from generate/edit to visible 3D output,
3. remain independent from renderer-specific objects in Core,
4. support the later Edit Mode and Play Mode slices,
5. stay compatible with a lightweight browser-first architecture.

DAI-010 compared the three renderer candidates under the production clean-room fixture before DAI-011 selection.

## Candidates

- Three.js `0.185.1`
- Babylon.js `9.18.0`
- Unity WebGL `6000.3.23f1`

## Evidence

Primary production evidence:

- `docs/testing/M1_RENDERER_BENCHMARK_RESULT_2026-09-12.md`
- `docs/testing/M1_RENDERER_FINAL_COMPARISON_2026-09-13.md`
- raw browser result SHA-256: `5163c73ea0ac30f3fd8d5e7927d90fc8a6a941229eaa07cd24e1931e8e0b5d5c`
- raw Unity result SHA-256: `828847e75b05abf4ecc84769c949c3c48866838fbca4a0e1f42182095745bf9b`

Median comparison:

| Candidate | Navigation complete | Scene generation | First render | Median FPS |
|---|---:|---:|---:|---:|
| Three.js | 5773.94 ms | 4.40 ms | 53.20 ms | 31.95 |
| Babylon.js | 6891.43 ms | 24.40 ms | 67.60 ms | 32.05 |
| Unity WebGL | 8477.78 ms | 7.00 ms | 2115.00 ms | 32.26 |

The Unity result passed the zero-error benchmark gate across all five runs.

## Decision

Use **Three.js `0.185.1`** as the production renderer for the hackathon browser MVP.

Renderer boundary:

- Core owns `DungeonSpec`, validation, generation, simulation and authoring state.
- Core must not import Three.js types.
- The Three.js adapter may import Core contracts/functions.
- Renderer runtime objects must never be serialized into `DungeonSpec`.
- UI editing continues through `EditCommand`.
- Renderer state is disposable/rebuildable from a valid spec/snapshot.

## Why

The production benchmark shows no meaningful steady-state FPS advantage for Babylon.js or Unity under the fixed fixture.

Three.js provides the best measured browser-start/render profile of the three candidates:

- lowest median navigation-complete time,
- lowest median scene-generation time,
- lowest median first-render time.

This matches the MVP's browser-first `DESCRIBE → GENERATE → EDIT → START → PLAY` loop, where repeated transitions into visible 3D output are a first-order concern.

## Rejected alternatives

### Babylon.js 9.18.0

Rejected for the current MVP renderer selection.

Reason:

- steady-state frame cadence is effectively tied with Three.js,
- scene generation and first-render medians are higher in the production fixture,
- no measured benefit currently offsets those differences.

This is not a statement that Babylon.js is generally inferior; it is a project-specific selection.

### Unity WebGL 6000.3.23f1

Rejected for the current browser MVP renderer selection.

Reason:

- steady-state FPS is competitive,
- scene generation is reasonably close to Three.js,
- browser first-render/startup cost is materially higher in the production fixture,
- navigation-complete median is also higher.

Unity remains useful elsewhere in the developer's toolset, but this ADR does not select it for Dungeon Architect AI's browser MVP.

## Risks

- Three.js run 1 had one unresolved 404 and a navigation outlier.
- The fixed benchmark is intentionally small and does not prove performance for large dungeons.
- Draw-call behavior will need production profiling once renderer geometry and selection overlays are implemented.
- No renderer decision substitutes for later browser/mobile/device testing.
- Future WebGPU-specific requirements could change the trade-off.

## Reversal conditions

Re-open this ADR if any of the following occurs:

1. DAI-014 cannot render a valid <20-room fixture without violating Core/renderer boundaries.
2. The selected Three.js version causes a repeatable critical browser/runtime failure.
3. A representative production dungeon misses the later performance gate while another already-reviewed candidate passes it under the same production fixture.
4. Required editing/picking behavior cannot be implemented without materially increasing architecture complexity compared with another candidate.
5. A license/provenance issue invalidates `three@0.185.1`.
6. A material platform requirement changes, such as mandatory Unity-specific integration or a different rendering backend requirement.

## Verification

DAI-011 is complete when the repository contains:

- this ADR,
- the final production comparison,
- updated Decision Log,
- updated M1 backlog state,
- production runtime scope approval for `three@0.185.1`.

DAI-014 then implements the minimal Three.js renderer adapter.
