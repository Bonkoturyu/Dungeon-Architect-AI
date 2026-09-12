# Issue-equivalent Backlog

This is the production task backlog. GitHub Issues are not created unless explicitly authorized.

## M0

### DAI-001 — Verify production start gate — DONE
Official start, Terms, current time, user authorization, clean repo state confirmed.

### DAI-002 — Create clean production repository — DONE
User created `Bonkoturyu/Dungeon-Architect-AI` as a new non-fork repository.

### DAI-003 — Establish governance baseline — IN PROGRESS
README, LICENSE, NOTICE, AGENTS, secret/privacy boundary, legal registers.

### DAI-004 — Migrate knowledge-only documents — IN PROGRESS
Move only requirements/specification/acceptance/decision knowledge. Do not copy Pre implementation.

### DAI-005 — Establish verification baseline — OPEN
Define formatter/typecheck/test/build/secret-scan commands after the stack is selected; establish stack-neutral verification rules now.

### DAI-006 — Production Decision Log / ADR baseline — IN PROGRESS
Record all material architecture decisions with evidence and reversal conditions.

## M1

### DAI-010 — Re-measure 3D stack in production
Reimplement minimal candidate measurements clean-room; no Pre experiment source copy.

### DAI-011 — Select 3D stack via ADR
Select/reject candidates only from production evidence.

### DAI-012 — Clean-room DungeonSpec v1 contract
Renderer/runtime types forbidden in serialized spec.

### DAI-013 — Fixed-spec parser and validator
Validate required fields, stable IDs and references.

### DAI-014 — Minimal renderer adapter
Render a <20-room fixture without Core importing renderer types.

### DAI-015 — Select/move/undo vertical slice
One deterministic edit path.

### DAI-016 — START→Goal→Result vertical slice
No Cloud AI requirement.

### DAI-017 — Perspective/combat production evaluation
Run frozen PCE-1.0 protocol in production.

## M2
DAI-020 room graph; DAI-021 spatial placement/corridors; DAI-022 walls/doors/Start/Goal; DAI-023 reachability; DAI-024 multiple-route constraints; DAI-025 seed reproducibility.

## M3
DAI-030 session state; DAI-031 enemy minimum; DAI-032 treasure/trap/recovery; DAI-033 supported event logic; DAI-034 clear/failure/Result.

## M4
DAI-040 DesignIntent schema; DAI-041 deterministic fallback; DAI-042 production cloud-provider review; DAI-043 cloud adapter; DAI-044 normalization/retry; DAI-045 prompt regression.

## M5
DAI-050 EditCommand; DAI-051 manual editor; DAI-052 undo/redo; DAI-053 natural-language edit; DAI-054 validation/START gate.

## M6
DAI-060 simulator; DAI-061 agent archetypes; DAI-062 metrics; DAI-063 intent-fit scoring; DAI-064 explainable summary.

## M7
DAI-070 onboarding; DAI-071 performance/browser; DAI-072 hosting verification; DAI-073 legal registers; DAI-074 secret/privacy audit; DAI-075 mobile scope.

## M8
DAI-080 public docs; DAI-081 hosted demo; DAI-082 video; DAI-083 description/category; DAI-084 candidate hash/rollback.

## M9
DAI-090 unexpected prompts; DAI-091 final compliance audit; DAI-092 submit before deadline.
