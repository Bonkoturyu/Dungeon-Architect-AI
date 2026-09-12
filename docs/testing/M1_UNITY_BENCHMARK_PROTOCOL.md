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

## Dependency reproducibility gate

The runner requires the already reviewed `package-lock.json` to remain in the local working tree.
Its SHA-256 must be exactly:

`ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc`

If the lockfile is missing or differs, the benchmark stops before dependency installation.
The runner then uses `npm ci --ignore-scripts` so the audited dependency graph is reproduced rather than re-resolved.

## Unity licensing gate

Before running Unity, the operator must use a Unity plan for which they are currently tier-eligible.
The script does not attempt to determine account eligibility.

If eligibility is uncertain, stop and verify current Unity licensing terms before running the Editor.

## One-command local execution

From the existing local repository clone, run this as one PowerShell command:

```powershell
git fetch origin; git switch feat/m1-unity-benchmark; git pull --ff-only origin feat/m1-unity-benchmark; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-m1-unity-benchmark.ps1
```

The command intentionally does not delete untracked files, so the previously reviewed local `package-lock.json` is preserved for hash verification.

## Output

Raw output:

`artifacts/renderer-benchmark/unity-results-<timestamp>.json`

The `artifacts/renderer-benchmark/` path remains uncommitted raw evidence until reviewed.
