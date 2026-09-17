# Intent Fit v1

## Purpose

Intent Fit v1 compares a validated `DesignIntent` with deterministic observations derived from the DAI-060/061/062 simulation stack.

It is intentionally **partial**. The score must not imply that every DesignIntent field is objectively measurable from the current simulator.

## Scoring rule

For every scored normalized axis:

`fit = 1 - abs(target - observed)`

where both `target` and `observed` are normalized to `0..1`.

The published `observableFitScore` is the unweighted mean of the scored-axis fits. Unscored axes do not silently receive neutral values and do not enter the mean.

Every result also publishes coverage so callers can distinguish a high score with partial observability from a complete measurement.

## Scored axes and proxies

| DesignIntent axis | Observed proxy | Confidence |
| --- | --- | --- |
| `fairness` | cross-agent `successRate` | low |
| `tension` | mean hazardous-room entries / mean gameplay moves | medium |
| `exploration` | mean visited-room fraction across policies | high |
| `routeChoice` | mean pairwise route-edge Jaccard distance | high |
| `learnability` | `1 - mean revisitRate` | medium |
| `combatDensity` | authored enemy count / room count | high |
| `trapDensity` | authored trap count / room count | high |
| `rewardDensity` | authored treasure count / room count | high |
| `backtracking` | mean revisit rate | high |

Density ratios are clamped to `0..1` for the normalized DesignIntent comparison.

## Explicitly unscored axes

Intent Fit v1 does not invent proxies for:

- `greedPunishment` — requires an observable consequence tied specifically to greedy/reward-taking behavior;
- `deception` — requires authored/runtime deception semantics;
- `telegraphStrength` — requires measurable warning/telegraph exposure and response semantics;
- `targetDifficulty` — deterministic structural probes are not yet a calibrated difficulty model.

`targetDuration` is also unscored because current simulator steps are abstract actions, not real-time seconds.

`instantDeathAllowed` remains an MVP safety constraint (`false`) rather than a fit dimension.

## Coverage

The result reports:

- scored normalized-axis count / 13 normalized axes;
- scored core-axis count / 6 core axes;
- scored supporting-axis count / 7 supporting axes;
- whether `targetDuration` was scored.

Current v1 coverage is 9/13 normalized axes, 5/6 core axes, 4/7 supporting axes, with duration unscored.

## Interpretation boundary

This score is a deterministic comparison between declared intent and current observable proxies. It is not a claim about human fun, psychological response, accessibility, or final design quality.

DAI-064 may explain the evidence behind the score, but must preserve this distinction and expose unscored areas rather than hiding them.
