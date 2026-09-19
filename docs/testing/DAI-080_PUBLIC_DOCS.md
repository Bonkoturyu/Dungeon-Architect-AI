# DAI-080 Public Documentation

## Status

**DONE.** The DAI-083 metadata status revalidation passed on 2026-09-19.

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

## Current truthfulness boundary after DAI-081

The public docs may now claim the verified hosted flow:

`DESCRIBE → GENERATE → EDIT → VALIDATE → START → PLAY → RESULT`.

They must still state the bounded DesignIntent→DungeonSpec semantics, constrained natural-language edit vocabulary, desktop-only support scope, pending PCE Perspective/Combat decision, no persistence/accounts, and remaining submission packaging tasks.

## DAI-081-triggered re-audit

DAI-081 added the hosted Generate surface and live public URL, so the deterministic public-doc audit was updated. A fresh evidence JSON is required before the hosted-demo PR merges.

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

## DAI-081 post-integration evidence

Reviewed evidence generated at `2026-09-18T16:08:18.166Z` with Node.js `v24.15.0`.

- evidence JSON SHA-256: `ff1f8fbeee18ea8143ffc07bb7594461eaad1c90ebaa7cb0e125755fdee5bc1e`;
- `passed = true`;
- all 12 updated public-document checks passed;
- public docs exist;
- README truthfully claims the verified full hosted flow;
- desktop support scope and remaining submission tasks are explicit;
- Judge Quick Start matches the public Generate/Edit/Play flow;
- Known Limitations cover bounded generation, edit vocabulary, PCE, locomotion, mobile, persistence and packaging;
- sample prompts reflect the public E2E;
- checklist tracks the current candidate;
- storyboard is ready for DAI-082 after governance closure;
- all local Markdown links resolve;
- no TODO/TBD placeholders remain;
- hosted URL and generation UI may now be claimed complete, while repository visibility remains unchanged.

## DAI-082 status revalidation

DAI-082 changed submission-status claims only: the final video is now complete while Public repository / Description / Focus category / Candidate hash remain open. A fresh `npm run validate:public-docs` pass is required before PR #38 merges.

## DAI-082 completion revalidation

The final DAI-082 finalization command passed on 2026-09-19.

The refreshed public-doc audit confirmed:

- required public documents remain present;
- README now marks DAI-082 complete while keeping DAI-083/084 and repository publication open;
- Known Limitations no longer lists the video as pending;
- Submission Checklist marks the under-three-minute video complete;
- Demo Storyboard records the accepted 49.5-second corrected DAI-026 capture;
- local Markdown links resolve;
- placeholder findings are empty;
- hosted URL and generation UI remain truthfully claimed complete;
- repository visibility remains unchanged.

Evidence path produced by the accepted run:

`artifacts/public-docs/dai-080-public-docs.json`

This closes the DAI-082-triggered public-document status revalidation.

## DAI-083 metadata revalidation

The refreshed public-doc audit generated at `2026-09-19T07:20:44.676Z` passed all 12 checks after the short description and focus category were finalized.

- required public docs exist;
- README reflects finalized submission metadata;
- DAI-083 metadata doc is included in the public-doc set;
- checklist marks Short description and Focus category complete;
- Judge Quick Start / Known Limitations / Sample Prompts remain truthful;
- DAI-082 accepted storyboard remains intact;
- submission metadata finalization check passed;
- local Markdown links resolve;
- placeholder findings are empty;
- evidence JSON SHA-256: `c9dbc48df13f980fba8161fcff282716d797def70eabcd095c215d9f24f420d1`.

This closes the DAI-083-triggered public-document revalidation.

## Completion boundary

DAI-080 is DONE for the current candidate. This does not mark the overall submission candidate complete; DAI-083, DAI-084 and M9 remain open.
