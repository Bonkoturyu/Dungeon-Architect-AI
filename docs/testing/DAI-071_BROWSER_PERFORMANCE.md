# DAI-071 Browser Performance

## Status

**IN PROGRESS.** Integrated editor/play performance and Chrome browser evidence are implemented for validation; production evidence is pending.

## Purpose

DAI-071 verifies the current production browser surface after the editor, validation gate, natural-language edit UI, play loop, explainability work, and DAI-070 onboarding have been integrated.

This is intentionally different from the earlier M1 renderer-selection benchmark. M1 compared renderer candidates; DAI-071 checks the actual current editor/play application for client-side readiness, interaction latency, browser errors, and basic resource bounds.

## Frozen production target

- desktop Google Chrome on Windows;
- viewport `1440 × 900`;
- `apps/editor-slice/index.html` served locally by the reviewed Vite dependency;
- current valid sample dungeon;
- onboarding dismissed before interaction measurements;
- no network/provider call required for the core performance probe.

## Startup measurement boundary

The first production attempt exposed a harness-boundary defect: the original `10,000 ms` startup gate used `performance.now()` from navigation start while the page was served by the Vite development server. That value includes cold dev-server module transformation and delivery, so it is not a clean measurement of the integrated browser application's client-side initialization.

The revised protocol does **not** hide that time. Cold local navigation-to-ready remains recorded as diagnostic evidence. The hard readiness gate instead starts at the last observed browser resource `responseEnd` and measures the remaining client-side time until the editor/onboarding ready boundary.

This preserves the relevant DAI-071 question—whether the loaded integrated browser surface initializes and responds acceptably—without pretending that local Vite cold-transform overhead is hosted production startup latency. Hosted end-to-end load behavior belongs to DAI-072/DAI-081 once the deployment target exists.

## Evidence metrics

The visible-Chrome runner records:

- cold local navigation-to-editor-ready elapsed time as a diagnostic value;
- cold local navigation-to-onboarding-ready elapsed time as a diagnostic value;
- last observed resource `responseEnd` and client-ready latency after that boundary;
- navigation timing metadata;
- DOM node count;
- canvas CSS and backing dimensions;
- Chrome JS heap usage when `performance.memory` is available;
- deterministic local interaction latencies for room selection, START, play movement to middle/goal, and Return to Edit;
- a short `requestAnimationFrame` cadence sample as a browser responsiveness signal;
- console, page, request, and HTTP errors.

## Acceptance gates

The production smoke must satisfy all of the following:

- editor client readiness after the last observed resource response completes within `2,000 ms`;
- onboarding client readiness after the last observed resource response completes within `2,000 ms`;
- editor remains valid and START-eligible;
- 120-frame cadence sample completes within `5,000 ms`;
- cadence p95 is below `100 ms`;
- each measured local interaction completes within `250 ms`;
- Result is reached in the expected two moves;
- Return to Edit restores edit mode and a valid START gate;
- no console/page/request/HTTP errors are observed;
- DOM node count remains below `2,000`;
- canvas backing-store pixel count remains at or below the viewport pixel count because the renderer uses pixel ratio `1`.

These are regression gates for this submission build, not universal performance guarantees across all hardware.

## Expected evidence

- `artifacts/browser-performance/dai-071-browser-performance.json`
- `artifacts/browser-performance/dai-071-browser-performance.png`

## Required production validation

```powershell
git fetch origin; git switch feat/dai-071-browser-performance; git pull --ff-only origin feat/dai-071-browser-performance; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-071-validation.ps1
```

## Explicit non-goals

- no hosted end-to-end startup claim before DAI-072/DAI-081;
- no cross-device performance claim;
- no mobile acceptance decision (DAI-075);
- no Safari/Firefox support claim without executed evidence;
- no GPU benchmark or energy-consumption claim;
- no replacement for the M1 renderer-selection evidence.
