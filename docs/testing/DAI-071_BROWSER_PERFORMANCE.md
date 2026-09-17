# DAI-071 Browser Performance

## Status

**IN PROGRESS.** Integrated editor/play performance and Chrome browser evidence are implemented for validation; production evidence is pending.

## Purpose

DAI-071 verifies the current production browser surface after the editor, validation gate, natural-language edit UI, play loop, explainability work, and DAI-070 onboarding have been integrated.

This is intentionally different from the earlier M1 renderer-selection benchmark. M1 compared renderer candidates; DAI-071 checks the actual current editor/play application for startup responsiveness, interaction latency, browser errors, and basic resource bounds.

## Frozen production target

- desktop Google Chrome on Windows;
- viewport `1440 × 900`;
- `apps/editor-slice/index.html` served locally by the reviewed Vite dependency;
- current valid sample dungeon;
- onboarding dismissed before interaction measurements;
- no network/provider call required for the core performance probe.

## Evidence metrics

The visible-Chrome runner records:

- page navigation-to-editor-ready elapsed time;
- navigation-to-onboarding-ready elapsed time;
- DOM node count;
- canvas CSS and backing dimensions;
- Chrome JS heap usage when `performance.memory` is available;
- deterministic local interaction latencies for room selection, START, play movement to middle/goal, and Return to Edit;
- a short `requestAnimationFrame` cadence sample as a browser responsiveness signal;
- console, page, request, and HTTP errors.

## Acceptance gates

The production smoke must satisfy all of the following:

- editor and onboarding become ready within `10,000 ms`;
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

- no cross-device performance claim;
- no mobile acceptance decision (DAI-075);
- no Safari/Firefox support claim without executed evidence;
- no GPU benchmark or energy-consumption claim;
- no replacement for the M1 renderer-selection evidence.
