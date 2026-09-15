# DAI-053 Natural-language Edit Validation

## Status

**DONE.** The first AI-backed natural-language authoring path passed live visible-Chrome production validation on 2026-09-15.

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

The DAI-051 editor has a Natural-language edit panel. It posts the request plus bounded authoring context to a configurable backend endpoint and applies a successful returned command through the existing `EditSession`.

Successful AI edits therefore inherit the same:

- DungeonSpec validation;
- immutable authoring transition;
- Undo/Redo history;
- renderer rebuild and selection behavior.

If the backend is unavailable or rejects the request, the current Spec is not changed.

## Reviewed production evidence

Evidence file: `artifacts/natural-edit/dai-053-natural-edit.json`

- generated: `2026-09-15T14:48:43.232Z`
- JSON SHA-256: `38f178ca25f6c73d6b06930bc089fb0950602aee05787468aed675c32fc4aec8`
- model: `gpt-5.6-luna`
- live provider call made: true
- result: `passed = true`
- initial treasure room: `room-middle`
- translated command: `{ type: "move-entity", entityId: "treasure-1", roomId: "room-goal" }`
- treasure moved to `room-goal`: true
- edited entity selected after edit: true
- destination room selected after edit: true
- Undo returned treasure to `room-middle`: true
- Redo returned treasure to `room-goal`: true
- provider call count: 1
- provider latency: `2892.5666 ms`
- usage: 295 input + 34 output = 329 tokens
- API-key leak: false
- full-prompt leak: false
- console errors: 0
- page errors: 0
- failed requests: 0
- HTTP errors: 0

The reviewed screenshot also shows `treasure-1` selected in `room-goal`, the natural-language request in the editor panel, and `applied: move-entity` after Redo.

## Completion gate result

All DAI-053 completion gates passed:

- complete production Node tests passed before the browser run;
- live browser evidence reports `passed = true`;
- exactly one provider call produced the expected constrained `move-entity` command;
- browser application of the command succeeded;
- Undo/Redo succeeded after the natural-language edit;
- adapter tests reject invented IDs, extra fields, unsupported commands, and no-op moves;
- evidence safety checks show no API-key/full-prompt leak;
- browser/network error arrays are empty;
- JSON evidence and screenshot were reviewed.

## Explicit non-goals

This first DAI-053 slice does not yet:

- translate room movement, entity add/remove, corridor edits, or event edits from language;
- support multi-command natural-language transactions;
- expose provider credentials to the browser;
- deploy the final public backend;
- provide final mobile natural-language editing UX.

Those can expand later without weakening the proven single-command boundary.
