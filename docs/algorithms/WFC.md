# Algorithm Lab — Wave Function Collapse (WFC)

## Status

DAI-100 implementation candidate.

Strategy ID:

`algorithm-lab.wfc`

Reusable Core:

`packages/generator-algorithms/wfc/`

Dungeon Architect AI adapter:

`packages/generator/src/strategies/wfc-lab.js`

Version 2 remains the Recommended/default generator.

## Why this is a hybrid WFC

WFC is strongest at local compatibility constraints but does not inherently guarantee a useful global Start→Goal structure.

Dungeon Architect AI therefore separates those concerns:

```text
global guaranteed backbone
→ local Room socket domains
→ minimum-entropy collapse
→ adjacency propagation
→ optional local connections
→ DungeonSpec
```

The Core still performs genuine Wave Function Collapse over local N/E/S/W socket patterns, while the required global backbone prevents local collapse from disconnecting Start and Goal.

## Tile state

Each Room cell is a WFC tile.

A tile is represented by a four-bit connection mask:

- North;
- East;
- South;
- West.

The 16 possible masks represent local module patterns such as:

- dead end;
- straight;
- turn;
- T-junction;
- cross.

Boundary filtering removes masks that point outside the active Room lattice.

Required backbone sockets are added as hard constraints before collapse.

## Core inputs

The Core accepts plain JSON-compatible values:

- `seed`: non-negative safe integer;
- `roomCount`: 3–64;
- `extraConnectionRatio`: 0–1;
- `roomSizeMin`;
- `roomSizeMax`;
- `cellSpacing`.

The same Seed + options must reproduce the same lattice transform, collapse order, tile masks, Rooms, and graph.

## Global lattice

The Core creates exactly N Room cells on a compact serpentine lattice.

The lattice may be rotated/reflected by Seed, but consecutive backbone cells always remain cardinally adjacent.

Every consecutive pair forms one mandatory backbone connection, producing exactly `N - 1` required edges from first Room to last Room.

## Wave Function Collapse process

1. Build the active-cell adjacency graph.
2. Derive each cell's available socket mask.
3. Derive each cell's required backbone socket mask.
4. Initialize the domain with every socket pattern satisfying available + required constraints.
5. Propagate hard socket compatibility.
6. Select one unresolved cell with minimum domain cardinality.
7. Resolve ties deterministically from the Seed.
8. Collapse that cell to one weighted tile.
9. Propagate socket equality to neighbors.
10. Repeat until every cell has exactly one tile.

Shared boundaries must agree:

```text
A.east == B.west
A.north == B.south
```

A contradiction is a cell with an empty domain.

The accepted candidate records contradictions in diagnostics and requires zero contradictions in validation.

## DesignIntent routeChoice

`extraConnectionRatio` is supplied from DesignIntent `routeChoice`.

Required backbone sockets are never removed.

Only optional sockets are weighted:

- 0.0 strongly collapses toward no optional edges;
- 1.0 strongly collapses toward every available optional adjacency;
- intermediate values probabilistically favor corresponding local connectivity.

At routeChoice 0, the final graph is only the Start→Goal backbone.

At routeChoice 1, every active-cell cardinal adjacency is open.

## Core output

The Core returns plain JSON-compatible data:

- algorithm/version;
- Seed/options;
- lattice transform;
- logical cells;
- collapsed tile masks and socket names;
- Rooms;
- backbone edges;
- extra edges;
- final graph;
- diagnostics.

Diagnostics include:

- Room count;
- tree edge count;
- active adjacency count;
- optional adjacency count;
- extra-edge count;
- cycle rank;
- collapse count;
- propagation revision count;
- contradiction count;
- tile histogram;
- entropy trace.

There are no DOM, Three.js, Editor, Play, provider, or network dependencies.

## Dungeon Architect AI adapter

The accepted Generator V1 path remains the DesignIntent-to-content baseline.

The WFC adapter replaces only spatial Rooms/Corridors while preserving:

- Start/Goal semantics by Room ID;
- Enemy/Treasure/Trap/Recovery counts;
- Entity IDs;
- Event references and gameplay semantics where valid.

Required WFC backbone edges map to `backbone`.

Optional collapsed edges map to `alternate`.

Every Product Corridor is a cardinal Room adjacency and receives exact endpoint-side hints.

The finished output must pass `validateDungeonSpec()`.

## Difference from other Algorithm Lab strategies

- Rooms + Mazes chooses an irregular footprint and carves a perfect maze.
- Maze Carving fixes the footprint and chooses a spanning tree through randomized Kruskal.
- Gameplay Grammar generates semantic topology first.
- WFC solves local module compatibility while a separately guaranteed global backbone preserves Start→Goal reachability.

This is intentionally aligned with the project's research conclusion that WFC is best used as a local constraint layer inside a hybrid generator.

## Acceptance

Core:

`npm run test:generator-wfc`

150-case renderer matrix:

`npm run validate:dai-100-wfc-matrix`

Visible Chrome multi-floor Test + Mystery:

`npm run smoke:dai-100-wfc`

Integrated gate:

`npm run validate:dai-100-wfc`

The integrated gate includes Core tests, Generator Adapter regressions, the 150-case routeability/WFC matrix, production build, Owner UI, ten-strategy selector regression, three-Floor Test/Mystery browser smoke, syntax validation, and git diff checks.
