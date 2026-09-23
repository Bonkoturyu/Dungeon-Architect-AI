# Multi-floor Run Simulation / Balance V1

## Scope

DAI-098 extends the existing deterministic single-floor simulation layer to `DungeonRunSpec`.

The implementation must reuse real Play/Run runtime semantics rather than maintain a parallel approximation.

Primary APIs:

- `simulateDungeonRun(runSpec, createPolicyForFloor, options)`
- `projectDungeonRunSimulationMetrics(runSpec, simulation)`
- `aggregateDungeonRunSimulationMetrics(runSpec, simulations)`
- `scoreDungeonRunIntentFit(runSpec, designIntent, aggregateMetrics)`

## Runtime reuse

`simulateDungeonRun()` uses:

- Run Core `startDungeonRun()`;
- Simulation Core `createSimulationObservation()`;
- Simulation Core `applySimulationAction()`;
- Run Core `syncDungeonRunFloor()`;
- Run Core `createDungeonRunResult()`.

This guarantees that floor transitions use the same PlayerState carry semantics as the browser runtime.

No separate run-carry implementation is allowed.

## Real combat action

DAI-098 adds:

`combat-enemy`

to the simulation action vocabulary.

It calls Play Core `resolveEnemyCombat()`, so simulation can observe:

- deterministic enemy damage;
- player defeat;
- enemy clear;
- XP reward;
- Gold reward;
- Level / MaxHP progression.

The historical `defeat-enemy` action remains supported for backwards compatibility and continues to represent direct defeat without combat damage.

## Floor policy factory

A run simulation receives a policy factory.

The factory is called only for floors actually reached.

Inputs:

- cloned floor DungeonSpec;
- plain-data run context:
  - run ID;
  - floor index / number / count;
  - floor ID;
  - dungeon ID;
  - carried PlayerState;
  - prior floor results.

The factory must return one simulation decision function.

Policy/runtime exceptions fail closed with normalized `RUN_SIM_*` errors.

## Step limit

`maxStepsPerFloor` is bounded from 1 through 10,000.

If a floor remains in Play after the floor step limit, that floor is terminated with the existing `stopped` failure reason, which terminates the run through Run Core.

## Run simulation result

The result contains:

- run status / failure reason;
- floor count;
- floors reached;
- floors cleared;
- total simulation steps;
- final PlayerState;
- Run Core events/result;
- one simulation result per reached floor.

Each floor simulation records:

- starting PlayerState;
- terminal PlayResult;
- deterministic action trace;
- floor termination reason.

## Run metrics

Per-run projection contains:

- floor completion;
- total moves/interactions;
- damage / healing;
- XP / Gold;
- Level gains;
- loot;
- enemy / treasure / trap / recovery outcomes;
- final HP fraction;
- final Level / Gold / equipment tiers;
- per-floor carry-aware metrics.

## Authored difficulty signals

For each floor, DAI-098 records:

- enemy count;
- trap count;
- hazard density;
- reward density;
- enemy damage budget;
- trap damage budget;
- total hazard damage budget;
- hazard damage budget per room.

These are descriptive authored signals. They do not claim actual player difficulty by themselves.

## Observed pressure signals

Across policies, each floor records:

- reach rate;
- clear rate overall;
- clear rate among reached policies;
- mean damage;
- damage / starting MaxHP fraction;
- ending HP fraction;
- progression rewards;
- navigation metrics.

The aggregate reports deltas per floor for:

- authored hazard density;
- authored reward density;
- authored hazard damage budget / room;
- observed damage fraction;
- observed ending HP fraction;
- observed level gain;
- clear rate.

The first floor with the minimum overall clear rate is reported as the descriptive `bottleneckFloorIndex`.

No automatic "balanced / unbalanced" verdict is emitted.

## DesignIntent fit

DAI-098 reuses DAI-063 `scoreIntentFit()` independently for every reached floor aggregate.

Run-level `observableFitScore` is the mean of those per-floor observable scores.

Coverage reports how many run floors had enough simulation evidence to score.

### targetDifficulty

DAI-063 did not have a validated targetDifficulty proxy.

DAI-098 therefore exposes a **descriptive proxy only**:

`mean(damageFractionOfStartMaxHp, 1 - clearRateAmongReached)`

per floor, then averages available floor proxies.

This value:

- is shown next to DesignIntent `targetDifficulty`;
- is explicitly excluded from `observableFitScore`;
- must not be described as a validated difficulty score.

### targetDuration

Simulation steps are not real-time seconds.

`targetDuration` remains unscored.

## Frozen DAI-098 acceptance fixture

`spec/simulation/fixtures/dai-098-run-balance-v1.json`

Three linear floors have increasing authored damage pressure:

| Floor | Enemy damage | Trap damage | Total damage budget | Budget / room |
|---|---:|---:|---:|---:|
| 1 | 3 | 4 | 7 | 2.333333 |
| 2 | 4 | 8 | 12 | 4 |
| 3 | 5 | 12 | 17 | 5.666667 |

Acceptance runs three deterministic policy families:

- safe: real combat + avoid trap;
- treasure: real combat + avoid trap + treasure + recovery;
- risk: real combat + trigger trap + treasure.

Expected behavior:

- safe clears all three floors;
- treasure clears all three floors with progression/loot carry;
- risk reaches Floor 3 and is defeated there;
- Floor 3 becomes the aggregate bottleneck;
- authored and observed pressure progression is visible;
- repeated runs are byte-deterministic;
- the authoring RunSpec remains unchanged.
