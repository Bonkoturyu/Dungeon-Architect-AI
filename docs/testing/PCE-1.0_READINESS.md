# PCE-1.0 Perspective / Combat Evaluation Readiness

## Status

**IN PROGRESS / BLOCKED — protocol is frozen, result evidence does not exist yet.**

DAI-017 is the production continuation of the pre-production `PCE-1.0` Perspective / Combat evaluation protocol.
This document does not select a Play perspective or combat model.

Source provenance:

- pre-production repository: `Bonkoturyu/Dungeon-Architect-AI-Preproduction`
- source revision: `11f9ee883abf282bdbd306848d56673d1e8117e7`
- source protocol: `docs/preproduction/planning/23_PERSPECTIVE_COMBAT_EVALUATION_PACK.md`
- protocol frozen: 2026-08-11
- protocol version: `PCE-1.0`
- source fixture: `PERSPECTIVE-COMBAT-20-v1`

Only protocol knowledge, fixture data, and empty score-sheet structure are migrated. No pre-production executable experiment source is copied.

## Frozen Perspective candidates

- `A`: first-person Play camera
- `B`: third-person Play camera
- `C`: top-down Play camera

Edit Mode remains top-down for all candidates.

Perspective evidence requires the frozen participant ordering across 12 pseudonymous participants (`P01`–`P12`), 10 Play-operation tasks, 5 route-judgment tasks, and mobile tap tasks where applicable.

Perspective scoring remains:

- Play-operation success rate: 40%
- Route-judgment accuracy: 35%
- Mobile tap success rate: 25% for mobile candidates
- mobile gate: tap success >= 90%, major text >= 12 CSS px, horizontal overflow = 0

For mobile-N/A comparison, normalize to 60% Play-operation and 40% route judgment.

## Frozen Combat candidates

- `A`: none
- `B`: avoidant optional
- `C`: mandatory encounter

Each candidate uses two trials. Primary comparison order remains:

1. experience-breakdown rate
2. edit-noise rate
3. combat-interference rate
4. lower implementation burden only as a tie-break

No combat candidate may be selected before the frozen measurements exist.

## Stop conditions

- normal evaluation does not stop before 12 participants × 3 Perspective candidates are complete;
- Combat uses exactly two trials per candidate and does not add samples based on observed results;
- only a reproducible safety, progression-blocking, Spec-corruption, or contract violation may early-stop a candidate;
- changing tasks, candidate set, denominator, score formula, or candidate order requires a new protocol version and results cannot be combined with `PCE-1.0`.

## Production restart gate

The pre-production protocol defined four prerequisites. Current production status is:

| Prerequisite | Current status | Evidence |
|---|---|---|
| Production start gate passed | PASS | M0 production start gate is Confirmed |
| 3 Perspective candidates render the same fixture and Play tasks 1–10 interactions work | BLOCKED | DAI-016 proves only the current minimal top-down 3-room START→Goal slice; treasure/trap/recovery/landmark task interactions and first/third-person candidate controls are not implemented |
| 10 mobile tap target IDs fixed in production UI | PENDING DAI-075 | PCE-1.0 makes mobile tasks conditional; DAI-075 is validating desktop-only submission scope, which would make this prerequisite N/A rather than Blocked |
| `P01`–`P12` participant/device/input/viewport conditions available | BLOCKED | participant sessions have not been run or recorded |

Therefore **PCE-1.0 cannot produce a valid Perspective or Combat selection yet**.

## Evidence that does not substitute for PCE-1.0

The following are useful engineering checkpoints but are not user-study result evidence:

- renderer performance benchmark;
- DAI-014 renderer browser smoke;
- DAI-015 selection/move/undo browser smoke;
- DAI-016 START→Goal→Result browser smoke;
- automated or headless camera comparisons;
- a single developer/user manually trying the candidates.

## Production fixture migration

`spec/dungeon/fixtures/pce-perspective-combat-20-v1.json` is the production-schema representation of the frozen source fixture.

Migration rules:

- source grid coordinates are mapped to `DungeonSpec` `x/z` coordinates using 12 units per grid step;
- room size is fixed to 8 × 8 for the production evaluation fixture;
- corridor width is fixed to 3;
- Start and Goal entities are materialized from the source fixture constraints (`room-00`, `room-10`);
- source role/landmark/warning/policy data is retained as additional metadata;
- graph, entity placement, landmarks, and task order are not changed by candidate selection.

This conversion is production data reimplementation, not copied pre-production runtime code.

## Engineering prerequisites to unblock the protocol

Before participant evaluation can begin, production still needs:

1. render and play the migrated 20-room fixture;
2. treasure interaction for the normal and warning chests;
3. trap warning/avoidance behavior;
4. recovery interaction;
5. landmark presentation used by route-judgment tasks;
6. the three frozen Play-camera candidates with candidate-equivalent task controls;
7. Combat candidate policies `none`, `avoidant optional`, and `mandatory encounter`;
8. the five frozen non-combat edit operations used during Combat trials;
9. 10 mobile target IDs and mobile gate instrumentation where mobile is in scope (N/A if DAI-075 desktop-only submission scope is confirmed);
10. 12 pseudonymous participant sessions under the frozen ordering and shared controls.

## Decision boundary

Until those prerequisites and the full frozen sample exist:

- Play perspective remains `Open / Pending Evidence`;
- Combat model remains `Open / Pending Evidence`;
- `top-down` is only the currently implemented engineering slice, not the PCE winner;
- `combat-avoidant` remains only a prior candidate, not an adopted design decision.
