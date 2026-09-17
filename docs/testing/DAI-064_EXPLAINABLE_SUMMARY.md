# DAI-064 Explainable Summary

## Status

**IN PROGRESS.** Deterministic structured/text explanation is implemented and awaits production Node evidence.

## Boundary

DAI-064 explains a successful DAI-063 Intent Fit v1 score without inventing new measurements or upgrading proxy confidence.

The summary is renderer-independent and LLM-free. It exposes:

- the DAI-063 observable fit score;
- exact coverage;
- every scored axis with target, observed value, delta, fit, confidence, and evidence basis;
- closest observable matches;
- largest non-zero observable gaps;
- every unscored axis with its reason;
- the target-duration limitation;
- explicit interpretation caveats.

See `spec/simulation/EXPLAINABLE_SUMMARY_V1.md` for the contract.

## Production evidence scenario

The evidence runner reuses the DAI-061 contrast fixture and the DAI-062/063 stack.

### Matched intent

The exact observable profile must preserve:

- `observableFitScore = 1`;
- 9/13 normalized-axis coverage;
- 5/6 core-axis coverage;
- 4/7 supporting-axis coverage;
- no non-zero largest-gap entries;
- explicit unscored `greedPunishment`, `deception`, `telegraphStrength`, and `targetDifficulty`;
- explicit unscored target duration.

### Opposed intent

The frozen opposed profile must preserve `observableFitScore = 0.240124` and surface the three largest deltas in deterministic order:

1. `fairness` — observed `1.0` above target `0.0` by `1.0`;
2. `learnability` — observed `1.0` above target `0.0` by `1.0`;
3. `backtracking` — observed `0.0` below target `1.0` by `1.0`.

### Safety / integrity gates

Validation also verifies:

- confidence and evidence-basis metadata are preserved;
- the rendered text includes the 9/13 coverage limitation;
- the rendered text states that the result is not a fun/accessibility/final-quality judgment;
- malformed DAI-063 scores fail closed;
- fresh summary generation is deterministic;
- input DAI-063 score objects remain unchanged.

## Required production validation

```powershell
git fetch origin; git switch feat/dai-064-explainable-summary; git pull --ff-only origin feat/dai-064-explainable-summary; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-064-validation.ps1
```

Expected evidence:

`artifacts/explainable-summary/dai-064-explainable-summary.json`

## Completion gate

Do not mark DAI-064 DONE until the complete production Node suite passes and every DAI-064 evidence invariant is true.

## Explicit non-goals

- no browser simulation/results dashboard;
- no LLM-written explanation;
- no human-behavior calibration;
- no attempt to score unsupported axes;
- no conversion from simulation steps to realtime duration;
- no fun/accessibility/final-quality verdict.
