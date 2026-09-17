# DAI-070 First-Run Onboarding

## Status

**IN PROGRESS.** The deterministic first-run guide and visible-Chrome smoke harness are implemented; production validation is pending.

## Purpose

DAI-070 gives a judge a clear path through the currently verified browser workflow without implying that an unimplemented surface exists.

The guide is intentionally scoped to the editor/play experience that is already production-backed:

1. welcome / current demo boundary;
2. manual or natural-language edit;
3. validation and START gate;
4. play to Goal / Result.

The demo explicitly says that it opens with a valid sample dungeon. It does not claim that the current editor-slice screen performs the initial natural-language full-dungeon generation step.

## Implementation

`packages/onboarding/src/guide.js` owns the renderer/DOM-independent four-step guide state.

`apps/editor-slice/onboarding.js` binds that state to the browser surface and exposes `window.__DAI_ONBOARDING__` for production smoke evidence.

The editor adds:

- an automatically visible first-run guide;
- Back / Next / Done controls;
- Escape / close behavior;
- a persistent `Guide` button that reopens at the welcome step;
- no persistence that could accidentally hide the guide from a judge on a fresh page load.

## Production evidence contract

The visible-Chrome smoke must verify:

- the editor itself is ready, valid, and START-eligible;
- onboarding opens automatically at `welcome`;
- exactly four steps are exposed in the frozen order `welcome → edit → validate → play`;
- Back is disabled on the first step;
- Next moves deterministically through the guide;
- Back returns to the previous step;
- Close hides the guide;
- `Guide` reopens it at `welcome`;
- the final action is labeled `Done` and closes the guide;
- after closing onboarding, START remains enabled;
- console, page, request, and HTTP error collections remain empty.

Expected evidence:

- `artifacts/onboarding/dai-070-onboarding.json`
- `artifacts/onboarding/dai-070-onboarding.png`

## Required production validation

```powershell
git fetch origin; git switch feat/dai-070-onboarding; git pull --ff-only origin feat/dai-070-onboarding; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-070-validation.ps1
```

## Completion gate

Do not mark DAI-070 DONE until the full Node suite and the visible-Chrome onboarding smoke both pass.

## Explicit non-goals

- no claim that editor-slice currently performs initial full-dungeon natural-language generation;
- no hosting decision (DAI-072);
- no mobile-specific UX acceptance (DAI-075);
- no new third-party dependency or creative asset.
