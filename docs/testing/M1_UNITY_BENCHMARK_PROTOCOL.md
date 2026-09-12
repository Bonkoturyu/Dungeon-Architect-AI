# M1 Unity WebGL Benchmark Protocol

## Status

Prepared for DAI-010 production comparison.
This is a clean-room production implementation and does not copy pre-production Unity experiment code.

## Candidate

- Unity Editor: `6000.3.20f1`
- Build target: WebGL / Release
- External assets: none
- Third-party runtime packages: none beyond Unity-provided engine/runtime

## Fixed fixture

The Unity candidate must reproduce the same logical fixture used by the current production browser benchmark:

- Fixture ID: `DAI-M1-RENDERER-20-v1`
- Rooms: 20 (5 × 4)
- Corridors: 19
- Room size: 8 × 8 × 3
- Room geometry: floor + 4 walls
- Corridor geometry: floor only
- Primitive objects: 119
- Active triangles: 1428
- Canvas: 960 × 540
- Shadows: disabled
- Post-processing: disabled
- Physics/gameplay/audio/AI: disabled
- Camera: position `(24, 38, 62)`, target `(24, 0, 18)`
- Frame samples: 179 effective samples after warm first frame
- Runs: 5

## Metrics

The browser runner records:

- navigation-to-complete time
- Unity-reported scene generation time
- first rendered frame time
- frame median / p95 / p99
- median FPS
- primitive/object count
- triangle count
- browser console errors
- Unity runtime errors

## Validity rules

- Do not compare a different fixture as equivalent.
- Do not use a Development Build.
- Do not enable shadows, post-processing, physics, audio, gameplay, or AI.
- Do not use pre-production experiment implementation source.
- Do not substitute pre-production measurements.
- Do not treat a missing Unity result as a rejection.
- Do not select a renderer until DAI-011 records an ADR.
- A material fixture/protocol change requires a new benchmark revision.

## Unity licensing gate

Before running Unity, the operator must use a Unity plan for which they are currently tier-eligible.
The script does not attempt to determine account eligibility.

If eligibility is uncertain, stop and verify current Unity licensing terms before running the Editor.

## Output

Raw output:

`artifacts/renderer-benchmark/unity-results-<timestamp>.json`

The `artifacts/renderer-benchmark/` path remains uncommitted raw evidence until reviewed.
