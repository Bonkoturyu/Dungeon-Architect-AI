# DAI-062 Simulation Metrics

## Status

**DONE.** Production Node evidence passed on 2026-09-17.

Reviewed evidence:

- generated: `2026-09-17T07:46:25.341Z`;
- JSON SHA-256: `0f787456ec5969770a0033b944ec5d1159883bddfee278e6643ad22361cb6acb`;
- `passed = true`;
- all built-in agents cleared;
- aggregate recomputation matched deterministically;
- mean policy steps = `3`;
- mean gameplay moves = `2.666667`;
- unique route count = `3`;
- mean pairwise route-edge Jaccard distance = `0.933333`;
- union room coverage = `1.0`;
- shortest-path hazard entries = `1`;
- treasure-greedy treasure capture rate = `1.0`;
- cautious hazard entries = `0`;
- built-in backtracking/dead-end cost = `0`;
- failure probe success rate = `0.75`, one `stopped` failure, failure concentration = `1.0`;
- source DungeonSpec unchanged.

DAI-062 measures observed simulation behavior from DAI-060/061 without assigning DesignIntent quality scores yet.

## Implementation

`packages/simulation-core/src/metrics.js` provides two deterministic boundaries:

- `projectSimulationMetrics(authoringSpec, simulation)` for one completed run;
- `aggregateSimulationMetrics(authoringSpec, simulations)` for a multi-policy suite.

The implementation records success/failure, route/move/interaction counters, shortest-route detour, route stretch, backtracking, dead-end traversal cost, hazard exposure, treasure/trap/enemy rates, damage/healing/deaths, room coverage, route diversity, and failure concentration.

See `spec/simulation/METRICS_V1.md` for exact definitions.

## Production evidence scenario

The evidence runner reused the DAI-061 `agent-contrast-v1` fixture and actual simulation results from:

- `shortest-path`;
- `treasure-greedy`;
- `cautious`.

Observed aggregate properties:

- all three built-in agents cleared;
- mean policy steps = `3`;
- mean gameplay moves = `2.666667`;
- three unique routes;
- mean pairwise route-edge Jaccard distance = `0.933333`;
- union room coverage = `1.0`;
- shortest-path entered the hazardous room once;
- treasure-greedy captured the authored treasure;
- cautious had zero hazardous-room entries;
- built-in routes contained no backtracking or dead-end traversal cost.

A fourth real simulation (`stop-immediately`) verified failure metrics:

- success rate `0.75`;
- one `stopped` failure;
- failure concentration `1.0`.

The entire aggregate was recomputed from fresh built-in runs to verify deterministic equality, and the source DungeonSpec remained unchanged.

## Explicit non-goals

DAI-062 does not:

- score DesignIntent fit (DAI-063);
- decide whether a metric value is good or bad by itself;
- generate the explainable user-facing summary (DAI-064);
- model stochastic/human behavior;
- add a browser simulation dashboard.
