# PROD-DEP-001 Scope Extension — three 0.185.1

## Status

**Approved for production runtime scope**

Review date: 2026-09-13

## Existing evidence

Existing production review already confirmed:

- package: `three`
- exact version: `0.185.1`
- upstream tag: `r185`
- license: MIT
- source: official `mrdoob/three.js`
- exact package identity recorded in the reviewed npm lockfile
- no runtime dependencies declared by the package

## Scope extension

Previous approved scope:

- M1 renderer benchmark
- renderer candidate evaluation

Extended scope:

- Dungeon Architect AI browser MVP renderer runtime
- DAI-014 minimal renderer adapter
- later Edit Mode / Play Mode rendering paths using the same exact reviewed version
- public hosted demo distribution

## Conditions

- preserve the applicable Three.js MIT copyright/license text in distributed substantial copies;
- keep the exact version pinned until a separate upgrade review;
- do not copy pre-production experiment implementation code;
- do not move Three.js runtime objects into serialized `DungeonSpec`;
- record final bundle composition and notices before public submission;
- version changes require another dependency review.

## Decision

Approve `three@0.185.1` for the production runtime scope above.

This is a license/provenance scope decision. Renderer architecture selection is separately recorded in ADR-001.
