# DAI-084 Candidate Freeze / Rollback Point

## Status

**DONE.** Candidate identity, rollback ref, audited dependency boundary, and production rebuild manifest were validated on 2026-09-19.

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

### 2026-10-20 — branchからタグへ移行

repositoryのbranchを `main` だけにするため、`rollback/submission-candidate-m8-2026-09-19` は同じcommitを指す同名の注釈付きタグに置き換え、branchは削除した。下の復元手順はタグを使う形に直した。`scripts/run-dai-084-candidate-freeze-audit.mjs` の `rollbackRefExact` はbranchを前提にしているため、現在は失敗する。この監査は、M8候補以降の変更（`onlyDAI084BookkeepingChanged`）とlockfileの更新（`auditedLockfileExact`）により移行前から現在の `main` では失敗しており、当時の記録として残す。

## Safe rollback / recovery

Do **not** force-reset `main`.

To inspect the frozen candidate:

```powershell
git fetch origin --prune --tags
git switch --detach rollback/submission-candidate-m8-2026-09-19
```

To create a reviewed recovery branch:

```powershell
git fetch origin --prune --tags
git switch -c recover/m8-submission-candidate rollback/submission-candidate-m8-2026-09-19
```

Then run the normal validation/build path and restore through a PR or deploy the exact candidate commit as appropriate.

## Dependency reproducibility boundary

At the time of the historical DAI-084 freeze, the reviewed `package-lock.json` was kept as a local untracked audit artifact. That was a reproducibility weakness in the frozen 2026-09-19 candidate.

On 2026-09-23, the exact preserved lockfile was recovered and tracked on the current repository line with the same audited SHA-256:

`ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc`

The historical rollback commit itself is unchanged and therefore still does not contain the lockfile. DAI-099 must create a new refreshed candidate/rollback point that includes the tracked lockfile and current judge-facing runtime.

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

## Production validation evidence

Reviewed evidence generated at `2026-09-19T07:57:38.243Z` with Node.js `v24.15.0`.

- candidate-freeze evidence JSON SHA-256: `9f70222839f3b460c51c7de99994a48da65ab4fe07884a88ea28de590203c656`;
- dist manifest SHA-256: `387287bfba2aaad91a7ef4c9d98ebb522e8ce8e1e0768825d39d33d949d8ea6d`;
- candidate commit/tree matched;
- rollback branch resolved exactly to the frozen candidate commit;
- current DAI-084 branch descended from the candidate;
- only DAI-084 bookkeeping paths changed;
- Node version matched `24.15.0`;
- audited local package-lock was present and matched the expected SHA-256;
- production build was present;
- required deployable files were present;
- false-check list was empty.

The generated production build contained 6 files and the aggregate manifest hash above identifies that build output.

## Reopen rule

DAI-084 must be reopened and a **new candidate ID/ref** created if M9 or later work changes any production runtime/configuration, submission metadata, legal/privacy boundary, or other judge-facing behavior.

The old rollback branch remains preserved as historical recovery evidence.
