# Algorithm Lab — Cellular Automata

## Status

DAI-100 implementation candidate.

Strategy ID:

`algorithm-lab.cellular-automata`

Reusable Core:

`packages/generator-algorithms/cellular-automata/`

Dungeon Architect AI adapter:

`packages/generator/src/strategies/cellular-automata-lab.js`

Version 2 remains the Recommended/default generator.

## Purpose

Cellular Automata generates an irregular cave-like occupancy mask while preserving Dungeon Architect AI's Room-graph, Start→Goal, Simulator, Editor, and multi-floor contracts.

The Core does not expose a raw bitmap directly as DungeonSpec. Instead it converts the cave mask into a deterministic connected Room subset and graph.

## Core inputs

The Core accepts plain JSON-compatible values:

- `seed`: non-negative safe integer;
- `roomCount`: 3–64;
- `extraConnectionRatio`: 0–1;
- `roomSizeMin`;
- `roomSizeMax`;
- `cellSpacing`;
- `initialWallProbability`: 0.1–0.9;
- `smoothingIterations`: 0–8;
- `wallThreshold`: 1–8.

Defaults:

- initial wall probability: 0.45;
- smoothing passes: 4;
- wall threshold: 5;
- Room size: 7–9;
- cell spacing: 14.

## Algorithm

1. Build a bounded coarse grid sized from requested Room count.
2. Seed each interior cell as wall/floor using `initialWallProbability`.
3. Keep the outer border closed.
4. Run cellular smoothing using the eight-neighbor wall count.
5. Find all cardinally connected open-cell components.
6. Keep the largest component.
7. If it contains fewer cells than requested, deterministically carve adjacent walls until enough connected cells exist.
8. Select exactly `roomCount` cells through seeded connected frontier growth.
9. Use first-selection parent edges as a guaranteed spanning tree.
10. Find the tree diameter and remap its endpoints to first/last Room IDs.
11. Convert selected cells into non-overlapping Room rectangles.
12. Collect unused cardinal adjacencies among selected cells.
13. Add a deterministic subset as loops using DesignIntent `routeChoice`.

## Connectivity repair

Classical cave cellular automata can produce disconnected regions.

This implementation does not silently regenerate until it gets lucky. It records the largest connected component and, only when necessary, performs deterministic adjacent carving until at least the requested Room count is available.

Diagnostics expose the repair count.

## Core output

The Core returns plain JSON-compatible data:

- algorithm/version;
- Seed/options;
- final repaired open-cell mask;
- selected Room cells;
- Rooms;
- spanning-tree edges;
- optional loop edges;
- final graph;
- diagnostics.

Diagnostics include:

- initial open-cell count;
- smoothed open-cell count;
- component count;
- largest component size before repair;
- repair carve count;
- usable connected component size;
- tree edge/diameter metrics;
- loop candidate/selected counts;
- cycle rank;
- dead-end count.

There are no DOM, Three.js, Editor, Play, provider, or network dependencies.

## Dungeon Architect AI adapter

The accepted Generator V1 pipeline remains the DesignIntent-to-content baseline.

Cellular Automata replaces only Rooms/Corridors while preserving:

- Start/Goal semantics by Room ID;
- Enemy/Treasure/Trap/Recovery counts;
- generated Event content where valid.

Tree edges become `backbone`; selected adjacency loops become `alternate`.

Every Product Corridor is a local cardinal adjacency and receives exact endpoint-side hints.

The finished output must pass `validateDungeonSpec()`.

## Difference from Random Walk

Random Walk lets a walker trajectory decide which cells exist.

Cellular Automata first creates and smooths a whole cave mask, then extracts/repairs its connected region before selecting the Room graph.

The spatial control source is therefore materially different.

## Acceptance

Core:

`npm run test:generator-cellular-automata`

150-case renderer matrix:

`npm run validate:dai-100-cellular-automata-matrix`

Visible Chrome multi-floor Test + Mystery:

`npm run smoke:dai-100-cellular-automata`

Integrated gate:

`npm run validate:dai-100-cellular-automata`

The integrated gate includes Core tests, Generator Adapter regressions, the 150-case routeability matrix, production build, Owner UI, seven-strategy selector regression, three-Floor Test/Mystery browser smoke, syntax validation, and git diff checks.
