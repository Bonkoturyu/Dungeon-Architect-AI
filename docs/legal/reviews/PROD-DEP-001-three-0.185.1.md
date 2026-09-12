# Production Dependency Review — PROD-DEP-001

- Package: `three`
- Version/tag: `0.185.1` / `r185`
- Provider: three.js authors
- Official source: https://github.com/mrdoob/three.js/tree/r185
- License: MIT
- Production review: 2026-09-12
- Intended use: M1 clean-room renderer benchmark and renderer candidate
- Status: Approved

## Evidence

Live recheck:

- upstream `r185/package.json` identifies `three` version `0.185.1`, repository `mrdoob/three.js`, license `MIT`;
- upstream `r185/LICENSE` is the MIT License;
- npm still lists `three` 0.185.1 as a published version with MIT license and zero runtime dependencies.

Pre-production evidence is used only as archived provenance evidence, not as code:

- review: `docs/preproduction/legal/reviews/DEP-001-three-0.185.1.md`
- metadata: `docs/preproduction/legal/evidence/DEP-001-three-0.185.1/metadata.md`
- archived evidence hashes include package metadata/license/source/license screenshots.

## Decision

Approve exact `three@0.185.1` for the production M1 clean-room rendering benchmark and as a possible production renderer dependency.

Conditions:

- do not copy Pre experiment source;
- lock the exact version during benchmark;
- preserve MIT copyright/license in distributed substantial copies;
- record lockfile/integrity after production install;
- version upgrade requires a new review.
