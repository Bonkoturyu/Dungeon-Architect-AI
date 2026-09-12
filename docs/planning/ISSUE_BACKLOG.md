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

- DAI-010 Re-measure 3D stack — BLOCKED (current execution environment cannot resolve npm registry; no Pre result substitution)
- DAI-011 Select 3D stack via ADR — OPEN / blocked by DAI-010
- DAI-012 Clean-room DungeonSpec v1 — DONE
- DAI-013 Fixed-spec parser/validator — DONE
- DAI-014 Minimal renderer adapter — BLOCKED by DAI-010/011
- DAI-015 Select/move/undo — OPEN
- DAI-016 START→Goal→Result — OPEN
- DAI-017 Perspective/combat evaluation — OPEN

## M2

- DAI-020 Deterministic room graph — DONE
- DAI-021 Spatial room placement/corridors — DONE for abstract Spec layout; renderer geometry pending
- DAI-022 Walls/doors/Start/Goal — PARTIAL (Start/Goal done; walls/doors pending renderer/logic design)
- DAI-023 Structural reachability validation — DONE for corridor connectivity; key/door/event soft locks later
- DAI-024 Multiple-route constraints — PARTIAL (alternate edges implemented; risk/safety semantics pending)
- DAI-025 Seed reproducibility tests — DONE

## M3
DAI-030 session state; DAI-031 enemy minimum; DAI-032 treasure/trap/recovery; DAI-033 supported event logic; DAI-034 clear/failure/Result.

## M4
DAI-040 DesignIntent schema; DAI-041 deterministic fallback; DAI-042 cloud-provider review; DAI-043 cloud adapter; DAI-044 normalization/retry; DAI-045 prompt regression.

## M5
DAI-050 EditCommand; DAI-051 manual editor; DAI-052 undo/redo; DAI-053 natural-language edit; DAI-054 validation/START gate.

## M6
DAI-060 simulator; DAI-061 agents; DAI-062 metrics; DAI-063 intent-fit scoring; DAI-064 explainable summary.

## M7
DAI-070 onboarding; DAI-071 performance/browser; DAI-072 hosting; DAI-073 legal registers; DAI-074 secret/privacy audit; DAI-075 mobile scope.

## M8
DAI-080 public docs; DAI-081 hosted demo; DAI-082 video; DAI-083 description/category; DAI-084 candidate hash/rollback.

## M9
DAI-090 unexpected prompts; DAI-091 final compliance; DAI-092 submit.
