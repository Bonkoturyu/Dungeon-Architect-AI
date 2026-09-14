# DAI-051 Manual Editor Validation

## Status

**IN PROGRESS.** The browser manual-editor implementation is ready for production Chrome validation.

DAI-051 extends the existing DAI-015 room-selection/move slice into an explicit manual authoring surface for entity placement while preserving the renderer-independent `EditCommand` boundary.

## Scope

The editor UI now supports:

- room selection by clicking the rendered dungeon;
- room movement with arrow keys through `move-room`;
- entity inspection through a deterministic entity list;
- moving any existing entity, including Start/Goal, to a selected target room through `move-entity`;
- adding `enemy`, `treasure`, `trap`, and `recovery` entities through `add-entity`;
- removing non-protected entities through `remove-entity`;
- blocking generic Start/Goal removal in the UI as well as in Editor Core;
- Undo/Redo for manual entity edits through the existing `EditSession` command history.

The browser UI never mutates `DungeonSpec` directly.

## ID allocation

Manually added entities use deterministic editor IDs:

`<type>-editor-<n>`

where `n` is the first positive integer not already present in the current spec. Start and Goal cannot be created through this generic add flow.

## Production smoke scenario

`scripts/run-dai-051-manual-editor-smoke.mjs` uses the existing production minimal fixture and visible Chrome. It verifies real browser interactions:

1. `treasure-1` begins in `room-middle`;
2. the inspector selects `treasure-1`;
3. the target-room selector moves it to `room-goal`;
4. Undo returns it to `room-middle`;
5. Redo moves it to `room-goal` again;
6. a new Trap is added to `room-start` as `trap-editor-1`;
7. the Trap becomes the selected entity;
8. Remove deletes that Trap;
9. Undo restores the Trap to `room-start`;
10. selecting `start-1` disables generic Remove;
11. clicking `room-middle` in the 3D canvas synchronizes the inspector target room;
12. browser console/page/request/HTTP errors remain empty.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-051-manual-editor; git pull --ff-only origin feat/dai-051-manual-editor; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-051-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node suite;
4. launches the manual editor in visible Chrome;
5. performs the entity move/add/remove/undo interactions;
6. writes:
   - `artifacts/manual-editor/dai-051-manual-editor.json`
   - `artifacts/manual-editor/dai-051-manual-editor.png`

## Completion gate

Do not mark DAI-051 DONE until:

- the complete production Node suite passes;
- browser evidence reports `passed = true`;
- entity move Undo/Redo passes;
- entity add/remove/restore passes;
- protected Start/Goal removal is disabled;
- canvas room selection synchronizes the inspector target room;
- Chrome emits no console/page/request/HTTP errors;
- generated JSON evidence and screenshot are reviewed.

## Explicit non-goals

DAI-051 does not yet add:

- room/corridor creation or deletion;
- resize-room controls;
- door/shortcut/event editing;
- natural-language edit parsing;
- production-quality art/icons for non-Start/Goal entities;
- mobile editor UX.

Those remain later M5/M7 work.
