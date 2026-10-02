# Algorithm Lab — Random Walk

## Status

DAI-100 implementation candidate.

Strategy ID:

`algorithm-lab.random-walk`

Reusable Core:

`packages/generator-algorithms/random-walk/`

Dungeon Architect AI adapter:

`packages/generator/src/strategies/random-walk-lab.js`

Version 2 remains the Recommended/default generator.

## Purpose

Random Walk adapts a drunkard-walk style constructive generator to Dungeon Architect AI without discarding the project's Room-graph architecture.

The walker discovers coarse-grid cells over time. First discovery of each new cell creates one tree edge from the previously occupied cell. That discovery tree guarantees connectivity and becomes the backbone Room graph.

Visited cells that later become cardinally adjacent but were not part of the discovery tree form deterministic loop candidates.

## Core inputs

The Core accepts plain JSON-compatible values:

- `seed`: non-negative safe integer;
- `roomCount`: 3–64;
- `extraConnectionRatio`: 0–1;
- `roomSizeMin`;
- `roomSizeMax`;
- `cellSpacing`;
- `directionPersistence`: 0–0.95;
- `escapeAfter`: 8–512.

Default direction persistence is 0.58, producing longer runs without making the walk effectively straight.

If the walker spends too long revisiting known cells, it deterministically relocates to a discovered frontier cell with at least one unvisited neighbor. This prevents pathological non-termination while preserving Seed reproducibility.

## Algorithm

1. Start the walker at coarse-grid origin.
2. Select cardinal directions with seeded directional persistence.
3. Record each newly visited cell.
4. On first discovery, add a parent→child discovery edge.
5. Continue until exactly `roomCount` unique cells exist.
6. If revisits exceed `escapeAfter`, choose a seeded frontier recovery point.
7. Find the discovery-tree diameter.
8. Remap the two diameter endpoints to first/last Room IDs for Start/Goal distance.
9. Convert visited cells into non-overlapping Room rectangles.
10. Collect unused cardinal adjacencies among visited cells.
11. Add a deterministic subset as loops according to `extraConnectionRatio`.

## Output invariants

- exactly N unique Rooms;
- exactly N−1 discovery-tree edges;
- connected Room graph;
- no self or duplicate edges;
- every edge joins cardinally adjacent cells;
- non-overlapping default Room geometry;
- deterministic Seed behavior;
- plain JSON-compatible Core output.

Diagnostics include:

- total walk steps;
- revisit count;
- frontier escape count;
- tree-edge count;
- discovery-tree diameter;
- loop candidate/selected counts;
- cycle rank;
- dead-end count.

## Dungeon Architect AI adapter

The Product Adapter reuses Generator V1 only for accepted DesignIntent-to-content semantics.

Random Walk replaces spatial Rooms/Corridors while preserving:

- Start/Goal semantics by Room ID;
- Enemy/Treasure/Trap/Recovery counts;
- generated Event content where valid.

Discovery edges become `backbone`; added adjacency loops become `alternate`.

Every Corridor receives exact cardinal endpoint-side hints.

The resulting DungeonSpec must pass `validateDungeonSpec()`.

## Difference from Rooms + Mazes

Rooms + Mazes first chooses a connected cell set and then carves a perfect maze over its adjacency graph.

Random Walk instead lets the walker trajectory itself decide which cells exist and uses first-discovery parent edges as the spanning tree.

The two algorithms therefore differ in both spatial footprint and topology source even when they share a coarse-grid representation.

## Acceptance

Core:

`npm run test:generator-random-walk`

150-case renderer matrix:

`npm run validate:dai-100-random-walk-matrix`

Visible Chrome multi-floor Test + Mystery:

`npm run smoke:dai-100-random-walk`

Integrated gate:

`npm run validate:dai-100-random-walk`

The integrated gate includes Core tests, Generator Adapter regressions, the 150-case routeability matrix, production build, Owner UI, six-strategy selector regression, three-Floor Test/Mystery browser smoke, syntax validation, and git diff checks.
