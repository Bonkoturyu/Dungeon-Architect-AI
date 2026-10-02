# Algorithm Lab — Maze Carving

## Status

DAI-100 implementation candidate.

Strategy ID:

`algorithm-lab.maze-carving`

Reusable Core:

`packages/generator-algorithms/maze-carving/`

Dungeon Architect AI adapter:

`packages/generator/src/strategies/maze-carving-lab.js`

Version 2 remains the Recommended/default generator.

## Purpose

Maze Carving provides a deliberately controlled comparison against the more spatially organic Algorithm Lab strategies.

The Room footprint is a compact deterministic lattice derived only from requested Room count. The Seed controls which candidate walls are removed, not which lattice cells exist.

This isolates topology generation from footprint generation.

## Core inputs

The Core accepts plain JSON-compatible values:

- `seed`: non-negative safe integer;
- `roomCount`: 3–64;
- `extraConnectionRatio`: 0–1;
- `roomSizeMin`;
- `roomSizeMax`;
- `cellSpacing`.

Defaults:

- Room size: 7–9;
- cell spacing: 14.

## Compact lattice

For N requested Rooms:

1. choose `width = ceil(sqrt(N))`;
2. choose `height = ceil(N / width)`;
3. fill rows left-to-right until exactly N cells exist.

The partial final row remains left-aligned so every active cell stays on the same integer lattice and the footprint is always cardinally connected.

The same Room count therefore produces the same set of logical cells across Seeds.

## Randomized Kruskal carving

All cardinally adjacent cell pairs are treated as candidate walls.

The Core:

1. shuffles candidate walls using a Seed-specific PRNG stream;
2. initializes one disjoint set per Room cell;
3. walks the shuffled walls;
4. removes a wall only when it joins two previously disconnected components;
5. stops after exactly `N - 1` walls have been removed.

The result is a perfect maze / spanning tree.

## Start / Goal distance

The carved tree diameter is measured.

Its two endpoints are remapped to first/last Room IDs so the accepted baseline Start/Goal placement receives a long route through the carved maze.

## Route-choice loops

Walls not used by the perfect-maze tree become loop candidates.

DesignIntent `routeChoice` selects a deterministic prefix of a separately shuffled candidate list.

Tree edges become `backbone`; restored walls become `alternate`.

## Core output

The Core returns plain JSON-compatible data:

- algorithm/version;
- Seed/options;
- compact-grid dimensions;
- logical cells;
- Rooms;
- tree edges;
- extra loop edges;
- final graph;
- diagnostics.

Diagnostics include:

- candidate wall count;
- tree / carved wall count;
- remaining wall count;
- tree diameter;
- loop candidate / selected count;
- cycle rank;
- dead-end count.

There are no DOM, Three.js, Editor, Play, provider, or network dependencies.

## Dungeon Architect AI adapter

The accepted Generator V1 path remains the DesignIntent-to-content baseline.

Maze Carving replaces only Rooms/Corridors while preserving:

- Start/Goal semantics by Room ID;
- Enemy/Treasure/Trap/Recovery counts;
- generated Event content where valid.

Every Product Corridor is a cardinal lattice edge and receives exact endpoint-side hints.

The finished DungeonSpec must pass `validateDungeonSpec()`.

## Difference from Rooms + Mazes

Rooms + Mazes uses the Seed to choose an irregular connected cell footprint, then carves a DFS maze over that selected shape.

Maze Carving uses a fixed compact footprint for a given Room count and uses the Seed to shuffle wall-removal order through randomized Kruskal.

This separates footprint randomness from topology randomness.

## Acceptance

Core:

`npm run test:generator-maze-carving`

150-case renderer matrix:

`npm run validate:dai-100-maze-carving-matrix`

Visible Chrome multi-floor Test + Mystery:

`npm run smoke:dai-100-maze-carving`

Integrated gate:

`npm run validate:dai-100-maze-carving`

The integrated gate includes Core tests, Generator Adapter regressions, the 150-case routeability matrix, production build, Owner UI, eight-strategy selector regression, three-Floor Test/Mystery browser smoke, syntax validation, and git diff checks.
