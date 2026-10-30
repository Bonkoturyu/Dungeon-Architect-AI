# Third-Party Dependencies

Pre-production approvals do not automatically authorize production use. Production scope is reviewed separately.

| ID | Dependency | Version/Commit | Source | License | Provenance | NOTICE duties | Usage | Status | Review date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| PROD-DEP-001 | three | 0.185.1 / r185 | official three.js tag + npm publication | MIT | live upstream/package metadata rechecked; exact package identity/integrity recorded in reviewed lockfile | preserve MIT copyright/license | production browser renderer/runtime, DAI-014+, hosted demo bundle | Approved | 2026-09-18 | ADR-001 selected renderer; exact version pinned; official r185 MIT text copied to root `THIRD_PARTY_NOTICES.txt` and production build |
| PROD-DEP-002 | @babylonjs/core | 9.18.0 | official Babylon.js tag + npm publication | Apache-2.0 | live upstream/version rechecked; Pre evidence retained | preserve Apache-2.0 and applicable NOTICE if redistributed | M1 rendering benchmark only | Approved | 2026-09-12 | evaluated but not selected by ADR-001; not part of production browser distribution; new use requires scope review |
| PROD-DEP-003 | vite | 8.1.6 | official Vite v8.1.6 tag + exact npm publication | MIT + bundled MIT/ISC/BSD-2-Clause/Apache-2.0/CC0-1.0 notices | [8.1.6 production review](reviews/PROD-DEP-003-vite-8.1.6.md): tarball integrity/signatures, bundled code/license diff and exact reviewed lockfile | preserve Vite/bundled notices if Vite itself or covered bundled material is redistributed | production build/preview tooling and benchmark tooling | Approved | 2026-10-30 | build tool only; not a new browser runtime dependency; approval includes changed bundled launch-editor 2.14.2 and shell-quote 1.12.0 only in this Vite package; integration checks remain separate |
| PROD-DEP-004 | playwright-core | 1.62.0 | official Playwright tag + npm publication | Apache-2.0 | exact version and integrity recorded in reviewed lockfile | preserve Apache-2.0 + applicable NOTICE if redistributed | production benchmark/smoke automation | Approved | 2026-09-12 | automation only; not included in production browser distribution; no bundled browser package |
| PROD-DEP-005 | lightningcss + platform bindings | 1.33.0 | npm packages resolved through Vite 8.1.6 (same locked graph) | MPL-2.0 | reviewed lockfile records exact versions/integrity; transitive through Vite | MPL source/notice obligations if covered executable/library material is redistributed | build/dev tooling only | Approved | 2026-09-18 | no direct runtime/vendored use; DAI-073 final distribution audit records it as build-only rather than browser runtime material |
| PROD-DEP-006 | source-map-js | 1.2.2 | official npm publication + upstream v1.2.2 | BSD-3-Clause | exact registry integrity and current lockfile SHA in [review](reviews/PROD-DEP-006-source-map-js-1.2.2.md); Vite → PostCSS transitive dependency | preserve copyright, conditions and disclaimer if package is redistributed; no runtime notice addition for this build-only change | build/dev tooling only | Approved | 2026-10-06 | CSP crash / CVE-2026-93749 patch; app runtime imports and built payload unchanged in same-environment comparison; new runtime/distribution use needs another review |
| PROD-DEP-TTS-001 | Kokoro offline narration toolchain | kokoro 0.9.4 / Kokoro-82M v1.0 / af_heart and exact transitive inventory | official PyPI / PyTorch / Hugging Face / Explosion sources in linked evidence | Apache-2.0 and component-specific MIT/BSD/GPL/LGPL/MPL/other licenses; not a single-license bundle | [technical review](TTS_TOOLCHAIN_REVIEW_2026-10-03.md), [93-package inventory](evidence/TTS_TOOLCHAIN_2026-10-03.json), exact model/voice hashes | Component redistribution obligations recorded separately from generated MP4; no software/model redistribution authorized | Offline English narration for the 150-second submission-video candidate only; excluded from browser runtime | Approved | 2026-10-03 | Existing user-authorized offline production only. 92 package payloads match official distributions plus bootstrap pip; the later same-URL torch check matched 12,395 files. Prior HTTP 403 cause remains unknown; the closure summary is retained, original temporary artifacts are no longer available. No publication/runtime admission is implied |
| PROD-DEP-VIDEO-001 | Blender | 4.3.2（Cycles、CPU描画） | official Blender release（取得元とハッシュは所有者保管の制作記録による。本リポジトリ未収録） | GNU GPL（source: v2 or later、binary配布: v3 or later）。公式license pageによれば、Blenderで作った作品はGPLの対象外 | 所有者保管の制作時レビュー記録（本リポジトリ未収録） | ツール本体を再配布しないため、なし | DAAIの提出用デモ動画のオフライン制作のみ（アプリが出力したGLBの読み込みとCPU描画）。アプリへの同梱・ツール本体の再配布なし | Approved | 2026-10-19 | 動画の公開・提出そのものの承認とは別に扱う。glb_v5の静止画に使用（[AI_USAGE](AI_USAGE.md)） |
| PROD-DEP-VIDEO-002 | FFmpeg | 7.1.5 | 使用したbuildの取得元は未確認 | LGPL v2.1 or later が既定。GPL対象の部品を有効にしたbuildではGPL v2 or later（[FFmpeg legal](https://ffmpeg.org/legal.html)） | 動画制作資料にバージョンの記録あり。buildの構成（GPL部品の有無）・取得元・実行ファイルのハッシュは記録がなく、後から確認できない | ツール本体を再配布しないため、なし | DAAIの提出用デモ動画のオフライン制作のみ（編集・書き出し）。アプリへの同梱・ツール本体の再配布なし | Pending Evidence | 2026-10-20 | glb_v5の編集に、レビュー前に使用した（過去の使用）。証拠の不足は後から解消できないため、この状態のまま記録として残す。2026-10-19にクラウド環境で観測した `7.1.5-0+deb13u1`（`--enable-gpl`）は、制作時の実体と同一であることを示せないため根拠にしない。このbuildは今後使わず、glb_v5の書き出し直しも行わない（所有者判断、2026-10-20）。FFmpegのライセンス上の義務はツール本体の配布で生じるもので、出力した動画には及ばない |
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

### 2026-10-06 — GLB外観出力のaddon用途レビュー

`PROD-DEP-001`の固定`three@0.185.1`に含まれる公式`examples/jsm/exporters/GLTFExporter.js`を、現在階の静的な形状・材質をブラウザ内でGLB化する用途に使用する。既存rendererと同じMIT packageで、追加package・version変更・creative asset・外部serviceはない。公式[r185 source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/exporters/GLTFExporter.js)と[API文書](https://threejs.org/docs/pages/GLTFExporter.html)、installed packageのversion/LICENSEを確認した。用途はこのGLB出力に限定してApprovedとし、既存のMIT noticeを維持する。dynamic importされたaddon chunkも配布bundleに含む。検証用GLTFLoaderは同じ固定packageの公式addonで、製品bundleには追加しない。

`Approved` is scoped to the usage recorded in this table/review. New runtime, model, package, version, distribution purpose, or materially different use requires another review.

## 動画制作ツールの追加レビュー

ブラウザに同梱しない制作ツールも用途限定のレビュー対象とする。`PROD-DEP-TTS-001` の既存オフライン動画制作用途はユーザー承認済み。後続の同一公式URLでのPyTorch検証を含め、92件の公式配布物とbootstrap pipを照合し、既存の制作用途に限りApprovedとした。後続検証の要約は保存するが、初回インストールログの復元や過去の403原因の確定とは区別する。公開・提出・ソフトウェア／モデルの再配布は別途未承認であり、この記録では許可しない。既存動画の権利侵害や差替え必須を認定するものではない。詳細と未確認項目は [TTS review](TTS_TOOLCHAIN_REVIEW_2026-10-03.md) を参照。
