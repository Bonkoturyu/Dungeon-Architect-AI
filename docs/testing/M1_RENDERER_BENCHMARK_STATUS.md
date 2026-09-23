# M1 Renderer Benchmark Status — 2026-09-13

## Status

DAI-010: **DONE as a historical candidate-evaluation record.** The 2026-09-23 review audit found protocol mismatches that prevent treating several historical timing columns as controlled cross-engine performance evidence.

DAI-011: **DONE** — ADR-001 selects Three.js `0.185.1` for the browser MVP.

## Candidates measured

- `three@0.185.1`
- `@babylonjs/core@9.18.0`
- Unity WebGL `6000.3.23f1`

Supporting tooling:

- `vite@8.1.5`
- `playwright-core@1.62.0`

## Fixed production fixture

- ID: `DAI-M1-RENDERER-20-v1`
- 20 rooms / 19 corridors
- 119 box-equivalent rendered objects
- 1428 active triangles
- 960×540 canvas
- no shadows / post-processing / gameplay / audio / AI
- same logical camera/geometry rules across candidates
- five runs per candidate

## 2026-09-23 evidence correction

The fixed logical fixture was shared, but the historical execution protocol was not fully equivalent:

- Three.js/Babylon.js RAF sampling did not render every sampled frame;
- browser libraries ran headless while Unity ran headed;
- first-render milestones were engine-specific;
- an explicit Unity tier-eligibility confirmation for that historical run is not retained.

The table below is preserved as historical raw-result summary only. Do not use it to rank steady-state FPS, navigation/startup, or first-visible-frame performance across the three engines.

The browser harness has since been corrected to render each sampled frame and use headed Chrome for future reruns.

## Reviewed result

See:

- `docs/testing/M1_RENDERER_BENCHMARK_RESULT_2026-09-12.md`
- `docs/testing/M1_RENDERER_FINAL_COMPARISON_2026-09-13.md`
- `docs/architecture/adr/ADR-001-PRODUCTION-RENDERER-THREEJS.md`

Median results:

| Candidate | Navigation complete | Scene generation | First render | Median FPS |
|---|---:|---:|---:|---:|
| Three.js 0.185.1 | 5773.94 ms | 4.40 ms | 53.20 ms | 31.95 |
| Babylon.js 9.18.0 | 6891.43 ms | 24.40 ms | 67.60 ms | 32.05 |
| Unity WebGL 6000.3.23f1 | 8477.78 ms | 7.00 ms | 2115.00 ms | 32.26 |

Unity's historical hardened benchmark recorded 5/5 runs with zero runtime, console, page, request, and HTTP errors; this execution observation does not repair the protocol/tier-evidence limitations above.

Three.js run 1 retains one unresolved 404/navigation outlier as a follow-up item. Runs 2–5 did not reproduce it, and it does not alter the five-run median.

## Decision

Three.js `0.185.1` remains the selected production renderer for the hackathon browser MVP.

ADR-001 now records that the retained decision is grounded in the browser-first architecture plus substantial subsequent production evidence, not in treating the historical timing table as a controlled winner. The decision remains project-specific and reversible under ADR-001's conditions.

## Historical next task

At the time of this status snapshot, DAI-014 was next. It has since been completed along with later production renderer/editor/gameplay work.
