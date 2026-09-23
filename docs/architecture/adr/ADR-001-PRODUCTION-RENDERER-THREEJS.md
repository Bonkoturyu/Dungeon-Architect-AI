# ADR-001 — Production Renderer: Three.js 0.185.1

## Status

**Confirmed**

Decision date: 2026-09-13


Review correction: 2026-09-23

A historical PR-review audit found that the original DAI-010 timing protocol was not apples-to-apples for several metrics: browser-library RAF samples did not render each frame, browser libraries ran headless while Unity ran headed, and first-render milestones differed. The repository also does not retain an explicit Unity tier-eligibility confirmation for that historical run.

The raw benchmark hashes and table are retained for traceability, but **FPS, navigation-complete, and first-render values from that run are no longer decision-quality comparative evidence**. The Three.js decision remains confirmed based on the architecture boundary below and extensive subsequent production evidence on the selected renderer.

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

Three.js remains the production choice because it fits the browser-first boundary with low integration complexity and has since been validated directly in the product:

- the production Three.js adapter renders the shared DungeonSpec without leaking renderer types into Core;
- picking, room/corridor editing, visibility projection, and programmatic gameplay presentation are implemented and regression-tested;
- browser/performance gates and the hosted public E2E have passed on the selected stack;
- later DAI-085–096 and Play-UI acceptance runs continued to pass on the same renderer boundary.

The historical DAI-010 timing table is retained as context only. It is not used to claim that Three.js won steady-state FPS or first-frame performance against Babylon.js/Unity.

## Rejected alternatives

### Babylon.js 9.18.0

Not selected for the current MVP renderer.

The historical benchmark timing is no longer used as the reason for rejection. Three.js had already been selected and subsequently accumulated the production adapter, editing, hosted-E2E, and regression evidence required by the current browser MVP. No current requirement justifies paying the migration cost to Babylon.js.

This is not a statement that Babylon.js is generally inferior; it is a project-specific selection.

### Unity WebGL 6000.3.23f1

Not selected for the current browser MVP renderer.

The historical Unity timing is no longer used as a comparative rejection reason because browser mode/first-frame milestones differed and a retained operator tier-eligibility confirmation is missing. The current browser-first application is already implemented and accepted on Three.js, and no current requirement requires a Unity runtime.

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
