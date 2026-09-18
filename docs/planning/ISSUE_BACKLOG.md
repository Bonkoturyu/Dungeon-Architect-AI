# Issue-equivalent Backlog

GitHub Issues are not created unless explicitly authorized.

## M0
- DAI-001 Start gate — DONE
- DAI-002 Clean production repository — DONE
- DAI-003 Governance baseline — DONE on production branch
- DAI-004 Knowledge-only migration — DONE
- DAI-005 Verification baseline — IN PROGRESS (`npm test` active; renderer/editor/play/door browser smoke passed; stack-specific format/typecheck/build remain pending)
- DAI-006 Decision Log / ADR baseline — DONE

## M1
- DAI-010 Re-measure 3D stack — DONE (Three.js/Babylon.js/Unity WebGL production comparison complete)
- DAI-011 Select 3D stack via ADR — DONE (ADR-001 selects Three.js 0.185.1)
- DAI-012 Clean-room DungeonSpec v1 — DONE
- DAI-013 Fixed-spec parser/validator — DONE
- DAI-014 Minimal renderer adapter — DONE (Three.js minimal renderer + production Chrome smoke passed)
- DAI-015 Select/move/undo vertical slice — DONE (canvas room selection + EditSession move + undo/redo production Chrome smoke passed)
- DAI-016 START→Goal→Result — DONE (START snapshot + room-click movement + Goal/Result production Chrome smoke passed)
- DAI-017 Perspective/combat evaluation — IN PROGRESS / BLOCKED (PCE-1.0 protocol, score sheet, and production-schema 20-room fixture migrated; DAI-075 confirms mobile tasks are N/A for this desktop-only submission, but full result still requires 3 perspective candidates + task interactions + P01–P12 participant sessions)

## M2
- DAI-020 Deterministic room graph — DONE
- DAI-021 Spatial room placement/corridors — DONE (abstract layout plus renderer corridor/passage geometry verified in production Chrome)
- DAI-022 Walls/doors/Start/Goal — DONE (20-room / 22-corridor fixture rendered with deterministic cardinal/diagonal wall openings and complete endpoint coverage)
- DAI-023 Structural reachability validation — DONE for corridor connectivity
- DAI-024 Multiple-route constraints — DONE (exact/monotonic `routeChoice` mapping verified by 240-case production matrix with zero failures)
- DAI-025 Seed reproducibility tests — DONE
- DAI-026 Orthogonal corridor presentation — DONE (rejected DAI-082 capture drove two fixes: diagonal/overlapping alternate corridor slabs were replaced with deterministic orthogonal non-conflicting routing, then a follow-up visible bend-floor gap was fixed with explicit junction tiles. Final exact public-demo regression passed orthogonal/overlap/door-side/bend/junction/browser gates with empty finding arrays. Reviewed JSON SHA-256 `128d78b9d855260a9253d105e86460bd9834216fc41c6bfbd226c4b58513d94d`, PNG `ee9cd2e2728a0a144c45cebad59e3c67f3dac05797c766a9ba170c8275508f8d`.)

## M3
- DAI-030 Session state — DONE (generic renderer-independent gameplay state + immutable PlaySession transitions verified by production Node evidence)
- DAI-031 Enemy minimum — DONE (policy-neutral enemy presence/encounter/defeat runtime verified against both PCE enemy entities; duplicate defeat and snapshot/authoring immutability gates passed)
- DAI-032 Treasure/trap/recovery runtime — DONE (PCE fixture treasure inspect/open, trap inspect/avoid/trigger, one-shot recovery, immutable state, and Result compatibility verified by production Node evidence)
- DAI-033 Supported event logic — DONE (fixed MVP trigger/condition/action vocabulary, immutable deterministic dispatch, one-shot behavior, shortcut enable, enemy-group clear, and dormant enemy activation verified by production Node evidence)
- DAI-034 Clear/failure/Result — DONE (clear/failed terminal states, fixed failure vocabulary, route history, gameplay metrics, terminal death projection, and immutable production evidence passed)

