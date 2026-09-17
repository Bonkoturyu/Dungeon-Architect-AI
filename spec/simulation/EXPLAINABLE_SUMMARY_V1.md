# Explainable Summary v1

## Purpose

Explainable Summary v1 turns a valid DAI-063 Intent Fit v1 score into deterministic, renderer-independent evidence that can be shown to a user without hiding partial observability or inventing unsupported conclusions.

The summary explains **what was measured, how far the observation is from the declared target, what evidence proxy was used, and what was not measured**.

It is not an additional scoring model and does not call an LLM.

## Input boundary

The input is the successful `score` object returned by DAI-063 `scoreIntentFit()`.

The summary builder fails closed if:

- the score schema version is unsupported;
- `observableFitScore` is outside `0..1`;
- coverage counts are malformed or disagree with the number of scored axes;
- a scored axis is missing target/observed/fit/confidence/basis evidence;
- an unscored axis is missing its reason code;
- target duration is not explicitly unscored.

## Per-axis explanation

Every scored axis exposes:

- `axis` and stable display `label`;
- `target`;
- `observed`;
- signed `delta = observed - target`;
- `absoluteDelta`;
- `direction`: `matched`, `above-target`, or `below-target`;
- DAI-063 `fit`;
- DAI-063 `confidence`;
- DAI-063 evidence `basis`;
- a deterministic plain-language statement.

The explanation must not replace a low-confidence proxy with stronger language than DAI-063 supports.

## Highlights

The summary publishes two bounded highlight lists. Their default size is three.

### Closest observable matches

Scored axes are sorted by:

1. fit descending;
2. original DAI-063 axis order as deterministic tie-break.

### Largest observable gaps

Only non-zero gaps are included. Scored axes are sorted by:

1. `absoluteDelta` descending;
2. original DAI-063 axis order as deterministic tie-break.

A perfectly matched scored profile therefore has an empty `largestGaps` list rather than fabricated criticism.

## Unscored evidence

Every DAI-063 unscored normalized axis remains explicit with:

- the requested target value;
- stable reason code;
- deterministic reason explanation.

Current v1 unscored normalized axes are:

- `greedPunishment`;
- `deception`;
- `telegraphStrength`;
- `targetDifficulty`.

`targetDuration` remains separately and explicitly unscored because simulator actions are not realtime seconds.

## Coverage

DAI-063 coverage is copied without reinterpretation. Current v1 evidence therefore states:

- 9/13 normalized axes scored;
- 5/6 core axes scored;
- 4/7 supporting axes scored;
- target duration unscored.

Unscored areas are not assigned neutral values and remain excluded from `observableFitScore`.

## Text rendering

`renderExplainableIntentSummaryText()` produces deterministic English text from the structured summary. The text contains:

1. observable fit score statement;
2. explicit coverage statement;
3. closest observable matches;
4. largest observable gaps, or an explicit statement that no non-zero gaps were measured;
5. unscored axes and reasons;
6. target-duration limitation;
7. interpretation boundary.

The structured summary remains the source of truth; the text is a rendering of that evidence.

## Interpretation boundary

Explainable Summary v1 must preserve the DAI-063 boundary:

- deterministic structural evidence is not calibrated human behavior;
- observable intent fit is not a judgment of fun;
- observable intent fit is not an accessibility judgment;
- observable intent fit is not a final design-quality verdict;
- unsupported axes and duration must remain visible.

## Determinism and immutability

Given the same valid DAI-063 score and options, structured and rendered summaries must be byte-equivalent after JSON/string serialization.

Summary generation must not mutate the DAI-063 score object.
