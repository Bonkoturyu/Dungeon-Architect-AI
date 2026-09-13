# Production Decision Log

## 2026-09-12 — Production start gate

- Status: Confirmed
- Official Build Period: started
- Internal start gate: passed
- Production repository: `Bonkoturyu/Dungeon-Architect-AI`
- Repository is a new non-fork production repository
- Pre-production implementation source will not be copied

## 2026-09-12 — License policy

- Original code: Apache-2.0
- Third-party creative assets: CC0 1.0 Universal only
- Third-party software: explicit production review required before use

## 2026-09-12 — Clean-room Core begins before renderer selection

- Status: Confirmed
- `DungeonSpec` contract/parser/validator may be implemented without selecting a renderer because the Core is explicitly renderer-independent.
- The first production Core implementation uses no third-party runtime dependency.
- Core test result: 6/6 pass on Node.js v22.16.0.

## 2026-09-12 — Renderer dependency scope review

- `three@0.185.1`, `@babylonjs/core@9.18.0`, `vite@8.1.5`, and `playwright-core@1.62.0` were Approved for recorded production benchmark/tooling scope.
- Approval did not itself select the production renderer.
- The assistant container could not resolve `registry.npmjs.org`; controlled measurements were therefore executed on the user's Windows production-test environment instead.
- Pre benchmark results were not substituted for production evidence.

## 2026-09-13 — Production renderer selection

- Status: Confirmed
- DAI-010: DONE after clean-room production measurements for Three.js 0.185.1, Babylon.js 9.18.0, and Unity WebGL 6000.3.23f1.
- DAI-011: Three.js 0.185.1 selected for the browser MVP.
- Primary reasons: lowest measured median navigation-complete, scene-generation, and first-render times; steady-state FPS was effectively tied.
- Unity 6000.3.23f1 completed 5/5 clean runs with zero runtime/browser/network errors after benchmark hardening.
- Three.js run-1 404/navigation outlier remains a follow-up item; it did not recur in runs 2–5.
- Three.js production runtime scope is Approved under the exact reviewed version.
- See `docs/architecture/adr/ADR-001-PRODUCTION-RENDERER-THREEJS.md`.

## 2026-09-13 — PCE-1.0 production continuation

- Status: Confirmed protocol / Pending Evidence results.
- DAI-017 uses the frozen pre-production `PCE-1.0` Perspective / Combat protocol as production evaluation knowledge.
- Protocol inputs migrated: candidate definitions, scoring rules, stop conditions, empty score sheet, and the 20-room evaluation fixture as a production `DungeonSpec`.
- No pre-production executable experiment source is copied.
- The current DAI-016 top-down minimal play slice is not accepted as Perspective-selection evidence.
- Perspective and Combat selections remain Open because PCE-1.0 still requires three Play-camera candidates with task interactions, mobile target IDs where applicable, and the frozen `P01`–`P12` participant sessions.
- Automated/headless/browser-smoke checks may establish engineering readiness but cannot substitute for the frozen user-study denominator.
- See `docs/testing/PCE-1.0_READINESS.md`.

## Open decisions

- Play perspective
- Combat model
- Cloud LLM provider
- Browser local LLM runtime/model
- Hosting
- Mobile scope
- Final focus category

These remain Open until production evidence and an ADR/decision entry exist.
