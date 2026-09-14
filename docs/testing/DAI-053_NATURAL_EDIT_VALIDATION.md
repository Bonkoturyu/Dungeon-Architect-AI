# DAI-053 Natural-language Edit Validation

## Status

**IN PROGRESS.** The first AI-backed natural-language authoring path is implemented and awaits live visible-Chrome production evidence.

DAI-053 connects the browser editor to a backend-only OpenAI edit translator while preserving the existing renderer-independent `EditCommand` / `EditSession` boundary.

## First MVP path

The first supported natural-language edit is deliberately constrained to one operation:

`natural-language request -> structured move-entity EditCommand -> independent validation -> EditSession.apply()`

Example intent:

> Move the treasure to the room that contains the goal.

The model is not allowed to mutate `DungeonSpec`, generate arbitrary runtime code, or return multiple commands.

## Provider boundary

`packages/cloud-intent/src/openai-edit-command-adapter.js`:

- uses the current backend-configurable cloud model candidate;
- uses `store: false`;
- uses strict Structured Outputs / JSON Schema;
- allows only `type = move-entity` for this first path;
- constrains `entityId` to exact current entity IDs;
- constrains `roomId` to exact current room IDs;
- independently validates returned IDs and fields;
- rejects no-op moves;
- normalizes provider transport/rate-limit/HTTP failures;
- exposes only sanitized provider metadata.

The provider context contains only current room IDs plus entity ID/type/location triples. The provider secret remains backend-only.

## Browser integration

The DAI-051 editor now has a Natural-language edit panel. It posts the request plus bounded authoring context to a configurable backend endpoint and applies a successful returned command through the existing `EditSession`.

Successful AI edits therefore inherit the same:

- DungeonSpec validation;
- immutable authoring transition;
- Undo/Redo history;
- renderer rebuild and selection behavior.

If the backend is unavailable or rejects the request, the current Spec is not changed.

## Live smoke scenario

`scripts/run-dai-053-natural-edit-smoke.mjs` starts:

- the production editor through Vite;
- a local project-owned backend test boundary on a separate localhost port;
- visible Chrome through Playwright.

The backend uses the real OpenAI Responses transport and one live provider call.

The browser smoke verifies:

1. `treasure-1` begins in `room-middle`;
2. a natural-language request asks to move the treasure to the room containing the goal;
3. the backend translator returns exactly `{ type: "move-entity", entityId: "treasure-1", roomId: "room-goal" }`;
4. the browser applies that command through `EditSession`;
5. `treasure-1` moves to `room-goal`;
6. the edited entity and destination room become selected;
7. Undo returns the treasure to `room-middle`;
8. Redo moves it back to `room-goal`;
9. exactly one live provider call is made;
10. evidence contains neither the API key nor the full natural-language test prompt;
11. Chrome emits no console/page/request/HTTP errors.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-053-natural-edit; git pull --ff-only origin feat/dai-053-natural-edit; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-053-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node suite;
4. securely asks for `OPENAI_API_KEY` if it is not already process-local;
5. performs one live billable natural-edit provider call;
6. launches visible Chrome and exercises the browser path;
7. writes:
   - `artifacts/natural-edit/dai-053-natural-edit.json`
   - `artifacts/natural-edit/dai-053-natural-edit.png`

Do not paste the API key into chat, GitHub, screenshots, command-line arguments, or committed files.

## Completion gate

Do not mark DAI-053 DONE until:

- complete production Node tests pass;
- live browser evidence reports `passed = true`;
- exactly one provider call produces the expected constrained `move-entity` command;
- browser application of the command succeeds;
- Undo/Redo succeeds after the natural-language edit;
- no invented IDs or unsupported fields pass the adapter tests;
- evidence safety checks show no API-key/full-prompt leak;
- browser/network error arrays are empty;
- generated JSON evidence and screenshot are reviewed.

## Explicit non-goals

This first DAI-053 slice does not yet:

- translate room movement, entity add/remove, corridor edits, or event edits from language;
- support multi-command natural-language transactions;
- expose provider credentials to the browser;
- deploy the final public backend;
- provide final mobile natural-language editing UX.

Those can expand after the single-command path is proven end-to-end.
