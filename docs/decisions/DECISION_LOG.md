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

- `three@0.185.1`, `@babylonjs/core@9.18.0`, `vite@8.1.5`, and `playwright-core@1.62.0` are Approved only for recorded production benchmark/tooling scope.
- Approval does not select the production renderer.
- Current container cannot resolve `registry.npmjs.org`; renderer benchmark remains unexecuted.
- Pre benchmark results are not substituted for production evidence.

## Open decisions

- 3D stack
- Play perspective
- Combat model
- Cloud LLM provider
- Browser local LLM runtime/model
- Hosting
- Mobile scope
- Final focus category

These remain Open until production evidence and an ADR/decision entry exist.