## M4
- DAI-040 DesignIntent schema — DONE
- DAI-041 Deterministic fallback parser — DONE
- DAI-042 Production cloud-provider review — DONE (2026-09-13 official recheck; OpenAI Responses API + `gpt-5.6-luna` selected as initial integration candidate behind a provider-neutral backend boundary)
- DAI-043 Cloud intent adapter — DONE (strict DesignIntent JSON Schema, backend-only OpenAI Responses transport, explicit `store:false`, independent validation, sanitized metadata/error normalization, single-attempt boundary, and no-live-call production contract evidence passed)
- DAI-044 Normalization/retry — DONE (Cloud → eligible Local → deterministic fallback routing, maximum one retry per LLM source, finite timeout/cancel boundary, bounded `Retry-After`, sanitized trace, and deterministic no-live-call production evidence passed)
- DAI-045 Prompt regression — DONE (same frozen 10-prompt corpus rerun after production duration-semantics clarification: 10/10 valid, Cloud 100%, fallback/retry/errors 0, Cloud intent-fit 100%, duration misses resolved to 300 s, no secret/full-prompt leak; current MVP cloud intent path accepts OpenAI Responses API + `gpt-5.6-luna` while keeping provider/model backend-configurable)

## M5
- DAI-050 EditCommand contract — DONE for renderer-independent v1 commands
- DAI-051 Manual editor — DONE (visible-Chrome inspector verified `move-entity`, add/remove, Undo/Redo, protected Start/Goal removal guard, and 3D room-selection → inspector synchronization with zero browser/network errors)
- DAI-052 Undo/redo — DONE at core layer and exercised through room/entity browser authoring slices
- DAI-053 Natural-language edit — DONE (one live `gpt-5.6-luna` call translated the browser request into `move-entity / treasure-1 / room-goal`; EditSession application, selection sync, Undo/Redo, secret/full-prompt safety, and zero browser/network errors verified)
- DAI-054 Validation/START gate — DONE (visible-Chrome integrated authoring→START→Play→Result→Return flow passed; valid state enables START, unreachable state is blocked as Critical `GOAL_UNREACHABLE`, execution snapshot matches authoring state, editing is disabled during Play, cleared Result is produced, Return to Edit preserves authoring state, and browser/network errors are zero)

## M6
- DAI-060 Simulator — DONE (production Node evidence passed: real Play Core run cleared in 7 scripted steps; deterministic rerun, step-limit bounding, unsupported-action rejection, interaction counters, and source-Spec immutability all verified)
- DAI-061 Agents — DONE (production Node evidence passed for deterministic `shortest-path`, `treasure-greedy`, and `cautious` policies; all cleared, immediate reruns matched, shortest used the 2-hop hazardous route, greedy collected the side treasure, cautious avoided the hazard, all routes were distinct, and source Spec remained unchanged)
- DAI-062 Metrics — DONE (production Node evidence passed for deterministic per-run and cross-agent metrics: 3/3 built-in clears, mean steps 3, mean moves 2.666667, three distinct routes with mean edge-Jaccard distance 0.933333, full union room coverage, expected hazard/treasure contrast, zero built-in backtracking/dead-end cost, deterministic recomputation, stopped-failure concentration probe, and source Spec immutability)
- DAI-063 Intent-fit scoring — DONE (production Node evidence passed: all 10 checks true, frozen observable profile matched, exact matched intent scored 1.0, opposed intent scored 0.240124, coverage remained explicit at 9/13 normalized axes, unsupported axes/duration remained unscored, invalid intent failed closed, deterministic recomputation passed, and source Spec remained unchanged)
- DAI-064 Explainable summary — DONE (production Node evidence passed: all 13 checks true; matched score 1.0 and opposed score 0.240124 preserved, 9/13 coverage and unsupported-axis/duration boundaries stayed explicit, opposed largest gaps were fairness/learnability/backtracking at absolute delta 1.0, evidence basis/confidence and boundary text were preserved, malformed input failed closed, deterministic recomputation passed, input score objects remained unchanged; reviewed JSON SHA-256 `8c4f2e94b5f24f55da069d412ed468611481dbe54441a917f572af61a8b0e1b8`)

