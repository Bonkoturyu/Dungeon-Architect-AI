# DAI-034 Clear / Failure / Result Validation

## Status

**DONE. Production validation passed on 2026-09-13.**

DAI-034 completes the renderer-independent terminal PlaySession boundary and expands Result from the earlier basic Goal summary into a stable route / gameplay-metrics projection.

The task does not choose a combat policy or invent a full HP/balance model. Instead it provides a fixed terminal failure contract that later combat, timeout, or progression systems can invoke.

## Terminal session states

A PlaySession remains mutable only while `status === "playing"`.

Successful movement into the Goal room continues to produce:

- `status = "cleared"`
- `failureReason = null`
- fixed `completedAt`

`failPlaySession(session, reason, options)` produces:

- `status = "failed"`
- fixed `completedAt`
- one supported `failureReason`
- a `session-failed` audit event

Supported failure reasons are deliberately fixed:

- `player-defeated`
- `timeout`
- `progression-blocked`
- `stopped`

Unknown failure reasons are rejected with `FAILURE_REASON_UNSUPPORTED`.
Once a session is cleared or failed, movement and generic state commands remain rejected by the existing `SESSION_NOT_PLAYING` boundary.

## Why failure is policy-neutral

DAI-034 does not decide *how* a failure happens.

Examples:

- a later combat policy may call `player-defeated`;
- a Play timer may call `timeout`;
- a validated runtime safety detector may call `progression-blocked`;
- an explicit stop control may call `stopped`.

This keeps Result/failure semantics independent from the still-pending PCE-1.0 Combat decision.

## Result v1 projection

`createPlayResult()` now returns a renderer-independent object containing:

- `schemaVersion`
- dungeon ID
- `status`
- `failureReason`
- start/completion/elapsed time
- move count
- ordered `routeRoomIds`
- unique `visitedRoomIds`
- final room and Goal room
- gameplay metrics

Gameplay metrics project existing session counters:

- rooms visited
- room entries
- interactions
- enemies cleared
- treasures opened
- traps triggered
- recovery used
- damage taken
- healing received
- terminal deaths

`deaths` is `1` only for a terminal `player-defeated` failure and `0` otherwise. DAI-034 does not implement multiple lives or respawn; a defeat is terminal for this PlaySession contract.

The ordered route is reconstructed from the immutable Start room plus successful `move` audit events, so revisits remain visible in the route while `visitedRoomIds` remains the unique-room set.

## Source alignment

The pre-production User Flow specifies a terminal `Clear / Game Over` stage followed by Result / Reveal including:

- Play time
- Route
- Rooms visited
- Chests opened
- Traps triggered
- Damage / deaths

DAI-034 covers the Core/PlaySession data needed for those Result fields. Full-map presentation, AI design explanation, and Edit-and-retry UI remain later UI/product work.

## Test coverage

`packages/play-core/test/result-runtime.test.js` verifies:

- fixed failure-reason vocabulary;
- immutable terminal failure transition;
- invalid failure reason rejection;
- no movement/state mutation after failure;
- clear Result route and metrics;
- failed Result route, reason, elapsed time, and metrics;
- `player-defeated` terminal death projection;
- unfinished Result rejection;
- cleared session cannot later be overwritten by failure.

Existing tests continue to cover Goal clear and all prior runtime mechanics.

## Production evidence scenario

`scripts/run-dai-034-clear-failure-result.mjs` uses the production PCE 20-room fixture and creates three independent sessions:

1. a clear run along `room-00` through `room-10`, with deterministic counter values projected into Result;
2. a timeout failure after `room-02`, verifying immutability and terminal behavior;
3. a `player-defeated` failure verifying the terminal death projection.

The scenario also verifies invalid failure rejection, unfinished Result rejection, route capture, authoring immutability, snapshot immutability, and previous-session preservation.

## Reviewed production evidence

Evidence file: `artifacts/result-runtime/dai-034-clear-failure-result.json`

- generated at: `2026-09-13T12:19:58.101Z`
- Node.js: `v24.15.0`
- source fixture: `pce-perspective-combat-20-v1`
- reviewed JSON SHA-256: `2a27412820d8b3d7dd67f399618d6b05501c24776d93d1bae35d938e6096b988`
- `passed = true`
- 24 / 24 checks passed

Observed evidence includes:

- clear session reached `room-10` and produced a valid Result with `failureReason = null`;
- ordered clear route contains `room-00` through `room-10` and 11 unique visited rooms;
- clear metrics projected `interactions = 4`, `enemiesCleared = 2`, `treasuresOpened = 1`, `trapsTriggered = 1`, `recoveryUsed = 1`, `damageTaken = 7`, `healingReceived = 3`, and `deaths = 0`;
- timeout produced a terminal failed Result after `room-02`, `elapsed = 60`, `damageTaken = 12`, and `deaths = 0`;
- movement and generic state mutation after timeout failure were rejected;
- unsupported failure reason was rejected without mutating the source session;
- `player-defeated` produced `deaths = 1`;
- unfinished Result generation was rejected;
- authoring data and execution snapshots remained unchanged.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-034-clear-failure-result; git pull --ff-only origin feat/dai-034-clear-failure-result; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-034-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node test suite;
4. runs the deterministic DAI-034 Result/failure evidence scenario;
5. writes `artifacts/result-runtime/dai-034-clear-failure-result.json`.

## Completion gate

DAI-034 completion conditions are satisfied:

- complete production Node test suite passed;
- production evidence reports `passed = true`;
- generated JSON evidence was reviewed;
- clear, timeout failure, player-defeated failure, terminal behavior, route projection, metrics projection, and immutability gates passed.

## Explicit non-goals

DAI-034 does not implement:

- player HP/max-HP rules;
- attack/damage balance;
- trap damage amount;
- recovery healing amount;
- automatic wall-clock timeout scheduling;
- respawn/multiple-life behavior;
- final Result UI;
- full-map reveal UI;
- AI design explanation;
- PCE-1.0 Perspective or Combat selection.

Those remain later Play/UI/PCE/simulation work.
