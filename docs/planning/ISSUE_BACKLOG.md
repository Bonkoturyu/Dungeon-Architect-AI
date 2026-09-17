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
- DAI-017 Perspective/combat evaluation — IN PROGRESS / BLOCKED (PCE-1.0 protocol, score sheet, and production-schema 20-room fixture migrated; full result requires 3 perspective candidates + task interactions + mobile target IDs + P01–P12 participant sessions)

## M2
- DAI-020 Deterministic room graph — DONE
- DAI-021 Spatial room placement/corridors — DONE (abstract layout plus renderer corridor/passage geometry verified in production Chrome)
- DAI-022 Walls/doors/Start/Goal — DONE (20-room / 22-corridor fixture rendered with deterministic cardinal/diagonal wall openings and complete endpoint coverage)
- DAI-023 Structural reachability validation — DONE for corridor connectivity
- DAI-024 Multiple-route constraints — DONE (exact/monotonic `routeChoice` mapping verified by 240-case production matrix with zero failures)
- DAI-025 Seed reproducibility tests — DONE

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
- DAI-071 Performance/browser — IN PROGRESS (integrated visible-Chrome harness added for client readiness, 120-frame cadence, local interaction latency, Result/Return flow, DOM/canvas bounds, heap/browser metadata, and error capture. First production attempt showed only the original navigation-to-ready 10 s gates failing while cadence/interactions/flow/bounds/errors passed; review identified that the gate incorrectly included cold Vite dev-server module transform/delivery. Revised protocol records cold local navigation diagnostically and gates client readiness within 2 s after the last observed resource responseEnd; corrected rerun pending.)
- DAI-072 Hosting — OPEN
- DAI-073 Legal registers — OPEN
- DAI-074 Secret/privacy audit — OPEN
- DAI-075 Mobile scope — OPEN

## M8
DAI-080 public docs; DAI-081 hosted demo; DAI-082 video; DAI-083 description/category; DAI-084 candidate hash/rollback.

## M9
DAI-090 unexpected prompts; DAI-091 final compliance; DAI-092 submit.
