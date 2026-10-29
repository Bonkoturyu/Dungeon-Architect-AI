# 提出候補のfreeze記録 2026年10月20日

## 結論

| 対象 | 固定する内容 |
|---|---|
| 本番runtime | [`806d70c2be99863a2b14dbabf942422107898379`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/806d70c2be99863a2b14dbabf942422107898379)（Cloudflare Pages本番、2026-10-19反映） |
| rollback | タグ `rollback/submission-runtime-806d70c`（注釈付き、タグオブジェクト `1da41e6978b3f20b2bd2f1c438b9733fd1d6d5de`） |
| 提出文書 | この記録を含む `main` のcommit。以後に提出文書を変える場合は、この記録も更新する |
| 提出動画 | 150秒glb_v5（詳細は下記「提出動画」） |

所有者の判断（2026-10-20）で、本番は `806d70c` のまま再デプロイしない。`main` との差は、文書、テスト・検査用script、`package.json` のnpm script定義2行だけで、ブラウザに配るbundleは同一である（下記「本番と `main` の差」）。

この記録は最終受入の宣言ではない。repositoryのPublic化、最終compliance、提出は未完了。

## 本番runtime

2026-10-20に公開 `build-info.json` を取得した値:

| 項目 | 値 |
|---|---|
| `commitSha` | `806d70c2be99863a2b14dbabf942422107898379`（`commitSource: CF_PAGES_COMMIT_SHA`） |
| `runtimeSourceSha256` | `11920de02fb288ba7048b41241f6c1cf022f5c99676117552803570fdbbee830` |
| `runtimeBundleSha256` | `0a3853ac655a6f5deb879bd8670b02bb8445ef24cd8f43745b14ca143db30e69`（Cloudflare上のbuild。参考値） |
| `generatedAt` | `2026-10-19T08:34:20.426Z` |

この候補の確認結果は次の記録にある。

| 確認 | 結果 | 証拠（リポジトリには含めず、所有者の手元に保存） |
|---|---|---|
| [ローカル統合](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md) | 24/24段階 PASS（Node 694/694） | ZIP SHA-256 `d681d82e001e2e1c9c46e83b7b8221347878c6d8be2e61d7e37bb9cd194e80fa` |
| 公開deploymentの同一性（同上） | commitとruntime source指紋が一致 | 同上の記録 |
| 公開E2E（同上） | 22/22 checks PASS | JSON SHA-256 `e496dc8016b647661c1f1ee38465e2de6398d1e32d05fc2bd3143b20da3b4631` |
| [DAI-090 Final](../testing/PUBLIC_ABNORMAL_INPUT_DAI090_2026-10-19.md) | 20/20 PASS | ZIP SHA-256 `af493b5286df59a88a9897c2c0a0d866a3d4c63b1104211bd7014451a9f320ab` |
| 公開Generate / AI Edit異常入力（同上） | 8/8 checks PASS | JSON SHA-256 `9bc265b9bf25091f8e3bb41a881e71530eaac7a34939c93ef1d2079809b3bb9b` |

## 本番と `main` の差

2026-10-20時点の `main`（`ed6765f26419da8e8b1bb467007efa68b23271e7`）と `806d70c` の差は24ファイルで、内訳は次のとおり。

- 文書: README、`docs/legal/`、`docs/planning/`、`docs/submission/`、`docs/testing/` の記録
- テスト・検査用script: 公開E2E（`scripts/run-dai-099-public-smoke.mjs`）、異常入力smoke（`scripts/run-dai-100-public-abnormal-input-smoke.mjs`）、文書と動画の監査、`tests/tooling/` のテスト2件、旧DAI-082動画検査の削除
- `package.json`: npm script定義の追加1行（`smoke:public-abnormal-input`）と削除1行（`validate:video-plan`）

アプリ（`apps/editor-slice`）、Functions、`packages/**/src`、`package-lock.json`、build script、runtime指紋script、`THIRD_PARTY_NOTICES.txt` に差はない（`git diff --quiet` で確認）。

runtime source指紋は `main` で `8d59aeb1ffca8275faa295fd5500018b16c8c2251cc968c2b82706d0ee177b50` となり、本番と一致しない。指紋の計算対象に `package.json` が含まれ、上記のnpm script定義2行が変わったためである。同じWindows環境で両方をbuildした `runtimeBundleSha256` は、どちらも `819c200ed649f5f4557ea51f2d369878eda69fa4ade09c7afeede99945bb13af` で一致した。ブラウザに配る内容は同一である。