## M7
- DAI-070 Onboarding — DONE (production Node + visible-Chrome evidence passed: editor was ready/valid/START-eligible; four-step `welcome → edit → validate → play` guide auto-opened, Back/Next/Done and Close/Guide flows behaved deterministically, START remained available after dismissal, and console/page/request/HTTP error collections were empty; reviewed JSON SHA-256 `ea3eaaf67cd78c4aafaba6ec2a5199e05fff62ae4909061b9ab6ce7f60ad09b2`, PNG SHA-256 `c05733b61495b77d0bf6382c9757a09026f5c0d0b81136840af55cca6607cf3d`)
- DAI-071 Performance/browser — DONE (corrected visible-Chrome production evidence passed all 12 gates after preserving the first-attempt measurement-boundary defect in the record. Cold local Vite navigation remained diagnostic at ~9.2 s; client-ready latency after the last resource response was 206.4 ms for editor and 215.2 ms for onboarding; 120-frame cadence p95 was 31.7 ms; maximum local interaction latency was 20.1 ms; Result cleared in 2 moves; Return to Edit restored valid START state; DOM/canvas bounds passed; browser/network errors were zero. Reviewed JSON SHA-256 `bb71503cdc7ff9e4be02f42fc94a79c96c4ef2ae658c8233e2e347b3fe574751`, PNG SHA-256 `78d0c6cfc0378eff69e7f9ebbeaf96305fad759e17cfc718d2e8c75ff06a308b`)
- DAI-072 Hosting — DONE (Cloudflare Pages + Pages Functions confirmed by ADR-002 after repository-side production validation passed all 12 gates. Production `dist/` bundle, fixture, CSP/security/cache headers, API-only `_routes.json`, server-side `/api/natural-edit`, Function-source exclusion from static output, valid START/onboarding built surface, production assets, and zero browser/network errors were verified. Reviewed JSON SHA-256 `71d6969f14c11acbea3c6b5d2ea30cc691ba41aef5d416d140a178bd2795e290`, PNG SHA-256 `55fd7fcae2e19e8bdd461b1222c115bbf78577abae011b4a94ab0ec06d959622`. Final public `pages.dev` URL/secret/public-E2E acceptance remains DAI-081.)
- DAI-073 Legal registers — DONE (production legal/provenance audit passed all 13 checks: audited lockfile unchanged, exact reviewed dependency versions pinned, production import closure external runtime limited to `three`, zero creative-asset candidates detected, development/runtime AI usage and hosted services recorded, Three.js r185 MIT notice present, and root/distribution notice hashes matched. Reviewed JSON SHA-256 `547c436bdf4991c2ce08e2589a97ebc8dd376afadac8afd455e31e3a376ed745`.)
- DAI-074 Secret/privacy audit — DONE after DAI-081 re-audit (18/18 checks passed across tracked/history secrets, `dist/`, both Pages Function boundaries, `store:false`, no-store responses, bounded outbound data, no persistent storage, and prompt/secret non-echo. Reviewed JSON SHA-256 `087af17acc04f4a46b7522e18e97d45de503ea9a9ba74bdcb9eeff726cfb2d18`.)
- DAI-075 Mobile scope — DONE (ADR-003 confirms desktop Google Chrome on Windows as the supported judging target; mobile/narrow layouts are best-effort only. Production 1440×900 desktop and 390×844 touch-emulated narrow evidence passed all 13 checks with horizontal overflow 0 and zero browser/network errors; the narrow UI explicitly discloses the limitation. PCE-1.0 mobile tap tasks are N/A for this submission. Reviewed JSON SHA-256 `041f1d964ab342bf49d5972af9dfed73fa6575780178635487525da2c0a0616b`, desktop PNG `22fd5b67df8493bdd3764c1cd5d24960e1550b5b7a7108f1e957f3995fd1d392`, narrow PNG `d9ac4a543d7d1fbb571041169a995ea8419505e81470ced832d689eae46a2796`.)

## M8
- DAI-080 Public docs — DONE after DAI-081 revalidation (12/12 updated checks passed for live hosted Generate claims, Judge Guide, Known Limitations, public sample prompts, checklist/storyboard, link resolution, and no TODO/TBD placeholders. Reviewed JSON SHA-256 `ff1f8fbeee18ea8143ffc07bb7594461eaad1c90ebaa7cb0e125755fdee5bc1e`.)
- DAI-081 Hosted demo — DONE (Gate 1 local integration 12/12; Gate 2 public HTTPS 13/13 at `https://dungeon-architect-ai.pages.dev/`; live cloud Generate, live AI edit, both API routes HTTP 200, valid generated dungeon, START→Goal clear in 4 moves, Return to Edit, zero browser/network errors. Public JSON SHA-256 `2fdd088c8de25be64169ce0dd617e40c04467d9303e1ca686a312d55b817a8b1`, PNG `6d35333cf4e21f0766ca0c0e6477803b2a35f7cde37754b5d8dcb47566dee3fb`; post-integration DAI-074/080 re-audits also passed.)
- DAI-082 Video — BLOCKED by DAI-026 visual-generation fix (the first automated capture was <180 s but rejected because the generated alternate corridor geometry was visibly invalid. Do not record the final video until DAI-026 passes and the corrected hosted candidate is redeployed.)
- DAI-083 Description/category — OPEN
- DAI-084 Candidate hash/rollback — OPEN

## M9
DAI-090 unexpected prompts; DAI-091 final compliance; DAI-092 submit.
