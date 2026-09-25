# DAI-091 — Final Compliance

## Status

**IN PROGRESS.**

DAI-091 is the final pre-submission compliance gate for the refreshed Dungeon Architect AI candidate.

The runtime remains the frozen DAI-099 production candidate:

- candidate commit: `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3`
- candidate tree: `1ee24b750bec04a4488c94ca2e7cc54ec015530f`
- runtime-source SHA-256:
  `dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6`
- public demo: `https://dungeon-architect-ai.pages.dev/`
- rollback branch:
  `rollback/submission-candidate-dai-099-2026-09-24`

DAI-090 unexpected-prompt verification passed 20/20 cases without requiring a runtime fix.

## Official rule recheck — 2026-09-25

Primary official sources:

- Terms:
  https://www.victoriavr.com/hackathon/2026/terms
- Building Period article:
  https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3

The current official requirements still require:

- a public code repository;
- a hosted browser demo;
- a demo video under three minutes;
- a short written description;
- a selected focus category;
- any other materials requested by the Organizer;
- a browser-based project that turns plain language into 3D scenes and working logic;
- repository/demo availability throughout judging.

The Terms also explicitly state that judges may test submissions with their own prompts, which is the reason DAI-090 is a release gate.

Submission deadline recorded by the official Terms:

- 2026-11-11 16:30 CEST
- 2026-11-11 23:30 JST

## Current compliance state

Already accepted:

- refreshed production browser demo;
- exact runtime-source identity;
- 22/22 DAI-099 predeploy gates;
- refreshed production public E2E;
- legal/provenance audit;
- secret/privacy audit;
- submission metadata audit;
- 59.9-second final refreshed demo video;
- manual video review;
- DAI-099 freeze preparation;
- immutable DAI-099 rollback branch;
- DAI-090 unexpected-prompt regression 20/20;
- refreshed judge-facing README, Judge Quick Start, limitations, sample prompts, storyboard and checklist on this verification branch.

Still open:

1. GitHub repository visibility must be changed from Private to Public.
2. Final public-doc audit must be rerun on this branch.
3. DAI-091 final compliance audit must pass after public visibility is confirmed.
4. Check whether the Organizer has requested any additional submission materials since the current official Building Period article / Terms review.
5. DAI-092 must complete the actual submission before the deadline.

## Verification branch

`verify/dai-091-final-compliance-2026-09-25`

This branch is allowed to change only final public documentation and verification/audit material. It must not alter the production runtime.

## Local validation

First refresh generated evidence on this branch:

```powershell
npm run validate:legal-registers
npm run validate:secret-privacy
npm run validate:submission-metadata
npm run validate:public-docs
node scripts/run-dai-090-unexpected-prompt-regression.mjs
```

Then run:

```powershell
node scripts/run-dai-091-final-compliance.mjs
```

Before repository publication, the expected blocker is:

```text
repositoryPublic
```

After the repository is made public and all other checks remain green, DAI-091 must report:

```text
"passed": true
"falseChecks": []
```

## Repository publication boundary

Changing repository visibility is intentionally not automated by this branch.

Before switching to Public, manually confirm:

- no provider secret exists in tracked files or Git history;
- no private prompt/chat data is committed;
- no personal payment/bank data is committed;
- no unreviewed private asset exists in the repository;
- the latest secret/privacy audit passes.

The repository must remain public and accessible throughout judging once submitted.

## Final submission boundary

DAI-091 does not submit the hackathon entry. DAI-092 owns the actual submission form, final link verification, category/description entry, video link/upload, any newly requested materials, and final deadline confirmation.
