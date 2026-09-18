# DAI-075 Mobile Scope

## Status

**IN PROGRESS.** Desktop-only submission scope, narrow-view limitation disclosure, and validation harness are implemented; production evidence is pending.

## Scope decision under validation

The current submission candidate will support and advertise:

- desktop Google Chrome on Windows;
- desktop-size evaluation, with 1440 × 900 used as the production reference viewport.

It will **not** claim mobile support.

Mobile/narrow layouts remain best-effort and display an explicit notice directing judges to desktop Chrome.

## Why mobile is not accepted in this build

Current production evidence does not include:

- physical mobile-device acceptance;
- Android/iOS browser matrix;
- frozen mobile tap targets;
- mobile editor usability sessions;
- PCE mobile tap success evidence.

The hackathon production requirements require a hosted browser demo but do not require mobile support.

## PCE-1.0 boundary

PCE-1.0 already defines mobile tasks as conditional and a Mobile-N/A score path.

With DAI-075 desktop-only scope:

- mobile target IDs become N/A for the current submission;
- PCE remains blocked by its other prerequisites;
- the protocol itself is not changed.

## Production evidence contract

### Desktop reference

- viewport 1440 × 900;
- editor ready, valid, and START-eligible;
- onboarding ready;
- mobile-scope notice hidden;
- horizontal overflow absent;
- browser/page/request/HTTP errors absent.

### Narrow best-effort probe

- viewport 390 × 844;
- touch emulation enabled;
- editor ready, valid, and START-eligible;
- mobile-scope notice visible;
- notice explicitly says desktop is the supported judging target and mobile is best-effort;
- horizontal overflow absent;
- onboarding close works;
- START remains visible and enabled;
- browser/page/request/HTTP errors absent.

Expected evidence:

- `artifacts/mobile-scope/dai-075-mobile-scope.json`;
- `artifacts/mobile-scope/dai-075-desktop.png`;
- `artifacts/mobile-scope/dai-075-narrow.png`.

## Required validation

```powershell
git fetch origin
git switch feat/dai-075-mobile-scope
git pull --ff-only origin feat/dai-075-mobile-scope
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-075-validation.ps1
```

## Boundaries

- the narrow probe is not mobile support certification;
- no Android/iOS support claim;
- no Safari/Firefox support claim;
- no PCE participant result is inferred from automated browser smoke;
- future mobile support requires a new acceptance matrix and may reopen PCE mobile tasks.
