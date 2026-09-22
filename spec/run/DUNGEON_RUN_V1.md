# DungeonRunSpec v1 — Sequential Multi-floor Contract

## Purpose

`DungeonRunSpec` composes existing validated `DungeonSpec` floors into one sequential 1–10 floor run.

The runtime renders and plays exactly one floor at a time. A simultaneous whole-building 3D view is explicitly outside DAI-095 scope.

## Authoring schema

```text
DungeonRunSpec {
  schemaVersion: "1.0"
  id: string
  floors: [
    {
      id: string
      dungeon: DungeonSpec
    }
  ]
}
```

Rules:

- floor count is 1 through 10;
- each floor ID is unique;
- each floor DungeonSpec ID is unique;
- each floor must independently pass the existing DungeonSpec validator;
- floor order in the array is execution order.

A one-floor DungeonRunSpec is the compatibility case for the existing single-DungeonSpec workflow.

## Runtime

`startDungeonRun()`:

1. validates the whole DungeonRunSpec;
2. deep-clones it into a run snapshot;
3. starts floor 1 using the existing PlaySession;
4. initializes run-level floor history and PlayerState projection.

`syncDungeonRunFloor()` accepts the latest PlaySession for the active floor.

If that PlaySession is still playing, the run remains on the same floor.

If the active floor clears:

1. its real PlayResult is stored;
2. the exact final PlayerState is carried into the next floor;
3. the next floor starts as a fresh PlaySession using that PlayerState.

If the final floor clears, the whole run becomes `cleared`.

If any floor fails, the whole run becomes `failed` and no later floor starts.

## PlayerState carry-over

DAI-095 carries PlayerState exactly between floors:

- HP;
- MaxHP;
- Level;
- XP;
- Gold;
- equipped Weapon;
- equipped Armor.

Per-floor GameplayState remains floor-local. Room/entity states, event flags, interaction counters and non-equipped gameplay inventory do not leak into the next floor.

This separation preserves the existing DungeonSpec/PlaySession isolation model while making player progression persistent across floors.

## Result

A terminal DungeonRun result includes:

- run status and failure reason;
- floor count and number of completed floor results;
- run timing;
- current/final floor index;
- final PlayerState;
- ordered per-floor real PlayResults.

Run-level balance aggregation and cross-floor simulation metrics remain DAI-098 scope.

## Rendering and Editor constraints

Only the selected/current floor DungeonSpec is sent to the existing renderer.

Edit mode may switch between floor-specific EditSessions. Each floor retains its own edit/undo state.

Play mode executes floors sequentially; authoring floor selection does not change the active runtime floor.

Whole-building simultaneous 3D rendering is deferred.
