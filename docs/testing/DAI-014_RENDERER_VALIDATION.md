# DAI-014 Three.js Renderer Validation

## Status

IN PROGRESS.

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

## Local static preparation checks

Before repository write, the newly authored JavaScript modules were parsed with `node --check` in the assistant execution environment.
A representative pure scene-plan fixture exercised deterministic planning, corridor geometry, and invalid-spec rejection successfully.

These preparation checks are not a substitute for the repository's production test suite because the assistant environment did not execute against the installed reviewed npm graph.

## Required production validation

Run from the existing Windows clone:

```powershell
git fetch origin; git switch feat/dai-014-three-renderer; git pull --ff-only origin feat/dai-014-three-renderer; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-014-validation.ps1
```

The runner:

1. verifies the previously audited `package-lock.json` SHA-256;
2. performs `npm ci --ignore-scripts`;
3. runs the complete `npm test` suite including `test:renderer-three`;
4. starts Vite locally;
5. opens the smoke page in visible Chrome through `playwright-core`;
6. renders the existing `minimal-valid-v1` fixture twice;
7. verifies runtime object replacement plus Start/Goal lookup;
8. fails on browser console/page errors;
9. writes JSON evidence and a screenshot under `artifacts/renderer-smoke/`.

## DAI-014 completion gate

Do not mark DAI-014 DONE until the production validation command completes successfully and its JSON evidence is reviewed.
