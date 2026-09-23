# M1 Renderer Benchmark

## Purpose

Production task `DAI-010` compares approved browser renderer candidates with a clean-room production fixture.
Pre-production benchmark implementation is not copied.

## Fixed fixture

- Fixture ID: `DAI-M1-RENDERER-20-v1`
- Rooms: 20 (5 × 4)
- Corridors: 19
- Room size: 8 × 8 × 3
- Geometry: floor + 4 walls per room, corridor floor
- Total box meshes before renderer-specific batching: 119
- Canvas: 960 × 540
- Shadows: disabled
- Post-processing: disabled
- Physics/audio/AI: disabled
- Camera: fixed initial view

## Candidates in this harness

- `three@0.185.1`
- `@babylonjs/core@9.18.0`

These versions are approved only for the recorded production benchmark/candidate scope. This harness does not select a winner.

Unity remains a separate candidate and must be handled under the frozen production decision protocol. Lack of Unity measurement is not silently converted into rejection.

## Install

The audited root `package-lock.json` is tracked. Use the reviewed dependency graph:

```bash
npm ci --ignore-scripts
```

Do not use a newly resolved dependency graph as benchmark evidence without a fresh dependency review.

## Run fixture tests

```bash
npm run test:benchmark-fixture
```

## Run renderer benchmark

Chrome/Chromium is auto-detected from common paths. If needed:

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:DAI_BENCH_RUNS = '5'
npm run bench:renderers
```

Results are written under `artifacts/renderer-benchmark/` and are intentionally ignored by Git until reviewed.
A reviewed result should be copied into `docs/testing/` with environment metadata, interpretation, and limitations.

## Recorded metrics

- navigation-to-complete time;
- scene generation time;
- engine-reported/render-submission timing (diagnostic only unless a common first-visible-frame milestone is defined);
- frame time median / p95 / p99 while the browser scene is rendered on every sampled frame;
- median FPS derived from those rendered-frame intervals;
- object count;
- draw calls where directly available;
- active triangle count where directly available;
- console/page errors.

## Evidence rules

- Do not compare results from different devices as if they were one controlled benchmark.
- Do not substitute Pre results for production results.
- Do not declare a renderer selected until production evidence is recorded in an ADR.
- Run browser candidates in the same headed/headless mode and with equivalent browser launch constraints before comparing timing.
- Render the candidate scene on every sampled frame when interpreting frame/FPS metrics.
- Do not compare engine-specific `firstRenderMs` values unless all candidates use one common externally observable first-visible-frame milestone.
- If candidate equivalence differs materially, fix the fixture before interpreting performance.
