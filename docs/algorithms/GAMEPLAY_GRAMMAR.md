# Algorithm Lab — Gameplay Graph / Grammar

## Status

DAI-100 implementation candidate.

Strategy ID:

`algorithm-lab.gameplay-grammar`

Reusable Core:

`packages/generator-algorithms/gameplay-grammar/`

Dungeon Architect AI adapter:

`packages/generator/src/strategies/gameplay-grammar-lab.js`

Version 2 remains the Recommended/default generator.

## Purpose

Gameplay Graph / Grammar generates **semantic progression before geometry**.

Instead of placing Rooms first and assigning content afterward, the reusable Core expands a gameplay grammar into:

- a critical progression spine;
- semantic Room roles;
- optional dead-end detours;
- optional bypass loops;
- a derivation trace explaining which grammar rules were applied.

The resulting semantic graph is then embedded into cardinal Room geometry.

## Core inputs

The Core accepts plain JSON-compatible values:

- `seed`;
- `roomCount`: 3–64;
- `routeChoice`: 0–1;
- `exploration`: 0–1;
- `combatWeight`: 0–1;
- `hazardWeight`: 0–1;
- `rewardWeight`: 0–1;
- `deceptionWeight`: 0–1;
- `recoveryWeight`: 0–1;
- Room size and cell-spacing bounds.

## Grammar

The root rule is:

`MISSION → SPINE`

The spine always contains:

- Start;
- semantic interior roles;
- a Climax node;
- Goal.

Interior roles are selected deterministically from weighted gameplay roles:

- `challenge`;
- `hazard`;
- `reward`;
- `recovery`;
- `traversal`.

Exploration controls how many non-spine nodes are available.

Route choice controls how many available detours become rejoining bypasses rather than dead ends.

### Bypass production

A bypass is embedded as a two-node cardinal rectangle:

`spine A → detour node → detour node → spine B`

Each bypass adds exactly one graph cycle.

Therefore:

- base tree edges = `RoomCount - 1`;
- total edge count = `RoomCount - 1 + bypassBranchCount`;
- cycle rank = `bypassBranchCount`.

### Dead-end production

Unused branch capacity becomes one- or two-node semantic dead ends attached directly to the spine.

Templates include:

- challenge → reward;
- reward → hazard;
- traversal → recovery;
- weighted single-role detours.

## Semantic embedding

Every grammar node carries:

- role;
- source production;
- logical cell;
- optional branch/anchor metadata.

The geometry embedding guarantees unique cells and cardinal edges only.

Room rectangles use deterministic seeded size variation.

## Dungeon Architect AI adapter

The accepted Generator V1 implementation is used only as the source of:

- Room count profile;
- Entity counts;
- existing Entity decoration;
- existing entity-referenced Event content.

Unlike the previous spatial Algorithm Lab strategies, the Gameplay Grammar Adapter **reassigns Entity roomIds by semantic role**:

- Start → `start`;
- Goal → `goal`;
- Enemy → challenge/climax/hazard priority;
- Treasure → reward-first priority;
- Trap → hazard-first priority;
- Recovery → recovery-first priority.

Entity IDs remain unchanged, so existing Event entity references remain valid.

The resulting DungeonSpec passes the authoritative validator.

## Derivation evidence

The Core returns an explicit derivation array, for example:

- `MISSION→SPINE`;
- `CHOICE→BYPASS(2)`;
- `CHOICE→DEAD_END(1)`;
- `CHOICE→DEAD_END(2)`.

This makes the generated topology inspectable as a gameplay grammar rather than an opaque layout.

## Difference from spatial generators

BSP, Delaunay, Random Walk, Cellular Automata, Rooms + Mazes, and Maze Carving primarily decide spatial or topological structure first.

Gameplay Grammar instead decides **gameplay progression roles and choices first**, then embeds that graph into space.

That matches the long-term architecture:

`DesignIntent → Gameplay Graph → Room Graph → Spatial Layout → DungeonSpec → Simulation`

## Acceptance

Core:

`npm run test:generator-gameplay-grammar`

150-case renderer/topology matrix:

`npm run validate:dai-100-gameplay-grammar-matrix`

Visible Chrome multi-floor Test + Mystery:

`npm run smoke:dai-100-gameplay-grammar`

Integrated gate:

`npm run validate:dai-100-gameplay-grammar`

The integrated gate includes Core tests, Generator Adapter regressions, 150 Seed × RoomCount × routeChoice cases, production build, Owner UI, nine-strategy selector regression, three-Floor Test/Mystery browser smoke, syntax validation, and git diff checks.