## 提出動画

| 項目 | 値 |
|---|---|
| ファイル | `DAI_Demo_Review_EN_2026-10-03_glb_v5.mp4`（リポジトリには含めず、所有者の手元に保存） |
| SHA-256 | `161f7674bb6963df212118919601b1da284622c234e566a156ea73c93bb17f9e`（2026-10-20に再計算して一致） |
| 尺・形式 | 150.000秒、映像1920 × 1080と音声の2ストリーム（2026-10-20にffprobeで確認） |

内容と来歴は [DEMO_STORYBOARD](DEMO_STORYBOARD.md) と [AI_USAGE](../legal/AI_USAGE.md) を参照。

動画の元映像（v2）は、2026-10-03ごろの候補を撮影したもので、撮影時のcommitは特定できていない。このため、動画と `806d70c` の画面が完全に一致するとは主張しない。分かっている差は次のとおり。

- GLB書き出し（2026-10-06に追加）は、アプリの再撮影ではなく、Blenderで描画した別サンプル階の静止画で示している（動画内に表示あり）
- 詳細HUDの見出しで中身を折りたたむ機能（2026-10-19に追加）は映っていない

編集に使ったFFmpegの扱いは、[依存関係台帳](../legal/THIRD_PARTY_DEPENDENCIES.md) の `PROD-DEP-VIDEO-002` を参照。

## freeze準備scriptを使わない理由

`npm run prepare:refreshed-freeze`（`scripts/run-dai-099-freeze-prep.mjs`）は、9月のDAI-099計画に合わせて作られた。前提は次の2つで、今回の候補はどちらも満たさない。

- 本番の `commitSha` と `main` のHEADが一致すること。今回は所有者の判断で本番を `806d70c` のまま残す
- 自動撮影runnerの実行記録（`dai-099-recording-run.json`）と、そのrunnerが出力した動画があること。glb_v5はこのrunnerで作っていない

このため、このscriptの代わりに、本記録で上記の値を個別に確認した。

## rollback

- 新規: タグ `rollback/submission-runtime-806d70c` → `806d70c2be99863a2b14dbabf942422107898379`（2026-10-20作成）
- 既存の退避点（`rollback/pre-submission-2026-10-04` ほか2件）は、同じcommitを指す同名タグへ移した（2026-10-20）。branchは `main` だけにしている
- マージせずcloseしたPRの元branchは、`archive/<元branch名>` タグとして残している

本番に問題が起きたときは、Cloudflare Pagesで `806d70c` の本番deploymentに戻すか、このタグからbuildし直す。どちらも所有者が行う。

## 未完了

- repositoryのPublic化
- 最終compliance、提出


## 2026-10-29 提出説明のレビューbranch改訂

ユーザー提供のDiscord告知スクリーンショット（ClaudiaS、#announcements、2026-10-29）の配点を受け、提出説明とJudge Quick Startに、対象利用者・意図する効果・実装済みの再利用範囲を追記した。READMEの導入にも同じ範囲を加えた。カテゴリは変更せず、元の短文と過去の文字数・監査結果をDAI-083文書内の履歴として保持する。

- 基準となる取得済み文書: `main` commit `6a4a2b1dbe957709cad86d8589ae95cafb474993`
- 対象: `DAI-083_DESCRIPTION_CATEGORY.md`、`JUDGE_QUICKSTART.md`、`README.md`、本記録の追記、metadata監査とその回帰テスト、および現行本文を検査するmetadata監査scriptと対応テスト
- レビューbranch: `docs/submission-rubric-2026-10-29`。この追記を含むbranch commitが文書改訂の同一性を示す。mainへの直接push、merge、repositoryのPublic化、デプロイ、提出は行わない
- 本番runtime `806d70c`、rollback、上の動画ファイル・SHA-256は変更しない。過去の受入結果を今回の再実行結果とは扱わない
- 改訂文の文字数・語数は現行本文だけを抽出して再計算する。旧metadata監査の固定文字列へのPASSを改訂文の合格根拠には使わない

ユーザーによるGitHub反映の承認を受け、専用branchとdraft PRでレビューする。改訂本文に対応したmetadata監査13/13と回帰テスト7/7をcloud Linux・Node24.22.1で確認した。mainへの取り込み後は、そのmerge結果を提出文書の同一性として扱う。mergeや最終提出の完了は本記録では主張せず、runtime再デプロイも要求しない。
