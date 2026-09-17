# DAI-063 Observable Intent-Fit Scoring

## Status

**IN PROGRESS.** Deterministic partial DesignIntent scoring is implemented and awaits production Node evidence.

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

Expected observable profile:

- fairness = `1`
- tension = `0.125`
- exploration = `0.611111`
- routeChoice = `0.933333`
- learnability = `1`
- combatDensity = `0.166667`
- trapDensity = `0.166667`
- rewardDensity = `0.166667`
- backtracking = `0`

A matched intent uses those exact scored-axis values and must produce `observableFitScore = 1`.

An opposed intent mirrors those values around `0.5` and must score materially lower (`< 0.4`).

Validation also verifies:

- unscored axes carry explicit reason codes;
- target duration remains unscored rather than converting abstract steps into seconds;
- invalid DesignIntent is rejected before scoring;
- fresh recomputation is deterministic;
- source Spec, aggregate metrics, and intent inputs remain unchanged.

## Required production validation

```powershell
git fetch origin; git switch feat/dai-063-intent-fit; git pull --ff-only origin feat/dai-063-intent-fit; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-063-validation.ps1
```

Expected evidence:

`artifacts/intent-fit/dai-063-intent-fit.json`

## Completion gate

Do not mark DAI-063 DONE until the complete production Node suite passes and the generated evidence satisfies every invariant above.

## Explicit non-goals

- no user-facing natural-language explanation yet (DAI-064);
- no human-behavior claim;
- no calibrated real-time duration estimate;
- no score for unsupported axes;
- no browser scoring dashboard.
