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
- DAI-034 Clear/failure/Result — IN PROGRESS (fixed terminal failure reasons, immutable fail transition, route capture, and gameplay-metric Result projection implemented; production evidence pending)

## M4
- DAI-040 DesignIntent schema — DONE
- DAI-041 Deterministic fallback parser — DONE
- DAI-042 Production cloud-provider review — OPEN
- DAI-043 Cloud intent adapter — OPEN
- DAI-044 Normalization/retry — PARTIAL
- DAI-045 Prompt regression — OPEN

## M5
- DAI-050 EditCommand contract — DONE for renderer-independent v1 commands
- DAI-051 Manual editor — OPEN
- DAI-052 Undo/redo — DONE at core layer
- DAI-053 Natural-language edit — OPEN
- DAI-054 Validation/START gate — PARTIAL (core START gate done; UI/editor integration pending)

## M6
DAI-060 simulator; DAI-061 agents; DAI-062 metrics; DAI-063 intent-fit scoring; DAI-064 explainable summary.

## M7
DAI-070 onboarding; DAI-071 performance/browser; DAI-072 hosting; DAI-073 legal registers; DAI-074 secret/privacy audit; DAI-075 mobile scope.

## M8
DAI-080 public docs; DAI-081 hosted demo; DAI-082 video; DAI-083 description/category; DAI-084 candidate hash/rollback.

## M9
DAI-090 unexpected prompts; DAI-091 final compliance; DAI-092 submit.
