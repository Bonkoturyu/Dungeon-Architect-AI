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

## 2026-09-18 — Production hosting target confirmed

- Status: Confirmed.
- DAI-072 repository-side production validation passed all 12 gates.
- Cloudflare Pages + Pages Functions is the selected browser-MVP hosting target.
- Static editor/play output is built into `dist/`; `/api/natural-edit` remains a same-origin Pages Function.
- `OPENAI_API_KEY` remains server-side as a Cloudflare runtime Secret and is not bundled into browser output.
- `_routes.json` restricts Function invocation to `/api/*`; Function source is not copied into static `dist/`.
- Security output includes CSP, `X-Content-Type-Options`, and index `Cache-Control: no-store`.
- Visible-Chrome built-output smoke passed with valid START state, onboarding ready/close behavior, production assets only, and zero console/page/request/HTTP errors.
- Reviewed evidence JSON SHA-256: `71d6969f14c11acbea3c6b5d2ea30cc691ba41aef5d416d140a178bd2795e290`.
- Reviewed screenshot SHA-256: `55fd7fcae2e19e8bdd461b1222c115bbf78577abae011b4a94ab0ec06d959622`.
- Final public `pages.dev` URL deployment, secret configuration, and end-to-end hosted smoke remain DAI-081 acceptance work.
- See `docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md`, `docs/testing/DAI-072_HOSTING.md`, and `docs/deployment/CLOUDFLARE_PAGES.md`.

## 2026-09-18 — Mobile scope confirmed

- Status: Confirmed.
- DAI-075 confirms desktop Google Chrome on Windows as the supported judging target for the current hackathon submission.
- Reference acceptance viewport remains 1440 × 900 from the DAI-071 production browser evidence.
- Mobile/narrow layouts are best-effort only and are not advertised as supported submission targets.
- A narrow-screen UI notice discloses the limitation and directs judges to desktop Chrome.
- Production validation passed all 13 desktop/narrow scope checks: both viewports initialized valid/START-eligible, horizontal overflow was 0, narrow limitation disclosure was visible, and browser/network error collections were empty.
- PCE-1.0 already defines mobile tasks as conditional and a Mobile-N/A scoring path; the ten mobile tap target IDs are therefore N/A for this submission.
- Reviewed evidence JSON SHA-256: `041f1d964ab342bf49d5972af9dfed73fa6575780178635487525da2c0a0616b`.
- Reviewed desktop/narrow screenshots: `22fd5b67df8493bdd3764c1cd5d24960e1550b5b7a7108f1e957f3995fd1d392` / `d9ac4a543d7d1fbb571041169a995ea8419505e81470ced832d689eae46a2796`.
- This does not select Perspective/Combat or satisfy the remaining PCE participant/task prerequisites.
- See `docs/architecture/adr/ADR-003-MOBILE-SCOPE-DESKTOP-ONLY.md` and `docs/testing/DAI-075_MOBILE_SCOPE.md`.

## 2026-09-19 — Final focus category confirmed

- Status: Confirmed.
- DAI-083 selects `AI 3D Scene Generation` as the final focus category for the current submission candidate.
- The public Kaggle track describes this category as plain-language prompts becoming 3D environments, objects, layouts, or full interactive scenes in the browser.
- Production evidence directly matches that framing: hosted plain-language Generate → validated DesignIntent → deterministic DungeonSpec → Three.js dungeon, followed by Edit / Validate / START / Play / Result.
- The short submission description is frozen in `docs/submission/DAI-083_DESCRIPTION_CATEGORY.md`, with a 513-character primary version and a 215-character compact fallback.
- Reopen only if the actual submission form exposes a materially different mandatory category list, a tighter text limit, or production behavior changes.
- See `docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md`.

## Open decisions

- Play perspective
- Combat model
- Browser local LLM runtime/model

These remain Open until their production evidence and final ADR/decision entry exist.
