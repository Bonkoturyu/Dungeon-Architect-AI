# Algorithm Lab — Rooms + Mazes

## Status

DAI-100 implementation candidate.

Strategy ID:

`algorithm-lab.rooms-mazes`

Reusable Core:

`packages/generator-algorithms/rooms-mazes/`

Dungeon Architect AI adapter:

`packages/generator/src/strategies/rooms-mazes-lab.js`

Version 2 remains the Recommended/default generator.

## Purpose

Rooms + Mazes generates a Room graph by first choosing a connected set of coarse grid cells and then carving a perfect maze through only local cardinal adjacencies.

This keeps the reusable algorithm independent from DungeonSpec while producing geometry that maps cleanly to the existing orthogonal corridor renderer.

## Core inputs

The Core accepts plain JSON-compatible values:

- `seed`: non-negative safe integer;
- `roomCount`: 3–64;
- `extraConnectionRatio`: 0–1;
- `roomSizeMin`;
- `roomSizeMax`;
- `cellSpacing`.

Defaults:

- Room size 7–9;
- cell spacing 14.

`cellSpacing` must leave at least a 3-unit gap beyond the maximum Room size.

## Algorithm

1. Build a bounded rectangular coarse grid.
2. Select a connected set of exactly `roomCount` grid cells using seeded randomized depth-first expansion.
3. Build the cardinal adjacency graph of those selected cells.
4. Carve a seeded depth-first perfect maze over the selected-cell graph.
5. Find the maze-tree diameter.
6. Remap the two diameter endpoints to the first and last Room IDs so baseline Start/Goal placement gets a long maze path.
7. Convert selected cells into non-overlapping Room rectangles.
8. Collect unused local cardinal adjacencies.
9. Add a deterministic subset of those adjacencies according to `extraConnectionRatio`.

The perfect-maze tree always contains exactly `N - 1` edges.

Additional loop edges never connect non-adjacent cells.

## Core output

The Core returns plain JSON-compatible data:

- algorithm/version;
- Seed/options;
- coarse-grid bounds;
- selected cells;
- Rooms;
- maze-tree edges;
- optional loop edges;
- final edge set;
- diagnostics.

Diagnostics include:

- Room count;
- tree-edge count;
- loop candidate/selected counts;
- cycle rank;
- dead-end count;
- maze-tree diameter length.

There are no DOM, Three.js, Editor, Play, network, or provider dependencies.

## Dungeon Architect AI adapter

The adapter uses Generator V1 only as the accepted DesignIntent-to-content-count baseline.

It replaces only spatial Rooms/Corridors with the Rooms + Mazes Core output.

The existing baseline keeps:

- Enemy/Treasure/Trap/Recovery counts;
- Start/Goal semantic placement by Room ID;
- existing generated Event content where still valid.

Every maze edge is between adjacent grid cells, so the adapter emits exact cardinal endpoint hints:

- east ↔ west;
- north ↔ south.

Tree edges map to `backbone`; loop edges map to `alternate`.

The finished output must pass `validateDungeonSpec()`.

## Determinism

The same Seed and options produce byte-stable Core output.

Different Seeds alter selected grid cells, Room sizes, maze-tree structure, or loop selection.

The Core uses independent seeded streams for:

- cell selection;
- maze carving;
- Room dimensions;
- loop selection.

## Product behavior

The strategy is exposed in the Generator selector as:

**Algorithm Lab — Rooms + Mazes**

Capabilities:

- DesignIntent;
- direct parameters;
- multi-floor;
- Room graph output;
- deterministic generation.

Version 2 remains Recommended/default.

## Acceptance

Core:

`npm run test:generator-rooms-mazes`

150-case renderer matrix:

`npm run validate:dai-100-rooms-mazes-matrix`

Visible Chrome multi-floor Test + Mystery:

`npm run smoke:dai-100-rooms-mazes`

Integrated gate:

`npm run validate:dai-100-rooms-mazes`

The integrated gate includes Core tests, Generator adapter regressions, the 150-case routeability matrix, production build, Owner UI, strategy-selector regression, three-Floor Test/Mystery browser smoke, syntax validation, and git diff checks.
