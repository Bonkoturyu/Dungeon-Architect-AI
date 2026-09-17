# DAI-062 Simulation Metrics

## Status

**IN PROGRESS.** Cross-agent simulation metrics are implemented and await production Node evidence.

DAI-062 measures observed simulation behavior from DAI-060/061 without assigning DesignIntent quality scores yet.

## Implementation

`packages/simulation-core/src/metrics.js` provides two deterministic boundaries:

- `projectSimulationMetrics(authoringSpec, simulation)` for one completed run;
- `aggregateSimulationMetrics(authoringSpec, simulations)` for a multi-policy suite.

The implementation records success/failure, route/move/interaction counters, shortest-route detour, route stretch, backtracking, dead-end traversal cost, hazard exposure, treasure/trap/enemy rates, damage/healing/deaths, room coverage, route diversity, and failure concentration.

See `spec/simulation/METRICS_V1.md` for exact definitions.

## Production evidence scenario

The evidence runner reuses the DAI-061 `agent-contrast-v1` fixture and actual simulation results from:

- `shortest-path`;
- `treasure-greedy`;
- `cautious`.

Expected aggregate properties include:

- all three built-in agents clear;
- mean policy steps = `3`;
- mean gameplay moves = `2.666667`;
- three unique routes;
- mean pairwise route-edge Jaccard distance = `0.933333`;
- union room coverage = `1.0`;
- shortest-path enters the hazardous room once;
- treasure-greedy captures the authored treasure;
- cautious has zero hazardous-room entries;
- built-in routes contain no backtracking.

A fourth real simulation (`stop-immediately`) is added only to verify failure metrics. The four-run aggregate must report:

- success rate `0.75`;
- one `stopped` failure;
- failure concentration `1.0`.

The entire aggregate is recomputed from fresh built-in runs to verify deterministic equality, and the source DungeonSpec must remain unchanged.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-062-metrics; git pull --ff-only origin feat/dai-062-metrics; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-062-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` hash;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node suite, including DAI-062 unit tests;
4. runs the deterministic metrics evidence scenario;
5. writes `artifacts/metrics/dai-062-metrics.json`.

## Completion gate

Do not mark DAI-062 DONE until:

- complete production Node tests pass;
- built-in agent success and expected metric values pass;
- route diversity and room coverage match the fixed fixture;
- failure-rate/concentration probe passes using a real stopped simulation;
- deterministic recomputation matches;
- source Spec remains unchanged;
- generated JSON evidence is reviewed.

## Explicit non-goals

DAI-062 does not:

- score DesignIntent fit (DAI-063);
- decide whether a metric value is good or bad by itself;
- generate the explainable user-facing summary (DAI-064);
- model stochastic/human behavior;
- add a browser simulation dashboard.
