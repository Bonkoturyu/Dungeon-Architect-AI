# M1 Renderer Final Comparison — 2026-09-13

## Status

DAI-010 production evidence is complete for the three candidates required by the current renderer decision:

- Three.js `0.185.1`
- Babylon.js `9.18.0`
- Unity WebGL `6000.3.23f1`

All three used fixture `DAI-M1-RENDERER-20-v1` with 119 rendered box-equivalent objects and 1428 active triangles.

## Evidence

Browser renderer result:

- file: `results-2026-09-12T14-42-43.512Z.json`
- SHA-256: `5163c73ea0ac30f3fd8d5e7927d90fc8a6a941229eaa07cd24e1931e8e0b5d5c`
- runs: 5 per browser candidate

Unity result:

- file: `unity-results-2026-09-13T01-33-50.152Z.json`
- SHA-256: `828847e75b05abf4ecc84769c949c3c48866838fbca4a0e1f42182095745bf9b`
- runs: 5
- Unity version: `6000.3.23f1`

The Unity run passed the hardened zero-error gate:

- `runtimeErrors = 0` for all five runs
- `consoleErrors = []`
- `pageErrors = []`
- `failedRequests = []`
- `httpErrors = []`

## Median results

| Candidate | Navigation complete | Scene generation | First render | Frame median | Frame p95 | Median FPS |
|---|---:|---:|---:|---:|---:|---:|
| Three.js 0.185.1 | 5773.94 ms | 4.40 ms | 53.20 ms | 31.30 ms | 31.70 ms | 31.95 |
| Babylon.js 9.18.0 | 6891.43 ms | 24.40 ms | 67.60 ms | 31.20 ms | 31.60 ms | 32.05 |
| Unity WebGL 6000.3.23f1 | 8477.78 ms | 7.00 ms | 2115.00 ms | 31.00 ms | 32.00 ms | 32.26 |

## Interpretation

- Steady-state frame cadence is effectively tied for this fixture; all three are around 32 FPS.
- Three.js has the lowest median navigation-complete time.
- Three.js has the lowest median scene-generation time.
- Three.js has the lowest median first-render time.
- Unity's scene-generation time is competitive with the browser libraries, but its first-render/startup cost is materially higher in this browser workflow.
- Babylon.js remains viable but does not lead any measured decision metric used here.

### Three.js run-1 anomaly

Three.js run 1 recorded:

- `navigationCompleteMs = 18219.5922`
- one console 404
- `runtimeErrors = 0`

Runs 2–5 did not reproduce the console error and their navigation-complete values were approximately 5.74–5.82 seconds.

The missing resource was not identified in the raw evidence. The anomaly remains an explicit follow-up item and must not be silently erased. It does not change the five-run median.

## DAI-010 result

**DONE.**

The production renderer benchmark now has valid evidence for all three candidates required by the current decision set.

## DAI-011 recommendation

Select **Three.js 0.185.1** as the production renderer for the browser MVP.

This recommendation is limited to the current Dungeon Architect AI browser MVP and may be reversed if the reversal conditions in ADR-001 are met.
