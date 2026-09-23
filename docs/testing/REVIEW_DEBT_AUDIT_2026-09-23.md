# Historical PR Review Debt Audit — 2026-09-23

## Scope

Repository: `Bonkoturyu/Dungeon-Architect-AI`

Audit scope:

- PR #1 through PR #47;
- inline review-thread resolved state;
- PR Conversation / review submissions;
- current `main` implementation and documentation;
- open issues and open pull requests.

At audit start:

- open issues: 0;
- open pull requests: 0;
- PR #36 is a closed, unmerged historical draft superseded by later DAI-082 work;
- actionable unresolved inline review threads existed only on PR #1, #2, #3, #4, and #41.

Quota-limit messages, deployment-bot status messages, and human acceptance records were not treated as unresolved engineering findings.

## Unresolved-thread inventory and disposition

### PR #1 — Establish production baseline and clean-room core

#### Thread `PRRT_kwDOUX4y8c6hv7tl`
Finding: reject non-serializable/runtime references before START.

Disposition: **fixed in current cleanup**.

- `validateDungeonSpec()` now performs a fail-closed JSON-safety traversal;
- cycles are rejected with `JSON_CYCLE`;
- functions/symbols/bigints/non-JSON values are rejected;
- runtime/class object instances are rejected;
- accessor properties and array holes are rejected;
- Core and Play regression tests cover cyclic/runtime values;
- `startPlaySession()` now receives a validation failure rather than reaching its JSON snapshot clone with cyclic input.

#### Thread `PRRT_kwDOUX4y8c6hv7to`
Finding: `movePlaySession(null/undefined)` could read `session.startedAt` before the session guard.

Disposition: **already fixed by later implementation; regression coverage added in current cleanup**.

Current default uses `session?.startedAt ?? 0`, and explicit tests now require both null and undefined sessions to return `SESSION_NOT_PLAYING`.

### PR #2 — Add M1 renderer benchmark and dependency review

#### Thread `PRRT_kwDOUX4y8c6hxMw3`
Finding: Three.js/Babylon.js sampling recorded RAF cadence without rendering every frame.

Disposition: **fixed for future runs; historical claims corrected**.

- `runFrameSampler` now accepts `onFrame`;
- Three.js and Babylon.js render on every sampled frame;
- historical 2026-09-12 FPS/frame values remain preserved but are explicitly marked non-comparable/non-decision-quality.

#### Thread `PRRT_kwDOUX4y8c6hxMw4`
Finding: benchmark dependencies were re-resolved because the audited lockfile was not tracked.

Disposition: **fixed**.

- the exact preserved audited `package-lock.json` was recovered;
- byte reconstruction with CRLF + final CRLF reproduces SHA-256
  `ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc`;
- that exact lockfile is now tracked at repository root;
- `run-m1-renderer-benchmark.ps1` verifies tracking + SHA-256 and uses `npm ci --ignore-scripts`.

#### Thread `PRRT_kwDOUX4y8c6hxMw5`
Finding: DAI-010 tracking contradicted the already completed browser run.

Disposition: **superseded and corrected**.

Current backlog records DAI-010 as a historical completed candidate-evaluation record, while the 2026-09-23 evidence correction explicitly distinguishes what the historical run did and did not prove.

### PR #3 — Complete renderer evaluation and select Three.js

#### Thread `PRRT_kwDOUX4y8c6h1lfE`
Finding: Unity and browser libraries used different first-render milestones.

Disposition: **claim withdrawn rather than retroactively fabricating comparable evidence**.

Historical `firstRenderMs` values are retained for traceability but are no longer used as apples-to-apples comparative evidence. Benchmark documentation now requires a common externally observable first-visible-frame milestone before future cross-engine first-frame comparisons.

#### Thread `PRRT_kwDOUX4y8c6h1lfI`
Finding: Unity ran headed Chrome while Three.js/Babylon.js ran headless.

Disposition: **fixed for future browser-library runs; historical comparison qualified**.

`run-renderer-benchmark.mjs` now launches headed Chrome with the same relevant WebGL/background scheduling flags used by the Unity runner. Historical navigation/startup timing is explicitly no longer treated as controlled cross-engine evidence.

#### Thread `PRRT_kwDOUX4y8c6h1lfK`
Finding: claimed steady-state renderer tie was based on browser scenes that were not rendered each sampled frame.

Disposition: **fixed for future runs; historical claim withdrawn**.

The browser harness now renders every sampled frame, and the old ~32 FPS values are retained only as historical RAF observations.

#### Thread `PRRT_kwDOUX4y8c6h1lfM`
Finding: Unity eligibility confirmation was required but no confirmation was retained before accepting benchmark evidence.

Disposition: **historical evidence downgraded; no eligibility is inferred**.

The Unity review now states that no explicit retained operator tier-eligibility confirmation exists for the historical run. The old raw run is preserved but is not represented as fully decision-quality licensing evidence. Any new Unity run requires current explicit operator eligibility confirmation.

