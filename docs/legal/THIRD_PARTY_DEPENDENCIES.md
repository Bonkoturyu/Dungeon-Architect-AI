# Third-Party Dependencies

Pre-production approvals do not automatically authorize production use. Production scope is reviewed separately.

| ID | Dependency | Version/Commit | Source | License | Provenance | NOTICE duties | Usage | Status | Review date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| PROD-DEP-001 | three | 0.185.1 / r185 | official three.js tag + npm publication | MIT | live upstream/package metadata rechecked; exact package identity/integrity recorded in reviewed lockfile | preserve MIT copyright/license | production browser renderer/runtime, DAI-014+, hosted demo bundle | Approved | 2026-09-18 | ADR-001 selected renderer; exact version pinned; official r185 MIT text copied to root `THIRD_PARTY_NOTICES.txt` and production build |
| PROD-DEP-002 | @babylonjs/core | 9.18.0 | official Babylon.js tag + npm publication | Apache-2.0 | live upstream/version rechecked; Pre evidence retained | preserve Apache-2.0 and applicable NOTICE if redistributed | M1 rendering benchmark only | Approved | 2026-09-12 | evaluated but not selected by ADR-001; not part of production browser distribution; new use requires scope review |
| PROD-DEP-003 | vite | 8.1.5 | official Vite tag + npm publication | MIT + bundled dependency notices | exact version and integrity recorded in reviewed lockfile | preserve Vite/bundled notices if Vite itself or covered bundled material is redistributed | production build/preview tooling and benchmark tooling | Approved | 2026-09-18 | build tool; not shipped as a browser runtime package; DAI-073 distribution audit confirms runtime notice obligation is handled separately for bundled Three.js |
| PROD-DEP-004 | playwright-core | 1.62.0 | official Playwright tag + npm publication | Apache-2.0 | exact version and integrity recorded in reviewed lockfile | preserve Apache-2.0 + applicable NOTICE if redistributed | production benchmark/smoke automation | Approved | 2026-09-12 | automation only; not included in production browser distribution; no bundled browser package |
| PROD-DEP-005 | lightningcss + platform bindings | 1.33.0 | npm packages resolved through Vite 8.1.5 | MPL-2.0 | reviewed lockfile records exact versions/integrity; transitive through Vite | MPL source/notice obligations if covered executable/library material is redistributed | build/dev tooling only | Approved | 2026-09-18 | no direct runtime/vendored use; DAI-073 final distribution audit records it as build-only rather than browser runtime material |
| PROD-DEP-TTS-001 | Kokoro offline narration toolchain | kokoro 0.9.4 / Kokoro-82M v1.0 / af_heart and exact transitive inventory | official PyPI / PyTorch / Hugging Face / Explosion sources in linked evidence | Apache-2.0 and component-specific MIT/BSD/GPL/LGPL/MPL/other licenses; not a single-license bundle | [technical review](TTS_TOOLCHAIN_REVIEW_2026-10-03.md), [93-package inventory](evidence/TTS_TOOLCHAIN_2026-10-03.json), exact model/voice hashes | Component redistribution obligations recorded separately from generated MP4; no software/model redistribution authorized | Offline English narration for the 150-second submission-video candidate only; excluded from browser runtime | Approved | 2026-10-03 | Existing user-authorized offline production only. 92 package payloads match official distributions plus bootstrap pip; the later same-URL torch check matched 12,395 files. Prior HTTP 403 cause remains unknown; the closure summary is retained, original temporary artifacts are no longer available. No publication/runtime admission is implied |
| PROD-CAND-005 | Unity Editor / WebGL | 6000.3.23f1 | official Unity toolchain | proprietary toolchain terms | user-executed production benchmark completed with 5/5 clean runs | per current Unity terms | DAI-010 renderer benchmark candidate only | Rejected | 2026-09-13 | not selected for browser MVP by ADR-001; no Unity runtime/build is part of final browser distribution |

Allowed status values: Candidate / Pending Evidence / Approved / Rejected / Removed / Replaced.

Only `Approved` dependencies may be installed or used in production. A `Rejected` candidate may remain as historical evidence but is not authorized for new production scope.

## Current public distribution composition

DAI-073 treats package installation and public redistribution as separate questions.

For the current Vite production browser build:

- project-authored application/core/editor/play/onboarding code is bundled;
- `three@0.185.1` is the external runtime library included in the browser bundle;
- Vite is the build tool and is not the browser runtime;
- Playwright is smoke/benchmark automation and is not shipped;
- Babylon.js is retained for renderer benchmark history and is not shipped in the selected browser runtime;
- Lightning CSS packages are transitive build tooling and are not directly shipped as application runtime dependencies;
- Unity benchmark sources/toolchain are not part of the production browser build.

The distribution notice for Three.js is maintained at root `THIRD_PARTY_NOTICES.txt` and copied into `dist/` by the production hosting build.

## Approval scope rule

`Approved` is scoped to the usage recorded in this table/review. New runtime, model, package, version, distribution purpose, or materially different use requires another review.

## 動画制作ツールの追加レビュー

ブラウザに同梱しない制作ツールも用途限定のレビュー対象とする。`PROD-DEP-TTS-001` の既存オフライン動画制作用途はユーザー承認済み。後続の同一公式URLでのPyTorch検証を含め、92件の公式配布物とbootstrap pipを照合し、既存の制作用途に限りApprovedとした。後続検証の要約は保存するが、初回インストールログの復元や過去の403原因の確定とは区別する。公開・提出・ソフトウェア／モデルの再配布は別途未承認であり、この記録では許可しない。既存動画の権利侵害や差替え必須を認定するものではない。詳細と未確認項目は [TTS review](TTS_TOOLCHAIN_REVIEW_2026-10-03.md) を参照。
