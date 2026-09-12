# Production Dependency Review — PROD-DEP-002

- Package: `@babylonjs/core`
- Version: `9.18.0`
- Provider: Babylon.js team
- Official source: https://github.com/BabylonJS/Babylon.js/tree/9.18.0
- License: Apache-2.0
- Production review: 2026-09-12
- Intended use: M1 clean-room renderer benchmark and renderer candidate
- Status: Approved

## Evidence

Live recheck:

- official Babylon.js repository is Apache-2.0 licensed;
- npm still lists `@babylonjs/core` version `9.18.0`;
- official tag `9.18.0` remains available.

Pre-production archived provenance evidence confirms the exact package version, package license, official license and `NOTICE.md`. It is used as evidence only, not implementation source.

## Decision

Approve exact `@babylonjs/core@9.18.0` for the production M1 clean-room rendering benchmark and as a possible production renderer dependency.

Conditions:

- do not copy Pre experiment source;
- lock the exact version during benchmark;
- preserve Apache-2.0 and applicable NOTICE attribution in distribution;
- record production lockfile/integrity after install;
- version upgrade requires a new review.
