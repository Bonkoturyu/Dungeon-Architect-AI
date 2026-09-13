# DAI-032 Treasure / Trap / Recovery Runtime Validation

## Status

**IN PROGRESS.**

DAI-032 adds renderer-independent runtime semantics for the remaining non-enemy PCE Play interactions: treasure, trap, and recovery entities.

The implementation is intentionally minimal and deterministic. It does not add arbitrary generated runtime code, player HP, balance values, or final UI presentation.

## Runtime contract

Authoring entities stay inside the fixed execution snapshot. Runtime state is stored only in `PlaySession.gameplayState.entityStates`.

### Treasure

Default runtime state:

```json
{
  "status": "closed",
  "inspections": 0,
  "lastInspectedAt": null,
  "openedAt": null
}
```

Supported operations:

- inspect a current-room treasure without opening it;
- expose authoring warning metadata for presentation/evaluation;
- open a current-room treasure once;
- increment `treasuresOpened` only on first open;
- increment generic `interactions` on each successful inspect/open action.

### Trap

Default runtime state:

```json
{
  "status": "armed",
  "inspections": 0,
  "lastInspectedAt": null,
  "resolvedAt": null
}
```

Supported operations:

- inspect a current-room trap and expose warning metadata;
- resolve an armed trap as `avoided` or `triggered`;
- increment `trapsTriggered` only when resolution is `triggered`;
- reject a second resolution attempt.

No damage amount is assigned in DAI-032 because the player HP/failure model remains later scope.

### Recovery

Default runtime state:

```json
{
  "status": "available",
  "usedAt": null
}
```

Supported operations:

- use a current-room recovery entity once;
- increment `recoveryUsed` once;
- reject repeat use.

No healing amount is assigned in DAI-032 because the player HP model remains later scope.

## Production API

`packages/play-core/src/interaction-runtime.js` exposes:

- `getTreasureState(session, treasureId)`
- `getTrapState(session, trapId)`
- `getRecoveryState(session, recoveryId)`
- `listRoomInteractables(session, roomId, options)`
- `inspectTreasure(session, treasureId, options)`
- `openTreasure(session, treasureId, options)`
- `inspectTrap(session, trapId, options)`
- `avoidTrap(session, trapId, options)`
- `triggerTrap(session, trapId, options)`
- `useRecovery(session, recoveryId, options)`

Rules shared by mutating operations:

- session must be `playing`;
- target entity must be the required type in the fixed execution snapshot;
- target entity must be in the current room;
- authoring `DungeonSpec` and execution snapshot are not mutated;
- prior `PlaySession` values are preserved;
- state transitions append explicit audit events.

`listRoomInteractables()` hides resolved treasure/trap/recovery entities by default but can include them for inspection/debugging.

## PCE-1.0 relevance

The frozen Perspective tasks require:

- opening `room-03` normal treasure;
- observing the dangerous `room-14` treasure without opening it;
- using the `room-19` recovery point;
- avoiding the `room-16` trap.

DAI-032 supplies the renderer-independent runtime layer for those operations. It does **not** by itself satisfy the Perspective candidate study: entity rendering, warning presentation, three camera candidates, route-judgment UI, mobile target IDs, and participant evidence remain separate requirements.

## Test coverage

`packages/play-core/test/interaction-runtime.test.js` verifies:

- warning metadata can be inspected without opening treasure;
- treasure open is current-room-only and one-shot;
- `treasuresOpened` increments once;
- trap inspection preserves armed state;
- trap avoid and trigger are mutually exclusive one-shot resolutions;
- avoided traps do not increment `trapsTriggered`;
- triggered traps increment `trapsTriggered` once;
- recovery use is one-shot and increments `recoveryUsed`;
- resolved interactables are hidden from the default room query;
- unknown/remote/finished-session actions are rejected;
- authoring/session snapshot boundaries remain intact.

## Production evidence scenario

`scripts/run-dai-032-interaction-runtime.mjs` uses:

`spec/dungeon/fixtures/pce-perspective-combat-20-v1.json`

The main run:

1. reaches `room-03` and opens `chest-plain`;
2. reaches `room-14`, reads the `floor-scratches` warning, inspects `chest-warning`, and leaves it closed;
3. reaches `room-19` and uses `recovery-01`;
4. reaches `room-16`, reads the `floor-cracks` warning, inspects `trap-01`, and avoids it;
5. reaches `room-10` Goal and confirms Result remains valid.

A fresh second session reaches `room-16` and deliberately triggers `trap-01` so the triggered-state/counter path is also exercised.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-032-interaction-runtime; git pull --ff-only origin feat/dai-032-interaction-runtime; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-032-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node test suite;
4. runs the deterministic PCE interaction evidence scenario;
5. writes `artifacts/interaction-runtime/dai-032-interaction-runtime.json`.

## Completion gate

Do not mark DAI-032 DONE until:

- the complete production Node test suite passes;
- the PCE interaction evidence reports `passed = true`;
- the generated JSON evidence is reviewed.

## Explicit non-goals

DAI-032 does not implement:

- player HP/death/failure;
- trap damage amount;
- recovery healing amount;
- treasure rewards/inventory drops;
- treasure-triggered enemy spawn;
- final entity rendering or warning visuals;
- camera/Perspective selection;
- supported trigger/condition/action event execution;
- balance/simulation scoring.

Those remain DAI-017, DAI-033, DAI-034, renderer/UI follow-up work, and later simulation tasks.
