# DAI-015 Browser Selection / Move / Undo Validation

## Status

**DONE — production validation passed on Windows/Chrome.**

DAI-015 connects the renderer-independent `EditSession` / `EditCommand` layer to the Three.js browser slice without allowing UI code to mutate `DungeonSpec` directly.

## Implemented slice

- click a rendered room to select it;
- selected room receives a Three.js-side visual selection box;
- arrow keys move the selected room in 1-unit steps;
- movement is applied only through `EditSession.apply({ type: "move-room", ... })`;
- Ctrl+Z and Undo button call `EditSession.undo()`;
- Ctrl+Y / Ctrl+Shift+Z and Redo button call `EditSession.redo()`;
- renderer is rebuilt from the resulting validated `DungeonSpec` after edit/undo/redo;
- selection is restored by Spec ID after each valid re-render;
- renderer picking remains inside the Three.js adapter rather than leaking Three.js types into Core/editor-core.

## Renderer adapter additions

`packages/renderer-three/src/three-renderer-adapter.js` exposes browser-facing plain-data primitives:

- `pickSpecAt(clientX, clientY)` → plain Spec metadata;
- `setSelectedSpecId(id)` → internal visual selection helper;
- `getScreenPositionForSpecId(id)` → plain `{x, y}` client coordinates for smoke automation.

No Three.js object is added to serialized `DungeonSpec` or editor-core state.

## Production validation result

Executed on 2026-09-13 using the one-command validation flow on Windows with visible Chrome.

Reviewed raw evidence:

- JSON: `dai-015-editor-smoke.json`
- JSON SHA-256: `cc349a95fd1ecd878c09b33824d57b6976518a4839134f846da8016d71cc8aea`
- screenshot: `dai-015-editor-smoke.png`
- screenshot SHA-256: `b3bb8f3c497260de1018a409b36407e8010e0553ca055ec98c1558e12bf67c94`
- Chrome executable: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- URL: `http://127.0.0.1:4174/apps/editor-slice/index.html`

Observed sequence:

1. `room-middle` was selected by an actual canvas click.
2. Initial X was `12`.
3. `ArrowRight` moved it to X=`13`.
4. `Ctrl+Z` restored X=`12`.
5. `Ctrl+Y` restored X=`13`.
6. Selection remained on the room through move/undo/redo.
7. Undo remained available after redo; redo was exhausted after redo.

Observed evidence fields:

- `passed = true`
- `selectedByCanvas = true`
- `initialX = 12`
- `movedX = 13`
- `undoX = 12`
- `redoX = 13`
- `selectionPreservedAfterMove = true`
- `selectionPreservedAfterUndo = true`
- `selectionPreservedAfterRedo = true`
- `canUndoAfterRedo = true`
- `canRedoAfterRedo = false`
- `consoleErrors = []`
- `pageErrors = []`
- `failedRequests = []`
- `httpErrors = []`

The screenshot visually confirms `room-middle` selected after the final redo at `(13.0, 0.0)`, with Undo enabled and Redo disabled.

## Verification gate result

DAI-015 acceptance conditions are satisfied for the vertical slice:

- visible room selection works through renderer picking;
- room movement is routed through `EditCommand`/`EditSession`, not direct UI mutation;
- move, undo and redo produce the expected coordinates;
- selection survives valid renderer rebuilds by Spec ID;
- renderer-specific picking/highlight behavior remains inside the Three.js adapter;
- the browser smoke completes without console/page/request/HTTP errors.

## Explicit non-goals

This slice does not yet include free-form mouse drag movement, snapping UI, multi-selection, entity editing, corridor editing, natural-language editing, or final editor UX/art direction. Those remain later tasks.
