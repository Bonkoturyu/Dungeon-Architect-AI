# DAI-014 Three.js Renderer Validation

## Status

**DONE — production validation passed on Windows/Chrome.**

The Three.js renderer adapter, renderer-independent scene planner, browser smoke page, and validation runner are implemented on `feat/dai-014-three-renderer`.

## Implemented

- `packages/renderer-three/src/scene-plan.js`
- `packages/renderer-three/src/three-renderer-adapter.js`
- `packages/renderer-three/src/index.js`
- `packages/renderer-three/test/scene-plan.test.js`
- `apps/renderer-smoke/index.html`
- `apps/renderer-smoke/main.js`
- `scripts/run-dai-014-renderer-smoke.mjs`
- `scripts/run-dai-014-validation.ps1`

## Boundary checks

- scene planning imports Core validation but does not import Three.js;
- Three.js runtime objects are created only inside `three-renderer-adapter.js`;
- serialized `DungeonSpec` remains unchanged and contains no runtime object references;
- invalid specs are rejected before scene runtime construction;
- repeated `render(spec)` clears/disposes previous geometry before creating replacement runtime objects;
- `getObjectBySpecId()` maps rooms/corridors/Start/Goal marker groups back to source Spec IDs.

## Production validation result

Executed on 2026-09-13 using the repository one-command validation flow.

Reviewed raw evidence:

- JSON file: `dai-014-renderer-smoke.json`
- JSON SHA-256: `71109720ccc9e7b97cd5e7bcaf4151d98f372b626e0385d156fe7abedd59e84d`
- screenshot: `dai-014-renderer-smoke.png`
- screenshot SHA-256: `30eb56a8755a6976d9ce5618c25b04c45fb66b12c740d04f545f346ace27174f`
- Chrome executable: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- smoke URL: `http://127.0.0.1:4173/apps/renderer-smoke/index.html`

Observed result:

- `ready = true`
- `failed = false`
- first render summary: 3 rooms / 2 corridors / 2 markers / 7 runtime object groups
- second render summary: 3 rooms / 2 corridors / 2 markers / 7 runtime object groups
- invalid spec rejected: true
- previous valid scene preserved after invalid render attempt: true
- runtime objects replaced on valid re-render: true
- Start marker lookup: true
- Goal marker lookup: true
- `consoleErrors = []`
- `pageErrors = []`
- `failedRequests = []`
- `httpErrors = []`

The screenshot visually confirms the three-room low-poly fixture, corridor connections, and distinct Start/Goal markers with the smoke status shown as `ready`.

## Verification gate result

DAI-014 acceptance conditions are satisfied for the minimal renderer slice:

- valid DungeonSpec renders in Chrome;
- rooms/corridors are generated deterministically from the Spec;
- Start and Goal are visually distinguishable;
- runtime objects are traceable to Spec IDs;
- invalid DungeonSpec is rejected before destructive runtime mutation;
- dispose/re-render path is exercised through object replacement;
- Core remains free of Three.js imports;
- browser smoke completes without console/page/network errors.

## Follow-up scope

DAI-014 does not include editor selection/drag behavior, gameplay runtime, final art direction, external assets, batching/instancing optimization, or final performance/mobile validation. Those remain in later tasks.
