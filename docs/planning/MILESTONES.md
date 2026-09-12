# Production Milestones

- Official Build start: 2026-09-11 23:00 JST
- Internal production start: 2026-09-12 00:00 JST
- Build end: 2026-11-11 23:00 JST
- Submission deadline: 2026-11-11 23:30 JST
- Internal submission-ready target: 2026-11-06

## M0 — Start Gate & Clean Bootstrap
Target: 2026-09-12

- official start / Terms recheck
- explicit user authorization
- new clean production repo
- governance/legal/test baseline
- zero Pre implementation copy

Exit: gate pass, Apache-2.0/NOTICE, privacy/secret boundary, legal registers, knowledge-only migration.

## M1 — Architecture Lock & First Vertical Slice
Target: 2026-09-18

- production stack re-measure
- ADR selects stack
- clean-room DungeonSpec
- fixed spec render
- select/move/undo
- START→Goal→Result
- PCE-1.0 perspective/combat evaluation

Exit: Core/Renderer separation, fresh-browser minimal loop, evidence-backed decisions.

## M2 — Procedural Dungeon Core
Target: 2026-09-25

- deterministic room graph
- spatial layout
- corridors/walls/doors
- Start/Goal
- multiple routes
- Seed
- structural validation

## M3 — Playable Dungeon Loop
Target: 2026-10-02

- player/session
- selected minimal combat/encounter
- enemy/treasure/trap/recovery
- supported conditional event
- clear/failure/Result

## M4 — Natural Language Pipeline
Target: 2026-10-09

- DesignIntent schema
- prompt normalization
- provider abstraction
- cloud provider path
- deterministic fallback
- malformed-output handling
- regression prompts

## M5 — Edit Mode
Target: 2026-10-16

- top-down editor
- move/add/remove
- undo/redo
- natural-language edit
- revalidation
- START gate

## M6 — Validation, Simulation & Intent Scoring
Target: 2026-10-23

- simulation core
- shortest/greedy/cautious agents minimum
- metrics
- intent-fit score
- explainable result

## M7 — UX, Performance, Compatibility & Compliance
Target: 2026-10-30

- onboarding
- loading/error UX
- browser/performance
- hosting verification
- legal registers
- secret/privacy audit
- mobile scope decision/limitation

## M8 — Submission Candidate
Target: 2026-11-06

- public repo candidate
- hosted demo
- README/screenshots
- <3 min video
- description/focus category
- known limitations
- candidate hash/rollback

## M9 — Final Verification & Submission
Window: 2026-11-07 — 2026-11-11 23:30 JST

- unexpected prompt regression
- bug fix only unless critical
- final license/security/compliance audit
- submit early
