# DAI-060 Deterministic Simulator Core

## Status

**DONE.** Production Node evidence passed on 2026-09-16.

Reviewed evidence:

- generated: `2026-09-16T15:09:55.695Z`;
- JSON SHA-256: `423ea8117f1d7eb90efa7ccf7022ade56c2606482b552a8167ecb36c76ceb6c4`;
- `passed = true`;
- cleared scripted run: 7 steps;
- deterministic repeat: passed;
- step-limit bounding: passed;
- unsupported action rejection: passed;
- source authoring Spec unchanged.

M6 requires a simulation core before the shortest/greedy/cautious agent policies and intent-fit metrics are added.

## Architecture

DAI-060 deliberately reuses the existing Play Core rather than implementing a parallel approximation of gameplay.

`simulateDungeon()`:

1. validates and starts the Dungeon through `startPlaySession()`;
2. builds a plain-data observation from the current runtime state;
3. asks a policy callback for one bounded action;
4. applies that action through existing Play Core functions;
5. records a deterministic trace;
6. stops on clear/failure or at a fixed step limit;
7. returns the real `PlayResult` plus final gameplay state.

The policy never receives a mutable PlaySession reference.

## Supported action boundary

The first simulator action vocabulary is:

- movement;
- enemy encounter/defeat;
- treasure inspect/open;
- trap inspect/avoid/trigger;
- recovery use;
- stop.

Unsupported actions fail closed.

## Determinism and bounding

The simulator contains no RNG. Same Spec + same deterministic policy + same options must produce the same trace/result.

`maxSteps` defaults to `256` and is hard-limited to `10000`. A policy loop that reaches the step limit terminates with simulation reason `step-limit` and the fixed Play failure reason `stopped`.

## Production evidence

The primary scripted policy used a three-room fixture and drove the real runtime through:

`Start -> Middle -> encounter enemy -> defeat enemy -> open treasure -> avoid trap -> use recovery -> Goal`

Observed terminal evidence:

- cleared status;
- exactly two room moves;
- three rooms visited;
- one enemy cleared;
- one treasure opened;
- zero traps triggered;
- one recovery used;
- three interactions.

The evidence runner also verified:

- an identical rerun produced an identical simulation object;
- a looping policy was bounded by `maxSteps = 5`;
- unsupported `teleport` was rejected as `SIM_ACTION_UNSUPPORTED`;
- the source authoring Spec remained unchanged.

## Explicit non-goals

DAI-060 does not add:

- shortest/greedy/cautious policy implementations (DAI-061);
- cross-agent metrics aggregation (DAI-062);
- DesignIntent fit scoring (DAI-063);
- explainable simulation summary (DAI-064);
- browser simulation UI.
