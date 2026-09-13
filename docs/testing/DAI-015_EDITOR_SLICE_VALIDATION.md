# DAI-015 Browser Selection / Move / Undo Validation

## Status

**IN PROGRESS.**

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

`packages/renderer-three/src/three-renderer-adapter.js` now exposes browser-facing primitives:

- `pickSpecAt(clientX, clientY)` → plain Spec metadata;
- `setSelectedSpecId(id)` → internal visual selection helper;
- `getScreenPositionForSpecId(id)` → plain `{x, y}` client coordinates for smoke automation.

No Three.js object is added to serialized `DungeonSpec` or editor-core state.

## Browser slice

`apps/editor-slice/` uses the existing `minimal-valid-v1` fixture.

The smoke test must verify the following sequence in visible Chrome:

1. load the valid fixture;
2. select `room-middle` by an actual canvas click;
3. move it +1 on X with `ArrowRight`;
4. undo with `Ctrl+Z` and recover the original X;
5. redo with `Ctrl+Y` and recover the moved X;
6. preserve the selected room through move/undo/redo;
7. finish with no console/page/request/HTTP errors.

## Required production validation

Run from the existing Windows clone:

```powershell
git fetch origin; git switch feat/dai-015-editor-selection; git pull --ff-only origin feat/dai-015-editor-selection; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-015-validation.ps1
```

The runner verifies the already reviewed `package-lock.json`, performs `npm ci --ignore-scripts`, runs the complete production Node test suite, then executes the visible Chrome editor smoke test.

Expected evidence:

- `artifacts/editor-smoke/dai-015-editor-smoke.json`
- `artifacts/editor-smoke/dai-015-editor-smoke.png`

## Completion gate

Do not mark DAI-015 DONE until the production validation command passes and the generated JSON/screenshot evidence is reviewed.

## Explicit non-goals

This slice does not yet include free-form mouse drag movement, snapping UI, multi-selection, entity editing, corridor editing, natural-language editing, or final editor UX/art direction.
