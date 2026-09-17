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

## 2026-09-13 — Initial cloud integration candidate

- Status: Confirmed for DAI-043 implementation; final MVP promotion remained Pending Evidence at this point.
- DAI-042 rechecked OpenAI, Gemini Developer API Paid, and Claude API against current official provider documentation.
- The first production cloud adapter candidate was OpenAI Responses API with `gpt-5.6-luna`.
- Browser code must never receive provider credentials; the provider call lives behind a project-owned backend/proxy boundary.
- OpenAI Responses requests must explicitly use `store: false`, Structured Outputs / JSON Schema, and the independent production `DesignIntent` validator.
- `store: false` is not treated as Zero Data Retention; ZDR is not a launch prerequisite.
- Provider retry remains bounded to at most one retry before deterministic fallback.
- Provider/model remains server configuration and must not couple `DesignIntent`, `DungeonSpec`, Renderer, Editor, or Play Core to provider-specific types.
- DAI-045 live evidence was required before MVP promotion.
- See `docs/research/DAI-042_PRODUCTION_CLOUD_PROVIDER_REVIEW_2026-09-13.md`.

## 2026-09-14 — MVP cloud intent path selected after DAI-045

- Status: Confirmed for the current MVP; reversible by later evidence.
- OpenAI Responses API with `gpt-5.6-luna`, `reasoning.effort = low`, is accepted for the current production cloud `DesignIntent` path.
- DAI-045 used the same frozen ten-prompt corpus before and after clarifying `targetDuration` semantics; the corpus and thresholds were not weakened.
- First live run: 10/10 valid, Cloud 100%, fallback/retry/errors 0, Cloud intent-fit `90.625%`; all three misses were `targetDuration`.
- Product semantics were clarified so explicit durations map directly to seconds, `5 minutes` means ~300 seconds, qualitative `short` without a number targets ~240..420 seconds, and negated `not long` is not treated as long.
- Same-corpus rerun: 10/10 valid, Cloud 100%, fallback/retry/rate-limit/HTTP errors 0, Cloud intent-fit `100%`, fallback baseline `78.125%`.
- Previously failing duration cases all returned `300 s` and passed their unchanged `<= 420 s` constraints.
- Rerun usage: 6,076 tokens total; estimated total cost `$0.0035502` under the frozen 2026-09-13 Luna pricing snapshot.
- Rerun latency: average `4576.104 ms`, p50 `4524.251 ms`, p95/max `5374.432 ms`.
- Evidence safety checks found no API-key or full-prompt leak.
- This selection is not an architectural lock-in: provider/model stays backend-configurable, DAI-044 deterministic fallback remains active, and a different provider/model can be evaluated later if latency, cost, quality, availability, policy, or product requirements justify reopening the decision.
- See `docs/testing/DAI-045_PROMPT_REGRESSION.md`.

## 2026-09-17 — Hosting target candidate

- Status: Pending Evidence.
- DAI-072 selected Cloudflare Pages + Pages Functions as the production hosting target for repository-side validation.
- Static editor/play assets will be built to `dist/`; `/api/natural-edit` will remain a same-origin Pages Function.
- `OPENAI_API_KEY` remains server-side as a Cloudflare runtime Secret and must never enter the browser bundle.
- Official Cloudflare documentation reviewed on 2026-09-17 confirms GitHub integration, preview deployments, file-based Functions routing, runtime bindings/secrets, explicit Node version pinning, and current Pages/Workers Free-plan limits relevant to the MVP.
- Repository implementation adds no new npm dependency and reuses the existing OpenAI transport + constrained natural-edit adapter.
- The decision remains Open until the DAI-072 production validation passes and ADR-002 is promoted to Confirmed.
- Final public `pages.dev` URL acceptance remains DAI-081 rather than DAI-072.
- See `docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md` and `docs/deployment/CLOUDFLARE_PAGES.md`.

## Open decisions

- Play perspective
- Combat model
- Browser local LLM runtime/model
- Hosting
- Mobile scope
- Final focus category

These remain Open until their production evidence and final ADR/decision entry exist.
