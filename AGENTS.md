# AGENTS.md — Dungeon Architect AI Production

This repository is the production implementation repository for Dungeon Architect AI.

## Read first

1. `README.md`
2. `docs/requirements/PRODUCT_SPEC.md`
3. `docs/requirements/HACKATHON_REQUIREMENTS.md`
4. `docs/requirements/ACCEPTANCE_CRITERIA.md`
5. `docs/decisions/DECISION_LOG.md`
6. Relevant task-specific documents only

## Clean-room boundary

The pre-production repository may be used only as a knowledge/evidence source.
Do not copy implementation source from `experiments/preproduction/**` or other pre-production experiment code.

Allowed knowledge transfer:

- specifications and interfaces
- JSON Schema concepts
- pseudocode
- benchmark results
- known issues and failure modes
- test cases and acceptance criteria
- architecture decisions
- license evidence

Forbidden transfer:

- experiment implementation source
- experiment build/dist/cache output
- benchmark harness code
- browser profiles
- local model cache
- pre-production hooks, approval fingerprints, or monitoring state
- private registration evidence
- secrets and credentials

## Decision discipline

The following remain evidence-gated until production measurements are complete:

- 3D stack
- Play perspective
- Combat model
- Cloud LLM provider
- Browser local LLM runtime/model
- Hosting
- Final focus category

Do not mark an Open/Pending decision as Confirmed without direct production evidence and an ADR/Decision Log entry. Confirmed decisions, including the DAI-075 desktop-only mobile scope, must be treated as current production constraints until explicitly reopened.

## Legal and supply-chain rules

- Project code: Apache-2.0.
- Third-party creative assets: CC0 1.0 Universal only.
- Third-party software: explicit production review required before install/use.
- Pending Evidence means prohibited from production use.
- Record exact version, source, license, provenance, NOTICE/attribution duties, and intended usage.
- Never commit API keys, tokens, credentials, identity documents, personal email, or registration screenshots.

## Product invariants

- `DungeonSpec` is renderer-independent.
- Serialized spec must not contain runtime object references.
- UI edits go through an explicit edit command boundary.
- Critical validation errors block `START`.
- `START` creates a fixed execution snapshot.
- Play Mode does not directly mutate authoring state.
- LLM output is schema-validated before use.
- Result reporting distinguishes measured behavior from inferred design intent.
- Same Seed + normalized input should be reproducible within the same schema/version.

## Work discipline

For each implementation task:

1. State the task/goal.
2. Read only relevant source documents.
3. List unresolved gates.
4. Make the smallest change that satisfies the task.
5. Add/update tests.
6. Run relevant verification.
7. Report changed files, tests, failures, unverified items, and next dependency-unblocked task.
8. Never claim a test passed if it was not run.
9. Do not broaden scope without user approval.

Project-specific docs, logs, and comments should normally be Japanese unless an external format requires English.

## Git/GitHub authority

Commit/push/PR/Issue/merge/branch-protection operations require explicit user authorization unless the user has already explicitly authorized the current operation.
Force-push and history rewrite require separate confirmation.
