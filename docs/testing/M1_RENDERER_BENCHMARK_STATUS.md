# M1 Renderer Benchmark Status — 2026-09-13

## Status

DAI-010: **DONE** — controlled production measurements have been completed and reviewed for Three.js, Babylon.js, and Unity WebGL.

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

Unity's final hardened benchmark completed 5/5 runs with zero runtime, console, page, request, and HTTP errors.

Three.js run 1 retains one unresolved 404/navigation outlier as a follow-up item. Runs 2–5 did not reproduce it, and it does not alter the five-run median.

## Decision

Three.js `0.185.1` is the selected production renderer for the hackathon browser MVP.

The decision is project-specific and reversible only under the conditions recorded in ADR-001.

## Next task

DAI-014: implement the minimal Three.js renderer adapter while keeping Core renderer-independent.
