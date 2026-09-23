# M1 Renderer Benchmark Result — 2026-09-12

## 2026-09-23 review correction

This file preserves the historical 2026-09-12 measurements, but a later PR-review audit found protocol limitations that prevent several columns from being used as controlled renderer-comparison evidence:

- the original Three.js/Babylon.js frame sampler measured `requestAnimationFrame` cadence without rendering the scene on each sampled frame;
- the browser-library run used headless Chrome while the Unity WebGL run used headed Chrome;
- `firstRenderMs` did not represent the same first-visible-frame milestone across browser libraries and Unity.

Therefore the historical frame/FPS, navigation-complete, and first-render values below are retained as raw historical observations, **not** as apples-to-apples performance proof. The benchmark harness was corrected on 2026-09-23 for future browser-library reruns (headed Chrome and rendering on every sampled frame).

The Three.js production decision remains in force because subsequent production implementation and browser acceptance demonstrated the selected renderer is suitable for this browser MVP; ADR-001 no longer treats the flawed historical timing comparison as decisive evidence.


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

## Corrected interpretation

- The recorded browser-library frame/FPS values measure RAF cadence from the historical harness and must not be described as steady-state renderer throughput.
- Browser-library versus Unity navigation/first-render timing is not directly comparable because browser mode and first-frame milestones differed.
- The Three.js run-1 navigation outlier and 404 remain part of the historical record.
- No runtime error occurred in the recorded Three.js/Babylon.js runs, but absence of runtime errors does not repair the timing-protocol mismatch.

## Current decision

DAI-011 subsequently selected Three.js and that architecture decision remains confirmed, but **the historical timing table is no longer treated as the decisive basis for the selection**.

The corrected basis is documented in ADR-001: browser-first architectural fit plus the substantial production evidence accumulated after selection (renderer adapter, editing/picking, public hosted E2E, performance/browser gates, and later gameplay/UI regressions).

## Follow-up

The browser benchmark harness now renders every sampled frame and uses headed Chrome with the same WebGL-related launch flags used by the Unity browser runner. A future comparative benchmark must also define one common externally observable first-visible-frame milestone before using first-frame timing across engines.
