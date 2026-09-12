# M1 Renderer Benchmark Result — 2026-09-12

## Evidence

User-executed production benchmark on Windows using the clean-room benchmark harness from `feat/m1-renderer-benchmark`.

- Raw result file: `results-2026-09-12T14-42-43.512Z.json`
- Raw result SHA-256: `5163c73ea0ac30f3fd8d5e7927d90fc8a6a941229eaa07cd24e1931e8e0b5d5c`
- Node.js: `v24.15.0`
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Runs per candidate: 5
- Fixture: `DAI-M1-RENDERER-20-v1`
- Objects: 119
- Active triangles: 1428

The raw JSON remains external evidence for this review. This document records the reviewed metrics and interpretation.

## Three.js 0.185.1

| Metric | Median / reviewed value |
|---|---:|
| navigation complete | 5773.94 ms |
| scene generation | 4.40 ms |
| first render | 53.20 ms |
| frame median | 31.30 ms |
| frame p95 | 31.70 ms |
| median FPS | 31.95 |
| runtime errors | 0 across 5 runs |
| draw calls | 119 |
| triangles | 1428 |

Run 1 recorded a navigation-complete outlier of 18219.59 ms and one console 404. The other four navigation-complete values were approximately 5.74–5.82 seconds. The raw evidence does not identify the exact missing resource, so this console error is recorded as unresolved rather than silently ignored.

## Babylon.js 9.18.0

| Metric | Median / reviewed value |
|---|---:|
| navigation complete | 6891.43 ms |
| scene generation | 24.40 ms |
| first render | 67.60 ms |
| frame median | 31.20 ms |
| frame p95 | 31.60 ms |
| median FPS | 32.05 |
| runtime errors | 0 across 5 runs |
| triangles | 1428 |

Babylon.js draw-call data was not directly available from the current harness and is therefore not compared as if measured.

## Comparison

- Steady-state FPS/frame time is effectively tied under this fixture.
- Three.js has materially lower scene-generation time in this production run.
- Three.js also has lower median navigation-complete and first-render times.
- The Three.js first-run navigation outlier and 404 require follow-up, but the remaining four Three.js runs are internally consistent.
- No runtime error occurred in either renderer across the measured runs.

## Current decision

**Browser-renderer production evidence currently favors Three.js over Babylon.js for this project.**

This is not yet the final DAI-011 architecture decision because Unity remains an unrejected candidate under the frozen protocol. Production ADR selection must explicitly address Unity rather than treating absence of a browser-harness result as rejection.

## Next actions

1. Decide/execute the production Unity comparison path required by the frozen protocol.
2. Resolve or characterize the single Three.js 404 before final renderer ADR if it is reproducible.
3. After all required candidate evidence is complete, record DAI-011 as an ADR with selection, rejected alternatives, evidence and reversal conditions.
