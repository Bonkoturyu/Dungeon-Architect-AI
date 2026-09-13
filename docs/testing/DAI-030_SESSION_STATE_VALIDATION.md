# DAI-030 Session State Validation

## Status

**IN PROGRESS.**

DAI-030 adds renderer-independent gameplay state to the existing detached Play execution snapshot.
It establishes state containers and immutable transition boundaries needed by later Enemy, treasure/trap/recovery, and supported event-logic tasks without implementing those mechanics yet.

## Session boundary

`startPlaySession()` continues to clone the validated authoring `DungeonSpec` into a fixed execution snapshot.
The session now also owns a separate `gameplayState` object.

Authoring data and the execution snapshot are not used as mutable runtime storage.

## Gameplay state v1

Initial state:

```json
{
  "schemaVersion": "1.0",
  "flags": {},
  "inventory": {},
  "entityStates": {},
  "counters": {
    "roomEntries": 1,
    "interactions": 0,
    "enemiesCleared": 0,
    "treasuresOpened": 0,
    "trapsTriggered": 0,
    "recoveryUsed": 0,
    "damageTaken": 0,
    "healingReceived": 0
  }
}
```

The containers intentionally remain generic in DAI-030.
Their semantic producers/consumers are implemented by DAI-031 through DAI-033.

## Supported state commands

`applyGameplayStateCommand()` currently accepts only a fixed command vocabulary:

- `set-flag`
- `set-inventory-count`
- `set-entity-state`
- `increment-counter`

No arbitrary runtime JavaScript or generated code is executed.

`set-entity-state` is constrained to entity IDs present in the fixed execution snapshot.
Counters are restricted to the known DAI-030 counter keys and non-negative safe-integer deltas.

## PlaySession integration

`applyPlaySessionStateCommand()`:

- requires a `playing` session;
- applies the command immutably;
- keeps the execution snapshot unchanged;
- appends a `state-command` audit event;
- returns `INVALID_STATE_COMMAND` for rejected runtime mutations.

`movePlaySession()` now increments `roomEntries` through the same gameplay-state command boundary.

## Test coverage

The Play Core tests cover:

- deterministic initial gameplay state;
- execution snapshot isolation;
- movement increments `roomEntries` without mutating the previous session;
- flags and inventory changes are immutable;
- entity state accepts only snapshot entity IDs;
- gameplay state commands do not mutate `DungeonSpec`;
- state commands are rejected after the session has finished;
- existing START → movement → Goal → Result behavior remains valid.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-030-session-state; git pull --ff-only origin feat/dai-030-session-state; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-030-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the full production Node test suite;
4. runs a deterministic session-state evidence scenario;
5. writes `artifacts/session-state/dai-030-session-state.json`.

The evidence scenario verifies:

- initial state containers and room-entry count;
- flag, inventory, entity-state, and counter transitions;
- previous-session immutability;
- execution-snapshot immutability;
- authoring-spec immutability;
- room-entry update after movement;
- unknown entity rejection;
- state-command/move audit events.

## Completion gate

Do not mark DAI-030 DONE until:

- the full production test suite passes;
- the session-state evidence scenario reports `passed = true`;
- the generated JSON evidence is reviewed.

## Explicit non-goals

DAI-030 does not yet implement:

- enemy behavior or combat resolution;
- treasure opening semantics;
- trap damage/avoidance semantics;
- recovery-item semantics;
- supported event trigger/condition/action execution;
- failure-state rules;
- gameplay balance or simulation metrics.

Those remain DAI-031 through DAI-034 and later simulation tasks.
