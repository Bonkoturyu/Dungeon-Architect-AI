# DAI-071 Browser Performance

## Status

**DONE.** Corrected production visible-Chrome evidence passed on 2026-09-17.

Reviewed evidence:

- generated: `2026-09-17T12:40:22.739Z`;
- Node.js: `v24.15.0`;
- Chrome: `152.0.7977.83`;
- viewport: `1440 × 900`;
- JSON SHA-256: `bb71503cdc7ff9e4be02f42fc94a79c96c4ef2ae658c8233e2e347b3fe574751`;
- PNG SHA-256: `78d0c6cfc0378eff69e7f9ebbeaf96305fad759e17cfc718d2e8c75ff06a308b`;
- `passed = true`;
- all 12 acceptance gates passed;
- editor client-ready latency after last resource response: `206.4 ms`;
- onboarding client-ready latency after last resource response: `215.2 ms`;
- cold local Vite navigation-to-ready remained recorded diagnostically at approximately `9.2 s`;
- 120-frame cadence: `3725.8 ms`, median `31.3 ms`, p95 `31.7 ms`, p99 `31.8 ms`, max `31.9 ms`;
- maximum measured local interaction latency: `20.1 ms`;
- Result: cleared in `2` moves over `3` visited rooms;
- Return to Edit restored valid START-eligible edit state;
- DOM nodes: `78`;
- canvas backing store: `1085 × 800` (`868000` pixels, DPR `1`);
- console/page/request/HTTP errors: `0`.

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

The first production attempt exposed a harness-boundary defect: the original `10,000 ms` startup gate used `performance.now()` from navigation start while the page was served by the Vite development server. The two navigation-to-ready gates failed, while cadence, local interactions, Result/Return flow, DOM/canvas bounds, and browser-error gates all passed.

That original value included cold dev-server module transformation and delivery, so it was not a clean measurement of the integrated browser application's client-side initialization.

The revised protocol does **not** hide that time. Cold local navigation-to-ready remains recorded as diagnostic evidence. The hard readiness gate starts at the last observed browser resource `responseEnd` and measures the remaining client-side time until the editor/onboarding ready boundary.

This preserves the relevant DAI-071 question—whether the loaded integrated browser surface initializes and responds acceptably—without pretending that local Vite cold-transform overhead is hosted production startup latency. Hosted end-to-end load behavior belongs to DAI-072/DAI-081 once the deployment target exists.

## Acceptance gates

The passing production run satisfied all of the following:

- editor client readiness after the last observed resource response within `2,000 ms`;
- onboarding client readiness after the last observed resource response within `2,000 ms`;
- editor valid and START-eligible;
- 120-frame cadence sample within `5,000 ms`;
- cadence p95 below `100 ms`;
- every measured local interaction within `250 ms`;
- Result reached in the expected two moves;
- Return to Edit restored edit mode and a valid START gate;
- no console/page/request/HTTP errors;
- DOM node count below `2,000`;
- canvas backing-store pixel count at or below the viewport pixel count.

These are regression gates for this submission build, not universal performance guarantees across all hardware.

## Explicit non-goals

- no hosted end-to-end startup claim before DAI-072/DAI-081;
- no cross-device performance claim;
- no mobile acceptance decision (DAI-075);
- no Safari/Firefox support claim without executed evidence;
- no GPU benchmark or energy-consumption claim;
- no replacement for the M1 renderer-selection evidence.
