# DAI-080 Public Documentation

## Status

**DONE.** Public submission documentation passed deterministic production validation on 2026-09-18.

## Purpose

DAI-080 prepares the repository text that can be safely exposed to judges without overstating the implementation.

The documentation must distinguish:

1. the final product target;
2. the current integrated browser behavior;
3. separately production-tested backend/core capabilities;
4. remaining submission blockers.

## Public-doc set

- root `README.md`;
- `docs/submission/JUDGE_QUICKSTART.md`;
- `docs/submission/KNOWN_LIMITATIONS.md`;
- `docs/submission/SAMPLE_PROMPTS.md`;
- `docs/submission/CHECKLIST.md`;
- `docs/submission/DEMO_STORYBOARD.md`.

## Required truthfulness boundary

The current editor/play surface must **not** claim that initial full-dungeon DESCRIBE → GENERATE is already exposed.

The docs must instead state that:

- DesignIntent and procedural generator layers exist and are tested;
- current integrated browser flow starts from a valid sample;
- manual editing, constrained natural-language edit, validation, START, Play, Result are integrated;
- full first-generation UI wiring remains a submission blocker.

## DAI-080 audit gates

The deterministic audit verifies:

- every required public document exists;
- README contains the current-vs-target flow distinction;
- README links judge guide, limitations, prompts, privacy, legal registers, ADRs and submission checklist;
- README names desktop Chrome as the supported judging target;
- README does not claim the hosted URL or public repository switch is already complete;
- judge guide includes the verified natural-language edit prompt;
- known limitations include generation UI, mobile, Perspective/Combat, browser, persistence and deployment boundaries;
- sample prompts distinguish current integrated edit from backend DesignIntent corpus;
- submission checklist marks completed compliance/docs items but leaves Public repository / Hosted demo / Video / Description / Focus category unchecked;
- demo storyboard is blocked from final recording until the initial generation surface is integrated;
- local Markdown links in the public-doc set resolve to tracked files;
- no `TODO` / `TBD` placeholder is left in the public-doc set.

Expected evidence:

`artifacts/public-docs/dai-080-public-docs.json`

## Repository visibility boundary

GitHub repository visibility is still private during candidate assembly. DAI-080 does not silently change repository visibility.

The Public repository submission checklist item remains open until the user explicitly performs/authorizes that publication step.

## Production evidence

Reviewed evidence generated at `2026-09-18T10:07:02.794Z` with Node.js `v24.15.0`.

- evidence JSON SHA-256: `2b5cd4665b7b222d7ded9e7fb077cc64ee835603218c7354acf7862a666feb50`;
- `passed = true`;
- all 14 public-document checks passed;
- all required public documents exist;
- README truthfully separates the current integrated sample-based flow from the final DESCRIBE → GENERATE target;
- README does not claim the initial generation UI is integrated;
- Judge Quick Start / Known Limitations / Sample Prompts are consistent with current verified behavior;
- completed compliance/docs checklist items are checked while Public repo / Hosted demo / Video / Description / Focus category remain open;
- local Markdown links all resolve;
- no TODO/TBD placeholders remain in the public-doc set;
- DAI-080 did not change repository visibility, claim a hosted URL, or claim the generation UI is complete.

## Completion boundary

DAI-080 may be marked DONE when the documentation audit passes. This does not mark the overall submission candidate complete and does not close DAI-081–084.
