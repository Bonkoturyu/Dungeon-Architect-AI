# DAI-086 Exploration / Mystery Play UX

## Status

**IN PROGRESS / VISIBLE-CHROME EVIDENCE PENDING.**

## Goal

Make Play an exploration experience rather than a full-map preview while preserving one shared Generator, DungeonSpec, Play Core, and Three.js renderer.

## Architecture

The complete `DungeonSpec` remains the source of truth.

Edit mode:

```text
DungeonSpec → Three.js renderer → full authoring map
```

Play mode:

```text
PlaySession.snapshot
      ↓
renderer-independent PlayMap
      ↓
visibility projection
      ↓
same Three.js renderer
      ↓
explored rooms / traversed corridors only
```

The renderer does not receive a second dungeon format.

## Exploration rules

- Start room is visible at Play start.
- All unvisited rooms are hidden.
- Goal is hidden until its room is explored.
- No untraversed corridor geometry is drawn.
- Entering a room permanently adds it to the explored map.
- Traversing a corridor permanently adds that corridor to the explored map.
- Previously explored rooms remain visible in a dimmer state.
- Current room receives a brighter state/highlight.
- Available exits are represented by directional icon buttons.
- Runtime-disabled corridors are not offered as exits.

## Test vs Mystery

### Test

Uses the current authoring `DungeonSpec` as the Play snapshot.

The player-facing Play surface still uses Fog of War, even though the author may already know the layout.

### Mystery

Uses the same last validated `DesignIntent` and the same production generator, but generates a fresh seed directly into a Play snapshot.

The new `DungeonSpec` is never installed into the EditSession and is never shown as a full authoring map.

Returning to Edit restores the original authoring dungeon.

## UI boundary

Play-facing text does not show:

- Goal room ID;
- hidden room IDs;
- Mystery seed;
- complete room/corridor topology.

The browser debug test hook may inspect the full Play snapshot for automated verification; that is not part of the user-facing UI.

## Validation

```powershell
npm run test:play
npm run test:renderer-three
npm run smoke:exploration-ux
```

Expected evidence:

- `artifacts/exploration-ux/dai-086-exploration-ux.json`;
- `artifacts/exploration-ux/test-play-start.png`;
- `artifacts/exploration-ux/test-play-after-one-move.png`;
- `artifacts/exploration-ux/mystery-play-start.png`.

Human visual review remains required before merge.
