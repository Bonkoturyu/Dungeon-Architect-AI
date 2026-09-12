# Issue-equivalent Backlog

GitHub Issues are not created unless explicitly authorized.

## M0
- DAI-001 Start gate — DONE
- DAI-002 Clean production repository — DONE
- DAI-003 Governance baseline — DONE on production branch
- DAI-004 Knowledge-only migration — DONE
- DAI-005 Verification baseline — IN PROGRESS (`npm test` active; stack-specific format/typecheck/build/browser pending)
- DAI-006 Decision Log / ADR baseline — DONE

## M1
- DAI-010 Re-measure 3D stack — IN PROGRESS (clean-room production benchmark harness ready; controlled Three.js/Babylon.js execution pending local npm/browser run; Unity handled separately)
- DAI-011 Select 3D stack via ADR — OPEN / blocked by DAI-010 evidence
- DAI-012 Clean-room DungeonSpec v1 — DONE
- DAI-013 Fixed-spec parser/validator — DONE
- DAI-014 Minimal renderer adapter — BLOCKED by DAI-010/011
- DAI-015 Select/move/undo vertical slice — PARTIAL (renderer-independent move/undo core done; browser selection UI pending)
- DAI-016 START→Goal→Result — PARTIAL (renderer-independent session/START/Result core done; browser vertical slice pending)
- DAI-017 Perspective/combat evaluation — OPEN

## M2
- DAI-020 Deterministic room graph — DONE
- DAI-021 Spatial room placement/corridors — DONE for abstract Spec layout; renderer geometry pending
- DAI-022 Walls/doors/Start/Goal — PARTIAL
- DAI-023 Structural reachability validation — DONE for corridor connectivity
- DAI-024 Multiple-route constraints — PARTIAL
- DAI-025 Seed reproducibility tests — DONE

## M3
- DAI-030 Session state — PARTIAL (basic renderer-independent play state exists; gameplay state still pending)
- DAI-031 Enemy minimum — OPEN
- DAI-032 Treasure/trap/recovery runtime — OPEN
- DAI-033 Supported event logic — OPEN
- DAI-034 Clear/failure/Result — PARTIAL (clear/basic Result done; failure/gameplay metrics pending)

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
