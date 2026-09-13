# DAI-031 Enemy Minimum Validation

## Status

**IN PROGRESS.**

DAI-031 adds the minimum renderer-independent enemy lifecycle required by later Play, event-logic, simulation, and PCE-1.0 Combat work.

It deliberately does **not** select a combat policy. PCE-1.0 Combat candidates remain:

- `none`
- `avoidant optional`
- `mandatory encounter`

The DAI-031 runtime primitives can be used by any of those policies.

## Runtime contract

Enemy definitions remain authoring data inside the fixed execution snapshot:

```json
{
  "id": "enemy-01",
  "type": "enemy",
  "roomId": "room-08"
}
```

Runtime state is stored only in `PlaySession.gameplayState.entityStates`.

An untouched enemy is interpreted without mutation as:

```json
{
  "status": "active",
  "encounters": 0,
  "lastEncounterAt": null,
  "defeatedAt": null
}
```

## Production API

`packages/play-core/src/enemy-runtime.js` exposes:

- `getEnemyState(session, enemyId)`
- `listRoomEnemies(session, roomId, options)`
- `recordEnemyEncounter(session, enemyId, options)`
- `defeatEnemy(session, enemyId, options)`

Rules:

- enemy actions require a `playing` session;
- the target ID must reference an `enemy` entity in the fixed execution snapshot;
- encounter/defeat requires the enemy to be in the current room;
- encounter count increments immutably;
- defeat marks runtime state only and increments `enemiesCleared` exactly once;
- duplicate defeat is rejected with `ENEMY_ALREADY_DEFEATED`;
- defeated enemies are excluded from the default active-room query;
- authoring `DungeonSpec` and execution snapshot are never mutated.

## Policy boundary

DAI-031 does not automatically force an encounter when entering an enemy room.

That is intentional: automatic blocking, optional avoidance, or no-combat behavior belongs to the frozen PCE-1.0 Combat candidate policy layer. DAI-031 only supplies common enemy-state primitives so those candidates can share the same entity and session contracts.

## Test coverage

`packages/play-core/test/play-session.test.js` additionally verifies:

- untouched enemy presence is derived from snapshot data without state mutation;
- remote enemy actions are rejected;
- encounter state is immutable and snapshot-safe;
- defeat increments `enemiesCleared` exactly once;
- duplicate defeat is rejected;
- defeated enemy filtering works;
- unknown enemy IDs are rejected;
- enemy actions after session completion are rejected;
- existing START → movement → Goal → Result behavior remains valid.

## Production evidence scenario

`scripts/run-dai-031-enemy-minimum.mjs` uses the migrated production PCE fixture:

`spec/dungeon/fixtures/pce-perspective-combat-20-v1.json`

The scenario:

1. starts a detached Play session;
2. confirms both PCE enemy entities are initially active;
3. confirms remote defeat is rejected;
4. follows the main route to `enemy-01` in `room-08`;
5. records one encounter and one defeat;
6. confirms duplicate defeat does not double-count;
7. follows the optional branch to `enemy-02` in `room-18`;
8. records one encounter and one defeat;
9. reaches Goal through `room-09` → `room-10`;
10. confirms finished-session enemy actions are rejected;
11. confirms authoring data and execution snapshot are unchanged.

This is engineering evidence for the shared enemy runtime only. It is **not** a PCE-1.0 Combat-candidate result.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-031-enemy-minimum; git pull --ff-only origin feat/dai-031-enemy-minimum; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-031-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the full production Node test suite;
4. runs the PCE-fixture enemy runtime evidence scenario;
5. writes `artifacts/enemy-runtime/dai-031-enemy-minimum.json`.

## Completion gate

Do not mark DAI-031 DONE until:

- the complete production Node test suite passes;
- the enemy runtime evidence reports `passed = true`;
- the generated JSON evidence is reviewed.

## Explicit non-goals

DAI-031 does not decide or implement:

- combat camera/perspective;
- attack controls or damage timing;
- player HP/death/failure;
- enemy AI movement;
- automatic mandatory encounter blocking;
- optional avoidance policy;
- reward drops;
- treasure/trap/recovery semantics;
- trigger/condition/action event execution;
- combat balancing.

Those remain DAI-017, DAI-032 through DAI-034, and later simulation/balance work.
