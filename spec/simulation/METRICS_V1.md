# Simulation Metrics v1

DAI-062 converts completed simulation runs into deterministic, renderer-independent measurements. These metrics describe observed runtime behavior only. They are not themselves DesignIntent scores and they are not claims about human players.

## Per-run metrics

Each completed simulation is projected into a stable metrics record containing:

- `policyId`, terminal `status`, `failureReason`, and `terminationReason`;
- `steps` and gameplay `moves`;
- `routeRoomIds` and `roomsVisited`;
- interaction/gameplay counters already emitted by Play Core;
- `baselineShortestMoves`: minimum Start-to-Goal move count over initially enabled corridors;
- `detourMoves`: `max(0, moves - baselineShortestMoves)`;
- `routeStretch`: `moves / baselineShortestMoves` when the baseline is defined;
- `backtrackMoves`: movement steps whose destination room was already visited earlier in the run;
- `deadEndCostMoves`: for each revisit, the number of route moves since the previous occurrence of that destination, summed over the run;
- `revisitRate`: `backtrackMoves / moves`;
- `visitedRoomFraction`: unique visited rooms divided by total rooms;
- `hazardRoomEntries`: entries into rooms containing an Enemy or Trap in the authoring Spec;
- `treasureCaptureRate`: opened treasures divided by authored treasures;
- `trapTriggerRate`: triggered traps divided by authored traps;
- `enemyClearRate`: cleared enemies divided by authored enemies;
- damage/healing/death counters from Play Core.

The structural shortest-path baseline deliberately uses only corridors that are initially enabled. Dynamic shortcut/event effects remain visible in the actual route and runtime counters but are not silently folded into the baseline.

## Cross-run aggregate

`aggregateSimulationMetrics()` emits:

- run/success/failure counts and rates;
- failure-reason counts;
- `failureConcentration`: the largest single failure-reason count divided by all failures, or `null` when there are no failures;
- `roomCoverageRate`: union of rooms visited by all runs divided by authored rooms;
- arithmetic means of the numeric per-run metrics;
- the full deterministic per-run projections;
- route diversity.

## Route diversity

Route diversity is based on undirected traversed corridor edges rather than room-count difference alone.

For every pair of runs:

1. convert each route into a set of undirected room-to-room edges;
2. compute Jaccard distance: `1 - intersection / union`;
3. report pair count, mean, minimum, and maximum distance.

The aggregate also records `uniqueRouteCount` using exact room-sequence identity.

A value near `0` means the compared policies traverse mostly the same edges. A value near `1` means their routes have little or no edge overlap.

## Determinism

Metrics contain no RNG and must not mutate the DungeonSpec or simulation objects. Identical Spec + identical simulation objects must produce byte-equivalent JSON after normal serialization.

## Boundary with later M6 tasks

DAI-062 only measures behavior.

- DAI-063 maps these measurements to DesignIntent fit.
- DAI-064 explains the measured and scored result to the user.

No DAI-062 metric is an implicit quality verdict by itself.
