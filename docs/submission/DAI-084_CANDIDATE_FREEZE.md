# DAI-084 Candidate Freeze / Rollback Point

## Status

**IN PROGRESS.** Candidate identity and rollback ref are frozen. Production rebuild / freeze-audit evidence is pending.

## Frozen candidate

- Candidate ID: `m8-submission-candidate-2026-09-19`
- Git commit: `cacba2a1f8f079ab6401768b97f9fc91fff8f3b9`
- Git tree: `e2938bb46e1cf2eedc3a90e2b7603bd6050486ad`
- Commit time: `2026-09-19T07:23:10Z`
- Commit message: `Complete DAI-083 description and focus category (#39)`
- Rollback branch: `rollback/submission-candidate-m8-2026-09-19`
- Public demo: `https://dungeon-architect-ai.pages.dev/`
- Node.js: `24.15.0`
- Audited local `package-lock.json` SHA-256: `ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc`

Machine-readable manifest:

`docs/submission/CANDIDATE_FREEZE.json`

## Why the candidate commit predates DAI-084 docs

DAI-084 itself records and validates the freeze. If the freeze document were included inside the commit being identified, the commit SHA would change whenever the SHA was written into that document.

Therefore the frozen candidate is the last M8 product/submission-metadata commit **before** the DAI-084 bookkeeping layer:

`cacba2a1f8f079ab6401768b97f9fc91fff8f3b9`

The DAI-084 branch may add only freeze/rollback documentation, audit scripts, and submission-status bookkeeping. It must not change production runtime behavior.

## Rollback branch policy

`rollback/submission-candidate-m8-2026-09-19` points directly to the frozen candidate commit.

Treat this branch as immutable by convention:

- do not commit on it;
- do not move it;
- do not merge into it;
- do not reuse its name for a later candidate.

The connected GitHub tool does not expose tag creation in this environment, so this dedicated branch is the persistent rollback ref.

## Safe rollback / recovery

Do **not** force-reset `main`.

To inspect the frozen candidate:

```powershell
git fetch origin --prune
git switch --detach origin/rollback/submission-candidate-m8-2026-09-19
```

To create a reviewed recovery branch:

```powershell
git fetch origin --prune
git switch -c recover/m8-submission-candidate origin/rollback/submission-candidate-m8-2026-09-19
```

Then run the normal validation/build path and restore through a PR or deploy the exact candidate commit as appropriate.

## Dependency reproducibility boundary

The project has intentionally kept the already reviewed `package-lock.json` as a local untracked audit artifact rather than adding it to Git.

Rollback/rebuild validation therefore requires that local file to exist with exact SHA-256:

`ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc`

The freeze audit stops before dependency installation when the lockfile is missing or different.

## Production artifact identity

DAI-084 validation rebuilds `dist/` and records a deterministic manifest containing:

- every deployable relative path;
- byte size;
- SHA-256 per file;
- aggregate manifest SHA-256.

That generated aggregate hash becomes the build-artifact identity recorded after validation.

## Existing submission evidence attached to the candidate

- DAI-081 hosted public E2E: complete;
- DAI-082 final video SHA-256:
  `98ff93bb95491ea38ec7700f3d2313b99f6aa9a70aa4b2c1dceaff441a6ee25d`;
- DAI-083 metadata evidence SHA-256:
  `1458ca9cd1ec00aca0ac23547df1f55aafc217c50763ef0a1d9db3b53585d6cb`;
- latest DAI-083 public-doc evidence SHA-256:
  `c9dbc48df13f980fba8161fcff282716d797def70eabcd095c215d9f24f420d1`.

## Reopen rule

DAI-084 must be reopened and a **new candidate ID/ref** created if M9 or later work changes any production runtime/configuration, submission metadata, legal/privacy boundary, or other judge-facing behavior.

The old rollback branch remains preserved as historical recovery evidence.
