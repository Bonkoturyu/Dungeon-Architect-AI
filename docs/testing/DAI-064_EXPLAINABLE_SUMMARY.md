# DAI-064 Explainable Summary

## Status

**DONE.** Production Node evidence passed on 2026-09-17.

Reviewed evidence:

- generated: `2026-09-17T11:20:05.786Z`;
- Node.js: `v24.15.0`;
- JSON SHA-256: `8c4f2e94b5f24f55da069d412ed468611481dbe54441a917f572af61a8b0e1b8`;
- `passed = true`;
- all 13 DAI-064 evidence checks passed;
- matched observable fit remained `1.0`;
- coverage remained 9/13 normalized axes, 5/6 core axes, and 4/7 supporting axes;
- matched summary contained no non-zero largest-gap entries;
- all unsupported axes and target duration remained explicitly unscored;
- opposed observable fit remained `0.240124`;
- opposed largest gaps were `fairness`, `learnability`, and `backtracking`, each with absolute delta `1.0`;
- above/below-target directions matched the frozen expectations;
- confidence and evidence-basis metadata were preserved;
- rendered text included the partial-coverage and interpretation boundaries;
- malformed score input failed closed as `EXPLAINABLE_SUMMARY_INVALID_SCORE`;
- fresh summary generation matched deterministically;
- input DAI-063 score objects remained unchanged.

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

The exact observable profile preserved:

- `observableFitScore = 1`;
- 9/13 normalized-axis coverage;
- 5/6 core-axis coverage;
- 4/7 supporting-axis coverage;
- no non-zero largest-gap entries;
- explicit unscored `greedPunishment`, `deception`, `telegraphStrength`, and `targetDifficulty`;
- explicit unscored target duration.

The rendered summary states that the score applies only to scored axes, that duration is unscored, and that the result is not a judgment of fun, accessibility, or final design quality.

### Opposed intent

The frozen opposed profile preserved `observableFitScore = 0.240124` and surfaced the three largest deltas in deterministic order:

1. `fairness` — observed `1.0` above target `0.0` by `1.0`;
2. `learnability` — observed `1.0` above target `0.0` by `1.0`;
3. `backtracking` — observed `0.0` below target `1.0` by `1.0`.

### Safety / integrity gates

Validation also verified:

- confidence and evidence-basis metadata are preserved;
- the rendered text includes the 9/13 coverage limitation;
- the rendered text states that the result is not a fun/accessibility/final-quality judgment;
- malformed DAI-063 scores fail closed;
- fresh summary generation is deterministic;
- input DAI-063 score objects remain unchanged.

## Explicit non-goals

- no browser simulation/results dashboard;
- no LLM-written explanation;
- no human-behavior calibration;
- no attempt to score unsupported axes;
- no conversion from simulation steps to realtime duration;
- no fun/accessibility/final-quality verdict.
