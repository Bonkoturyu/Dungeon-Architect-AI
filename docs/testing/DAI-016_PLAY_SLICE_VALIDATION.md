# DAI-016 START → Goal → Result Browser Validation

## Status

**DONE — production validation passed on Windows/Chrome.**

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

## Production validation result

Executed on 2026-09-13 through the one-command production validation flow.

Reviewed raw evidence:

- JSON file: `dai-016-play-smoke.json`
- JSON SHA-256: `4b05ab0e17c20b12ef3f8250fc659ecc4750f97a0ce6e9b3a4da13eb4edac6e2`
- screenshot: `dai-016-play-smoke.png`
- screenshot SHA-256: `a2750ceee30a72fd4d04f3af58de98136652ff8244e46edc5b1615d628df1f1d`
- Chrome executable: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- smoke URL: `http://127.0.0.1:4175/apps/play-slice/index.html`

Observed result:

- `passed = true`
- initial mode: `authoring`
- START succeeded
- execution snapshot detached from authoring object: true
- authoring object unchanged after START: true
- start room: `room-start`
- `room-middle` reached: true
- `room-goal` reached: true
- final mode: `result`
- final status: `cleared`
- moves: 2
- visited route: `room-start → room-middle → room-goal`
- Result final room: `room-goal`
- Result goal room: `room-goal`
- `consoleErrors = []`
- `pageErrors = []`
- `failedRequests = []`
- `httpErrors = []`

The screenshot visually confirms the Goal room highlighted in the final Result state and the UI reporting `cleared · moves 2 · visited 3`.

## Verification gate result

DAI-016 acceptance conditions are satisfied for the minimal browser vertical slice:

- START occurs through play-core rather than direct UI state mutation;
- execution uses a detached snapshot;
- adjacent room clicks drive play-core movement;
- Goal is reached after the expected two moves;
- Result is produced by `createPlayResult`;
- the expected visited route is preserved;
- browser smoke completes without console/page/network errors.

## Follow-up scope

This slice does not yet implement enemy combat, treasure/trap/recovery runtime, supported event logic, fog-of-war, failure states, Result analytics beyond the current basic play-core Result, final Play camera choice, or final art direction.
