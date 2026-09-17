# DAI-070 First-Run Onboarding

## Status

**DONE.** Production Node and visible-Chrome validation passed on 2026-09-17.

Reviewed evidence:

- generated: `2026-09-17T12:19:23.843Z`;
- Node.js / browser harness: production validation completed with installed Google Chrome;
- JSON SHA-256: `ea3eaaf67cd78c4aafaba6ec2a5199e05fff62ae4909061b9ab6ce7f60ad09b2`;
- PNG SHA-256: `c05733b61495b77d0bf6382c9757a09026f5c0d0b81136840af55cca6607cf3d`;
- `passed = true`;
- editor ready and START-eligible;
- onboarding opened automatically at `welcome`;
- Back was disabled on the first step;
- Next reached `edit` and `validate` in order;
- Back returned to `edit`;
- Close hid the guide;
- `Guide` reopened at `welcome`;
- final step was `play` and `Done` closed the guide;
- START remained available after onboarding closed;
- console, page, request, and HTTP error collections were all empty.

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

## Production evidence result

The visible-Chrome smoke verified:

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

The screenshot evidence shows the first-run welcome dialog over the live editor surface with `1 / 4`, disabled Back, Next, and the current-demo boundary text visible.

Evidence files are generated locally under:

- `artifacts/onboarding/dai-070-onboarding.json`
- `artifacts/onboarding/dai-070-onboarding.png`

## Explicit non-goals

- no claim that editor-slice currently performs initial full-dungeon natural-language generation;
- no hosting decision (DAI-072);
- no mobile-specific UX acceptance (DAI-075);
- no new third-party dependency or creative asset.
