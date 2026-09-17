# DAI-063 Observable Intent-Fit Scoring

## Status

**DONE.** Production Node evidence passed on 2026-09-17.

Reviewed evidence:

- generated: `2026-09-17T08:29:03.314Z`;
- Node.js: `v24.15.0`;
- JSON SHA-256: `550ac94890700410f55e4d6ea68408199db66892b5f7973f553c40aa3e101621`;
- `passed = true`;
- all 10 evidence checks passed;
- observable profile matched the frozen expected values;
- exact matched observable intent scored `1.0`;
- coverage = 9/13 normalized axes, 5/6 core axes, 4/7 supporting axes;
- opposed observable intent scored `0.240124`;
- unsupported axes remained explicitly unscored with stable reason codes;
- `targetDuration` remained unscored and was not inferred from abstract simulation steps;
- invalid DesignIntent failed closed as `INTENT_FIT_INVALID_INTENT`;
- fresh recomputation matched deterministically;
- source DungeonSpec remained unchanged.

## Boundary

DAI-063 compares validated `DesignIntent` targets against observable proxies from the DAI-060/061/062 simulation stack.

It intentionally does not fabricate measurements for axes that the current runtime cannot support.

Scored axes:

- fairness
- tension
- exploration
- routeChoice
- learnability
- combatDensity
- trapDensity
- rewardDensity
- backtracking

Explicitly unscored:

- greedPunishment
- deception
- telegraphStrength
- targetDifficulty
- targetDuration

See `spec/simulation/INTENT_FIT_V1.md` for exact formulas, proxy definitions, confidence labels, and coverage semantics.

## Scoring semantics

For every scored normalized axis:

`fit = 1 - abs(target - observed)`

`observableFitScore` is the unweighted mean over scored axes only. The result separately exposes 9/13 normalized-axis coverage, 5/6 core-axis coverage, 4/7 supporting-axis coverage, and `targetDurationScored=false`.

## Production evidence scenario

The runner uses the DAI-061 contrast fixture and DAI-062 aggregate metrics.

Observed profile:

- fairness = `1`
- tension = `0.125`
- exploration = `0.611111`
- routeChoice = `0.933333`
- learnability = `1`
- combatDensity = `0.166667`
- trapDensity = `0.166667`
- rewardDensity = `0.166667`
- backtracking = `0`

A matched intent using those exact scored-axis values produced `observableFitScore = 1`.

An opposed intent mirrored those values around `0.5` and produced `observableFitScore = 0.240124`, below the frozen `< 0.4` gate.

Validation also verified:

- unscored axes carry explicit reason codes;
- target duration remains unscored rather than converting abstract steps into seconds;
- invalid DesignIntent is rejected before scoring;
- fresh recomputation is deterministic;
- source Spec, aggregate metrics, and intent inputs remain unchanged.

## Explicit non-goals

- no user-facing natural-language explanation yet (DAI-064);
- no human-behavior claim;
- no calibrated real-time duration estimate;
- no score for unsupported axes;
- no browser scoring dashboard.
