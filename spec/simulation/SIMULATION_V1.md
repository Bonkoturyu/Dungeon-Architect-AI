# Simulation Core v1 — Production Contract

## Purpose

The simulator evaluates a validated `DungeonSpec` by driving the existing `PlaySession` runtime with a deterministic policy callback. It does not implement a second gameplay model.

The simulation boundary is renderer-independent and browser-independent.

## Entry point

`simulateDungeon(authoringSpec, decideAction, options)`

Options:

- `policyId`: stable identifier recorded in the simulation result;
- `maxSteps`: positive integer, default `256`, hard maximum `10000`.

The authoring Spec is never mutated.

## Observation contract

Before each policy decision the simulator creates a plain-data observation containing:

- current step;
- current room and goal room;
- currently enabled adjacent room IDs;
- visited room IDs and move count;
- active room enemies;
- unresolved room treasure/trap/recovery entities;
- gameplay counters;
- deterministic `availableActions`.

No mutable `PlaySession` object, renderer object, DOM object, or provider-specific object is exposed to the policy.

Dynamic corridor availability is read from the real event runtime, so enabled shortcuts are reflected in observations.

## Action vocabulary

DAI-060 supports one atomic action per simulation step:

- `move`
- `encounter-enemy`
- `defeat-enemy`
- `inspect-treasure`
- `open-treasure`
- `inspect-trap`
- `avoid-trap`
- `trigger-trap`
- `use-recovery`
- `stop`

These actions call the existing Play Core functions. The simulator does not mutate gameplay state directly.

Unsupported or malformed actions fail closed.

## Termination

A simulation ends when:

- Play Core reaches `cleared` or `failed`; or
- `maxSteps` is reached.

A step-limit termination records `terminationReason = step-limit` and closes the underlying PlaySession with the existing fixed `stopped` failure reason.

The bounded step limit prevents a policy loop from hanging validation or submission-time evaluation.

## Determinism

The simulator itself contains no random source.

For the same:

- `DungeonSpec`;
- policy implementation/state;
- `policyId`;
- `maxSteps`;

it must produce the same action trace and final simulation result.

Randomized behavior, if introduced by a later agent, must be seeded explicitly outside the simulator core.

## Result contract

A successful simulation returns:

- policy ID;
- dungeon ID/Seed;
- step count and termination reason;
- terminal Play status/failure reason;
- deterministic action trace;
- the real PlayResult;
- final gameplay state.

DAI-062 will derive comparison metrics from this evidence rather than duplicating gameplay semantics inside the simulator.

## DAI-060 non-goals

DAI-060 does not yet select agent behavior. DAI-061 will add the minimum shortest/greedy/cautious policies required by M6.

DAI-060 also does not yet define intent-fit scoring or the final explainable summary; those remain DAI-063 and DAI-064.
