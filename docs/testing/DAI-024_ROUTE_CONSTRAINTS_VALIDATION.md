# DAI-024 Multiple-Route Constraints Validation

## Status

**IN PROGRESS.**

DAI-024 tightens the generator's structural meaning of `routeChoice` without adding risk/reward semantics or simulation scoring.

## Structural contract

For the current production generator revision:

- `routeChoice` is normalized to `[0, 1]`;
- alternate-route capacity is `max(1, floor(roomCount / 3))`;
- target alternate edges are `round(routeChoice * capacity)`;
- the exact target must be produced for every supported room count (`3..64`);
- alternate edges must reconnect existing backbone rooms;
- alternate edges must skip at least one backbone room;
- alternate span is limited to 2–4 backbone steps;
- no duplicate alternate edge is allowed;
- each alternate adds one independent cycle to the connected graph;
- routeChoice `0` retains only the single guaranteed backbone;
- any positive target creates multiple Start→Goal route choices;
- for fixed Seed + roomCount, increasing routeChoice preserves the lower-choice alternate set as a deterministic prefix.

The prefix rule prevents a small routeChoice adjustment from completely reshuffling previously generated alternate routes.

## Implementation

`packages/generator/src/room-graph.js` now exposes:

- `getAlternateRouteCapacity(roomCount)`
- `getAlternateRouteTarget(roomCount, routeChoice)`
- `analyzeRoomGraphRoutes(graph)`
- `generateRoomGraph(...)`

Alternate candidates are enumerated from valid 2–4 step backbone jumps, deterministically shuffled from Seed, then consumed as a prefix up to the exact target count.

## Test coverage

`packages/generator/test/generator.test.js` verifies:

- exact target mapping for routeChoice 0 / 0.25 / 0.5 / 0.75 / 1;
- deterministic prefix monotonicity as routeChoice increases;
- bounded 2–4 step alternate spans;
- no duplicate edges;
- cycle rank equals alternate edge count;
- routeChoice 0 has no alternate route;
- a positive target creates multiple route choices;
- maximum routeChoice reaches exact capacity for every supported room count 3..64;
- existing Seed determinism and generated DungeonSpec validity still pass.

## Production matrix

The one-command validation also runs:

`scripts/run-dai-024-route-matrix.mjs`

Matrix dimensions:

- Seeds: `0, 1, 2, 42, 777, 18342`
- Room counts: `3, 4, 5, 8, 12, 20, 32, 64`
- routeChoice: `0, 0.25, 0.5, 0.75, 1`
- total cases: 240

Each case checks:

- expected vs actual alternate count;
- graph cycle rank;
- edge uniqueness;
- valid rejoining alternate spans;
- multiple-route flag;
- monotonic prefix preservation against the preceding routeChoice level.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-024-route-constraints; git pull --ff-only origin feat/dai-024-route-constraints; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-024-validation.ps1
```

The runner verifies the audited `package-lock.json`, performs `npm ci --ignore-scripts`, runs the full production Node test suite, then executes the 240-case route matrix.

Expected evidence:

`artifacts/route-matrix/dai-024-route-matrix.json`

## Completion gate

Do not mark DAI-024 DONE until:

- the complete production Node test suite passes;
- the 240-case route matrix reports zero failures;
- generated evidence is reviewed.

## Explicit non-goals

DAI-024 does not decide:

- which alternate route is safer or more dangerous;
- reward/trap/enemy placement;
- dead-end reward semantics;
- route quality scoring;
- agent route diversity metrics;
- DesignIntent fit beyond the structural `routeChoice` mapping.

Those belong to later gameplay/simulation/intent-scoring tasks.
