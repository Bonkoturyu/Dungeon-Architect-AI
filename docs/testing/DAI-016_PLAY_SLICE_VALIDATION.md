# DAI-016 START → Goal → Result Browser Validation

## Status

**IN PROGRESS.**

DAI-016 connects the existing renderer-independent `play-core` session logic to the Three.js browser slice.

## Existing Core guarantees reused

`packages/play-core` already verifies:

- START blocks an invalid authoring spec;
- START deep-clones an execution snapshot independent from later authoring mutations;
- movement only accepts adjacent rooms;
- the backbone path can reach Goal;
- a cleared session produces a deterministic basic Result.

The browser slice does not replace those Core tests; it verifies the actual browser integration.

## Implemented browser slice

`apps/play-slice/` implements:

1. load/render a valid authoring `DungeonSpec`;
2. START through `startPlaySession(authoringSpec)`;
3. render the fixed execution snapshot rather than a mutable authoring object;
4. highlight the current room using the renderer adapter;
5. click a rendered adjacent room and call `movePlaySession`;
6. reject non-adjacent movement through play-core without mutating the session;
7. when Goal is reached, call `createPlayResult` and expose the Result in the browser UI.

The browser UI does not directly mutate the play session or `DungeonSpec`.

## Visible Chrome smoke sequence

The production smoke runner must:

1. load the minimal 3-room fixture in authoring mode;
2. click the real START button;
3. verify the play snapshot is detached from the authoring object;
4. verify current room is `room-start`;
5. click rendered `room-middle` and reach it in one move;
6. click rendered `room-goal` and clear in the second move;
7. verify visited route is `room-start → room-middle → room-goal`;
8. verify Result reports `cleared`, two moves, and `room-goal` as the final room;
9. finish with no console/page/request/HTTP errors.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-016-play-slice; git pull --ff-only origin feat/dai-016-play-slice; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-016-validation.ps1
```

The runner:

- verifies the audited `package-lock.json` SHA-256;
- performs `npm ci --ignore-scripts`;
- runs the full production Node test suite;
- starts Vite locally;
- drives the play slice in visible Chrome through `playwright-core`;
- writes JSON evidence and a screenshot under `artifacts/play-smoke/`.

Expected evidence:

- `artifacts/play-smoke/dai-016-play-smoke.json`
- `artifacts/play-smoke/dai-016-play-smoke.png`

## Completion gate

Do not mark DAI-016 DONE until the one-command production validation passes and the JSON/screenshot evidence is reviewed.

## Explicit non-goals

This slice does not yet implement enemy combat, treasure/trap/recovery runtime, supported event logic, fog-of-war, failure states, Result analytics beyond the current basic play-core Result, final Play camera choice, or final art direction.
