# DAI-099 — Refreshed Submission Candidate

## 提出前の確認状況（2026-10-04）

確認基準は `8bcce65246663bc16625a0f915ec2f202c63b5e4`。`rollback/pre-submission-2026-10-04` はこのcommitを保存する現状退避点であり、最終受入の全項目PASSを意味しません。最新の確認結果・未完了項目は [提出前検証記録 PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) を参照してください。

所有者のWindows Brave/Chromiumによる限定live確認で、Generateのcloud Response、AI Editの `move-entity` Responseと画面適用を確認済みです。公開build-infoと対象mainのcommit/source/bundle一致、全公開E2E、全異常入力への合格はこの確認に含みません。根拠は [限定live確認記録](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/3196f2bb942bbdfbcddc2481416f24d7196c5ead/docs/testing/LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md) を参照してください。

10月3日の受入smokeと過去の公開E2Eは、それぞれの対象commit・fixture／実providerの区別を保持します。全体suite、公開API異常入力、最終動画・証拠の整合、repository公開と提出は、個別の証拠が揃うまで完了扱いにしません。

旧DAI-099候補 `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3` のfreezeと実行結果は [PR #55](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/55)／[PR #56](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/56) に保持します。旧Draft #55–58のcloseは検証済みへの変更ではありません。以下は歴史的な2026年9月の計画とrunner仕様です。

## 歴史的計画（2026-09）

### Historical status

**IN PROGRESS.**

DAI-085 through DAI-098 changed the runtime after the historical M8 candidate. DAI-099 creates a new final candidate without rewriting the historical DAI-081/082/084 evidence.

## Goal

Produce one refreshed judge-facing candidate with:

- current browser runtime;
- current 2-floor-capable generation/play loop;
- current programmatic characters;
- current Play UI stack;
- current programmatic audio;
- current run simulation/balance work;
- refreshed public HTTPS E2E;
- refreshed <3-minute demo video;
- refreshed legal/privacy/public-doc evidence;
- a new candidate commit/tree/build fingerprint;
- a new rollback branch.

## Phase A — predeploy candidate

Branch:

`feat/dai-099-refreshed-submission-candidate`

Run:

```powershell
.\scripts\run-dai-099-predeploy-validation.ps1
```

The runner verifies:

- exact audited tracked package-lock;
- syntax;
- complete Node suite;
- DAI-098 run simulation evidence;
- START / Exploration / Room Event / multi-floor browser regressions;
- programmatic characters;
- programmatic audio;
- current Play UI;
- owner UI;
- production build;
- build fingerprint;
- hosting smoke;
- browser/performance gate;
- legal/provenance;
- secret/privacy;
- desktop/mobile scope;
- public-doc truthfulness;
- submission metadata;
- refreshed video plan;
- git diff check.

Passing this phase means the branch is suitable to merge/deploy. It does **not** mean public E2E/video/freeze are complete.

## Build fingerprint

`npm run build:hosting` now emits:

`dist/build-info.json`

It records:

- schema version;
- source commit SHA;
- commit-source environment;
- deterministic runtime-source SHA-256;
- local runtime-bundle SHA-256 diagnostic;
- build timestamp.

The runtime-source hash is derived from the tracked production source/dependency boundary using Git blob identities, so it is stable across Windows and Cloudflare Linux checkouts. The runtime-bundle hash is still computed from the locally built static output as a diagnostic, but compiled bundle bytes are not required to be identical across operating systems.

`build-info.json` is served with `Cache-Control: no-store`.

This prevents a stale public deployment from being accepted accidentally.

## Phase B — merge and deploy

After Phase A passes:

1. merge the DAI-099 preparation PR to `main`;
2. sync local `main`;
3. wait for Cloudflare Pages production deployment of that main commit;
4. do not change runtime code between public validation and freeze.

Cloudflare Git integration remains the selected deployment path.

## Phase C — refreshed public E2E

From synchronized `main`:

```powershell
.\scripts\run-dai-099-public-validation.ps1
```

This rebuilds the same candidate locally and requires the public site to expose a matching:

- commit SHA;
- deterministic runtime-source SHA-256.

The local/public runtime-bundle SHA-256 values are retained as diagnostics rather than a cross-platform acceptance invariant.

Then the public smoke verifies:

- HTTPS;
- current ▶ Test / Mystery / audio / floor-count UI;
- current LV / HP / EXP / G HUD;
- live cloud Generate;
- two generated floors;
- live natural-language Edit;
- both live API routes returning HTTP 200;
- centered Room Event stack;
- programmatic Player/Enemy presentation;
- real combat changing PlayerState;
- exact PlayerState carry to Floor 2;
- cleared two-floor Result;
- Result audio mode;
- zero external audio assets;
- Return to Edit;
- zero browser/page/request/HTTP errors.

Evidence:

- `artifacts/dai-099-public/dai-099-refreshed-public.json`
- `artifacts/dai-099-public/dai-099-refreshed-public.png`

## Phase D — refreshed demo video

Only after Phase C passes:

```powershell
npm run demo:refreshed-video
```

See:

`docs/testing/DAI-099_REFRESHED_VIDEO.md`

The automated runner can create/probe the MP4, but final visual review remains human-required.

## Phase E — freeze preparation

After the refreshed public E2E, legal/privacy/docs/metadata evidence, and final reviewed MP4 exist:

```powershell
npm run prepare:refreshed-freeze
```

The freeze-prep script requires:

- current branch is `main`;
- local main exactly matches `origin/main`;
- tracked working tree is clean;
- audited lock hash matches;
- local build fingerprint matches current candidate commit;
- refreshed public evidence passed;
- public commit and runtime-source fingerprint match the candidate;
- refreshed video evidence passed;
- actual MP4 exists and ffprobe proves duration <180 seconds;
- legal audit passed;
- privacy audit passed;
- public-doc audit passed;
- metadata audit passed.

It writes:

- `artifacts/dai-099-freeze/dai-099-freeze-prep.json`
- `artifacts/dai-099-freeze/dai-099-dist-manifest.txt`

It does **not** create the rollback branch or edit freeze documentation.

## Phase F — rollback / bookkeeping

After freeze-prep passes:

1. create a new rollback branch at the exact candidate commit;
2. record candidate commit/tree/timestamp/message;
3. record rollback branch;
4. record runtime source hash and local/public runtime bundle diagnostics;
5. record public E2E evidence hash;
6. record final MP4 SHA-256 and duration;
7. record legal/privacy/docs/metadata evidence hashes;
8. record dist manifest hash;
9. validate the bookkeeping without modifying the frozen runtime.

This mirrors the historical DAI-084 separation between candidate runtime and freeze bookkeeping.

## Remaining after DAI-099

DAI-099 completion unblocks:

- DAI-090 unexpected-prompt checks;
- DAI-091 final compliance;
- DAI-092 final submission.

DAI-017 PCE remains a separate blocked evidence track and is not fabricated by DAI-099.
