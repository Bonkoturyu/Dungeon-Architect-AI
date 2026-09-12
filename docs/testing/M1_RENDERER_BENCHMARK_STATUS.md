# M1 Renderer Benchmark Status — 2026-09-12

## Status

DAI-010: **IN PROGRESS** — production clean-room benchmark harness is prepared, but the controlled renderer measurements have not completed yet.

## What is ready

Scoped production review approved exact candidate packages for benchmark use:

- `three@0.185.1`
- `@babylonjs/core@9.18.0`
- `vite@8.1.5`
- `playwright-core@1.62.0`

Production branch now contains a newly implemented benchmark harness under `benchmarks/renderers/` and `scripts/run-renderer-benchmark.mjs`.
The fixture is independent from the pre-production benchmark implementation.

Fixed production fixture:

- ID: `DAI-M1-RENDERER-20-v1`
- 20 rooms / 19 corridors
- 119 box meshes before renderer-specific batching
- 960×540 canvas
- no shadows / post-processing / physics / audio / AI
- same camera and geometry rules for Three.js and Babylon.js

Static source checks performed while preparing the harness:

- all newly prepared JavaScript files parsed successfully with `node --check`
- pure fixture verification returned `20 rooms / 19 corridors / 119 boxes`

These checks are not renderer benchmark results.

## Current execution limitation

The assistant execution environment still cannot install the reviewed npm packages because npm registry access times out / cannot resolve reliably.
No production renderer measurement is therefore claimed from that environment.

The Windows one-command runner is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-m1-renderer-benchmark.ps1
```

It will:

1. locate Chrome or use `CHROME_PATH`
2. install the exact reviewed benchmark dependencies with install scripts disabled
3. print resolved top-level versions
4. run the production test suite
5. run five measurements per Three.js/Babylon.js candidate
6. write raw JSON to `artifacts/renderer-benchmark/`

Raw output and `package-lock.json` must be reviewed before they become evidence/committed artifacts.

## Unity candidate

Unity 6000.3.20f1 remains a Candidate toolchain and is not selected/rejected by the browser harness.
Unity must be handled according to the frozen production decision protocol; lack of measurement is not a rejection.

## Rule

- Do not substitute Pre benchmark results for production measurements.
- Do not mark DAI-010 complete until production measurements are reviewed.
- Do not mark DAI-011 complete until an ADR records the production evidence and decision.
- Headless numbers alone are not treated as complete user-visible UX evidence.
