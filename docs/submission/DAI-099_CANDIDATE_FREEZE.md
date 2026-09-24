# DAI-099 Refreshed Candidate Freeze / Rollback Point

## Status

**DONE for the refreshed candidate.**

The refreshed DAI-099 candidate passed predeploy acceptance, production public E2E, refreshed demo capture, manual visual review, and freeze preparation on 2026-09-24.

This bookkeeping branch is intentionally separated from the frozen runtime commit so recording the freeze does not change the candidate identity or trigger a different production commit.

## Frozen candidate

- Candidate ID: `dai-099-refreshed-submission-candidate-2026-09-24`
- Git commit: `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3`
- Git tree: `1ee24b750bec04a4488c94ca2e7cc54ec015530f`
- Commit time: `2026-09-24T20:16:48+09:00`
- Commit message: `DAI-099: make public fingerprint cross-platform deterministic (#54)`
- Rollback branch: `rollback/submission-candidate-dai-099-2026-09-24`
- Public demo: `https://dungeon-architect-ai.pages.dev/`
- Node.js: `24.15.0`
- Audited `package-lock.json` SHA-256:
  `ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc`

Machine-readable manifest:

`docs/submission/DAI099_CANDIDATE_FREEZE.json`

## Rollback branch policy

`rollback/submission-candidate-dai-099-2026-09-24` points directly to the frozen candidate commit.

Treat this branch as immutable by convention:

- do not commit on it;
- do not move it;
- do not merge into it;
- do not reuse its name for a later candidate.

Safe inspection:

```powershell
git fetch origin --prune
git switch --detach origin/rollback/submission-candidate-dai-099-2026-09-24
```

Safe recovery branch:

```powershell
git fetch origin --prune
git switch -c recover/dai-099-submission-candidate origin/rollback/submission-candidate-dai-099-2026-09-24
```

Do not force-reset `main`; restore through a reviewed branch/PR or deploy the exact candidate commit as appropriate.

## Runtime identity

The accepted cross-platform runtime identity is:

- `runtimeSourceSha256`:
  `dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6`

The Vite/Rolldown static bundle is retained as a diagnostic because Windows-local and Cloudflare Linux builds are not bit-for-bit identical:

- local runtime-bundle SHA-256:
  `cb4fc00bbbec96b2d9eebe67f6dea586f90eacf74f1cb5248ffecee7bc1846b3`
- public Cloudflare runtime-bundle diagnostic SHA-256:
  `82e64667c53a523ae701e9a9d4ef2a4ea06caad8cbbf011ac2ca7ee18feaf5c9`
- diagnostic equality: `false`

This mismatch is not an acceptance failure. The public candidate matched both the exact candidate commit and the deterministic runtime-source fingerprint.

## Refreshed public E2E

The production public validation passed with an empty false-check list.

Accepted public behavior included:

- HTTPS production deployment;
- exact candidate commit;
- matching deterministic runtime-source fingerprint;
- live cloud Generate;
- 2-floor generation;
- live constrained natural-language Edit;
- both production API routes returning HTTP 200;
- centered Room Event presentation;
- programmatic Player/Enemy presentation;
- real combat PlayerState changes;
- exact state carry into Floor 2;
- cleared Floor 2/2 Result;
- current audio state;
- Return to Edit;
- zero browser/page/request/HTTP errors.

Public E2E evidence SHA-256:

`984ab73f0a1ceeb44f4fbf3cebb60a7b2802e9f10a01ec44721c03224e4e8866`

## Final refreshed demo video

Accepted MP4:

`artifacts/dai-099-video/dai-099-refreshed-demo.mp4`

- SHA-256:
  `deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7`
- duration: `59.9 s`
- size: `808130 bytes`
- resolution: `1920×1080`
- frame rate: `30 fps`
- automated recording run: passed;
- manual visual review: accepted.

The reviewed capture visibly covered Generate → Edit/Undo → natural-language Edit → Test → Room Events / Player-Enemy presentation → Floor 2 → cleared Floor 2/2 Result → Return to Edit, with no browser tabs/address bar, Windows taskbar, terminal, or DevTools visible in the captured viewport.

## Freeze-prep acceptance

`npm run prepare:refreshed-freeze` passed with `falseChecks: []`.

Frozen values:

- dist manifest SHA-256:
  `9c324ad9d787a8e07788b80db2ec6358c7eb4440eb040eeb20e955ea82b4cf79`
- build fingerprint evidence:
  `0b7edbc12fadde4ae6154d6eacebb794698b164a624f2cbd1b4a85d455ba7da4`
- public E2E evidence:
  `984ab73f0a1ceeb44f4fbf3cebb60a7b2802e9f10a01ec44721c03224e4e8866`
- video-plan evidence:
  `730cb5bc51773849871d4fda67c81c63c978fa79a7465a7d3245d49f6e89a33b`
- video-run evidence:
  `70077268fb3553c681a71bb884ef8a5a69320d4bf1fce06762ff2385b8d9d9fa`
- legal evidence:
  `5b49981114370cd682b841cd0edb39d2bba6da050807ddff7e73cde673617bae`
- privacy evidence:
  `799c566c5c13a5993fdadcc05565bc615b96575cc0b140935c0f58eb416ef123`
- metadata evidence:
  `9f9f850397949e4140a24fbfc5c12249c8ca55adc9edb7f6521868eac69bdaad`
- predeploy public-doc evidence:
  `335d392df8c1e9b99888830ef52fdf1acbf1d43ea6e1447f8a752fa3b7d59f50`

## Bookkeeping branch policy

This document and its audit live on:

`freeze/dai-099-bookkeeping-2026-09-24`

The bookkeeping branch may change only freeze documentation, freeze-audit code, and status bookkeeping. It must not modify the candidate runtime.

Do **not** merge this bookkeeping branch into `main` while the exact candidate commit is intended to remain the published production identity, because a merge would create a new production commit even if runtime source is unchanged.

## Reopen rule

Create a new candidate ID and a new rollback branch if any later work changes:

- production runtime or hosting configuration;
- production dependency boundary;
- submission metadata;
- legal/privacy boundary;
- judge-facing behavior;
- final video.

The historical DAI-084 rollback branch and this DAI-099 rollback branch remain preserved as immutable recovery points.