#### Thread `PRRT_kwDOUX4y8c6h1lfO`
Finding: Unity benchmark required an audited lockfile that a clean checkout could not obtain.

Disposition: **fixed**.

The exact audited lockfile is now tracked, preserving the already reviewed SHA-256. The Unity runner continues to verify the hash and use `npm ci`.

### PR #4 — Implement minimal Three.js renderer adapter

#### Thread `PRRT_kwDOUX4y8c6h1wKt`
Finding: DAI-014 validation required a missing untracked lockfile.

Disposition: **fixed**.

A clean checkout now contains the exact audited root `package-lock.json`; existing DAI validation runners can verify the expected SHA and run `npm ci`.

### PR #41 — Redesign creation UX with exploration and room events

#### Thread `PRRT_kwDOUX4y8c6kI0g3`
Finding: refreshed-video checks were written as completed even though the reviewed video was the historical START/Result flow.

Disposition: **fixed**.

`DAI-082_VIDEO.md` now separates:

- historical M8 video acceptance;
- **PENDING** DAI-099 refreshed-video acceptance.

Current Play/UI checks are no longer represented as observed in the historical MP4.

#### Thread `PRRT_kwDOUX4y8c6kI0g4`
Finding: Known Limitations claimed DAI-085 itself remained in progress after DAI-085 was already complete.

Disposition: **fixed and expanded**.

Known Limitations now reports the actual remaining finalization path:

- DAI-097 Audio;
- DAI-098 multi-floor simulation/balance;
- DAI-099 refreshed build/deploy/public E2E/video/docs/audits/freeze;
- DAI-091/092 final compliance and submission.

## Additional audit findings fixed proactively

The review-debt pass also found current-generation truthfulness drift outside the unresolved inline threads.

### Public candidate generation drift

The repository runtime has advanced beyond the public deployment that produced the historical DAI-081/082/084 evidence.

Corrected:

- README distinguishes locally accepted current runtime from historical public E2E;
- Judge Quick Start labels the current public URL as historical until DAI-099 redeploys;
- Submission Checklist separates historical M8 evidence from refreshed-final pending gates;
- Demo Storyboard points refresh work to DAI-099 after DAI-097/098;
- DAI-080 public-doc audit now validates that historical/current distinction.

### Renderer-decision evidence drift

Corrected:

- M1 result/final comparison/status documents preserve raw historical hashes/numbers but withdraw unsupported cross-engine timing claims;
- ADR-001 retains Three.js based on browser-first architecture and substantial later production evidence, not a claimed historical timing winner;
- Decision Log reflects the correction;
- future browser benchmark harness renders each sampled frame and runs headed;
- future first-visible-frame comparisons require one common milestone.

### Dependency reproducibility

Corrected:

- exact audited lockfile is tracked;
- audit documentation records byte-for-byte recovery;
- M1 browser benchmark uses `npm ci`;
- historical DAI-084 docs explicitly note that its old rollback commit predates tracked-lockfile recovery and must be superseded by DAI-099.

## DAI-005 verification baseline

A current-stack baseline gate now consists of:

1. tracked audited lockfile SHA verification;
2. exact `npm ci --ignore-scripts`;
3. syntax check for every tracked `.js` / `.mjs` / `.cjs` file;
4. complete `npm test`;
5. production hosting build;
6. built hosting Chrome smoke;
7. legal/provenance register audit;
8. public-doc truthfulness audit;
9. Git diff whitespace/error-marker check.

Runner:

```powershell
.\scripts\run-review-debt-validation.ps1
```

DAI-005 is accepted as DONE. The owner Windows/Chrome run passed dependency install, syntax, full Node tests, hosting build/smoke, legal/provenance checks, and the corrected public-doc audit; the final independently rerun `git diff --check origin/main...HEAD` also passed after `.gitattributes` documented the intentionally preserved CRLF semantics of the audited lockfile.

## Review-thread closure

After applying the dispositions above, each originally actionable unresolved inline thread was replied to with its concrete fix/disposition and marked Resolved.

Rechecked unresolved counts:

- PR #1: 0 / 2 unresolved;
- PR #2: 0 / 3 unresolved;
- PR #3: 0 / 5 unresolved;
- PR #4: 0 / 1 unresolved;
- PR #41: 0 / 12 unresolved.

No other PR in #1–#47 had an actionable unresolved inline review thread during the audit scan.

## Subsequent project progress

After this historical audit was completed:

- DAI-097 Audio presentation was accepted and merged;
- DAI-098 multi-floor simulation / balance became the active product task.

The original remaining-work bullets below are retained as the state at audit completion.

## Remaining intentionally unresolved project work

This audit does not convert real future work into completed work.

- DAI-017 remains BLOCKED on the PCE participant/evaluation protocol.
- DAI-097 remains the next product task after review-debt cleanup.
- DAI-098 remains planned.
- DAI-099 remains planned.
- repository visibility is currently Private and must be handled by final submission requirements.
- refreshed public E2E/video/freeze are not claimed complete.
