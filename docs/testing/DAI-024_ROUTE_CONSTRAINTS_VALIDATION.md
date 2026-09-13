# DAI-024 Multiple-Route Constraints Validation

## Status

**DONE — production Windows/Node validation passed on 2026-09-13.**

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

`packages/generator/src/room-graph.js` exposes:

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

The one-command validation ran:

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

## Production evidence

Reviewed raw evidence:

- file: `dai-024-route-matrix.json`
- generated at: `2026-09-13T04:52:58.841Z`
- Node.js: `v24.15.0`
- SHA-256: `89f00b9e81f16edfdbb1b65e9b0fdcb029de309afe0431fa80c4d0e2a1efd9e7`
- cases: 240
- passed: `true`
- failures: 0

Independent review of all 240 rows confirmed:

- expected alternate count equals actual alternate count in every case;
- cycle rank equals alternate-edge count in every case;
- all edges are unique;
- every alternate rejoins the backbone and spans only 2–4 backbone steps;
- the Start→Goal multiple-route flag matches whether alternate edges exist;
- increasing routeChoice preserves the lower-choice alternate prefix;
- no matrix row violates the structural contract.

## Completion gate result

DAI-024 acceptance conditions are satisfied:

- the complete production validation command passed;
- the 240-case route matrix reports zero failures;
- generated evidence has been reviewed;
- deterministic multi-route generation remains renderer-independent;
- no gameplay-semantic claim is inferred from structural route count alone.

## Explicit non-goals

DAI-024 does not decide:

- which alternate route is safer or more dangerous;
- reward/trap/enemy placement;
- dead-end reward semantics;
- route quality scoring;
- agent route diversity metrics;
- DesignIntent fit beyond the structural `routeChoice` mapping.

Those belong to later gameplay/simulation/intent-scoring tasks.
