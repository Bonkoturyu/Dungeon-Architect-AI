# DAI-086 Exploration / Mystery Play UX

## Status

**DONE.**

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

The visible-Chrome smoke passed and human visual review was accepted on 2026-09-20.

Reviewed evidence SHA-256:

- JSON: `df363a36e86c0cfaf8ebaf51071484a6a3ee5cc2968a0b1cc1e6fdbfd6c74438`;
- Test start PNG: `a01f069cb209031e817d2fcaf5800456a2f7b45a71cc9d25d6e53695c1622601`;
- Test after one move PNG: `9a0d41dd0916f716ce3f7b1ba41f0d708ef94d3ebd3510c7452c1dd130a10a5c`;
- Mystery start PNG: `7ed88dc2ba33ee6032d61e6ad9d67032504e3e2045e88de6933ff6b97a540501`.

The reviewed captures confirmed Start-only initial mapping, persistent explored topology after movement, clear current-room emphasis, hidden unrelated topology/Goal, and a fresh Mystery layout using the same compact Play presentation.
