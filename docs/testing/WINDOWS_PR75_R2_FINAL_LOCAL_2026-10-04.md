# Windows PR75 r2 最終ローカル統合テスト記録 2026年10月4日

## 結論

**FAIL。全24段階のうち4 PASS / 1 FAIL / 19 NOT_RUN。24/24 PASSの証拠は成立していない。**

Windowsで実行された `npm run validate:dai-100-final-local` のr2提出証拠を記録する。Node tests **615/615**、複数階simulation **18/18**、production hosting build、browser performance **12/12** はPASS。第5段階のOwner UIは最後の判定まで進み、**61 checks中60 PASS / 1 FAIL**。唯一のfalse checkは `roomEventStackCentered` だった。終了コードは `1`、fail-fastにより第6〜24段階は未実行である。

今回の座標は、Room Eventをviewport中央から104px上へ配置する現行CSSと一致している。harness側には旧「Y中央±3px」の期待値が残っており、これが直接の不一致となった。ただし、r2証拠には出口パッドの矩形や非重複判定がなく、**出口パッドを覆わないことまで実証した結果ではない**。

本記録は提出された1回の実測を保存する。後続のharness修正や再試験で、このFAILをPASSへ書き換えない。本記録を含むcommitと実測対象commitは区別する。

## 対象と実行環境

- Repository: `Bonkoturyu/Dungeon-Architect-AI`
- 実測対象: PR #75 r2、commit [`1d9cbb426408e080568a04ea9e44870309339d07`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/1d9cbb426408e080568a04ea9e44870309339d07)
- 対象tree: `2dde5e7513c4191c31b566d2eca8287ae2d36be8`
- 開始: `2026-10-04T20:35:08.6034495+09:00`
- 終了: `2026-10-04T20:36:18.6723901+09:00`
- 所要時間: **70.069秒**。日時はJST（UTC+09:00）
- Node.js `v24.15.0` / npm `11.12.1` / Google Chrome `153.0.8010.55`
- Browser viewport: `1440 × 900`。user agentは `Windows NT 10.0; Win64; x64`。OSの正確なedition/buildは未収録
- `run-metadata.json`、`git-head.txt`、build logの `commitSha` は上記headと一致し、buildの `commitSource` は `git`
- GitHub commitのtree識別子は別途照合済み。ただし、Windows実行前のworking tree全体の証明ではない

実行後の `git-status.txt` は `?? artifacts/` のみで、tracked fileの変更は報告されていない。実行前statusは同梱されておらず、「実行前もcleanだった」とは断定しない。

## 24段階の結果

[既存suite定義](../../scripts/run-dai-100-final-local-regression.mjs)の順序とラベルを保持する。`NOT_RUN` は第5段階での停止による未実行を表す。第18段階の「Ten-strategy」は既存ラベルであり、方式数の実測結果ではない。

| 段階 | suiteラベル | 結果 |
|---|---|---|
| 1 | Full Node regression suite | PASS |
| 2 | Multi-floor simulation regression | PASS |
| 3 | Production hosting build | PASS |
| 4 | Browser performance regression | PASS |
| 5 | Owner UI regression smoke | FAIL |
| 6 | Room Event gameplay regression | NOT_RUN |
| 7 | Multi-floor browser regression | NOT_RUN |
| 8 | Programmatic character regression | NOT_RUN |
| 9 | Programmatic Audio V2 regression | NOT_RUN |
| 10 | Motion feedback regression | NOT_RUN |
| 11 | Event feedback regression | NOT_RUN |
| 12 | Result / camera-focus regression | NOT_RUN |
| 13 | DesignIntent atmosphere regression | NOT_RUN |
| 14 | AI Edit V3 structural regression | NOT_RUN |
| 15 | Reactive Audio V2 regression | NOT_RUN |
| 16 | JSON Export regression | NOT_RUN |
| 17 | JSON Import / round-trip regression | NOT_RUN |
| 18 | Ten-strategy Generator selector regression | NOT_RUN |
| 19 | Legal / provenance audit | NOT_RUN |
| 20 | Secret / privacy audit | NOT_RUN |
| 21 | Public docs truthfulness audit | NOT_RUN |
| 22 | Submission metadata audit | NOT_RUN |
| 23 | Syntax validation | NOT_RUN |
| 24 | Git whitespace / error-marker check | NOT_RUN |

第1段階は24 test group、計615 testsで、fail / cancelled / skipped / todoはいずれも0。この24 test groupは上表の24段階とは別の集計である。第2段階の18 checks、第4段階の12 checks、およびOwner UIの全61 checksは[機械可読記録](WINDOWS_PR75_R2_FINAL_LOCAL_2026-10-04.json)に保存した。過去の別実行のPASSを今回の未実行段階へ補完しない。

## Owner UIで確認できたこと

[前回のWindows記録](WINDOWS_PR75_FINAL_LOCAL_2026-10-04.md)は生成完了待機の30秒timeoutで停止した。Manual設定確認の未確定は、その実行の失敗画面による観測ではなくsourceに基づく診断だった。r2では生成完了後の判定まで進み、以下が直接記録されている。

- `manualConfirmation`: `mode: manual`、`dialogObserved: true`、`planSubmitted: true`
- `manualGenerationConfirmed`、`recommendedV3AndLegacyVersionsRemain`、`allFiveLanguagesSwitchLive` はすべてtrue
- 英語・日本語・簡体字中国語・繁体字中国語・韓国語でV3推奨ラベルを確認。V2の旧方式表示、V1の存在、選択中のV3を記録し、英語へ戻した後も確認
- `falseChecks` は `roomEventStackCentered` の1件のみ
- `consoleErrors`、`pageErrors`、`failedRequests`、`httpErrors` はすべて空配列

失敗記録のerrorは次のとおり。

```text
Owner UI review invariant failed: roomEventStackCentered
```

`browser-smoke-failure.json` の最終catch時点では、URLが `http://127.0.0.1:4194/apps/editor-slice/index.html`、`mode: edit`、`generationBusy: false`、`generationManual: true`、`generationAuto: false`、`reviewDialog: null`、`lastGeneration.roomCount: 5` だった。したがって、この実行の最終停止を前回の生成完了待機timeoutと同じものとして扱わない。

この最終edit stateと、次節のPlay中の `eventLayout` は異なる時点の採録である。失敗時の画像は同梱されていないため、画面を直接見て確認したとは扱わない。

## Room Eventの座標と静的診断

`owner-ui-review.json` の `eventLayout` は `eventVisible: true`、`reticleVisible: true` と次の実測値を記録している。

| 測定値 | px |
|---|---:|
| Room Event center X | 720 |
| Viewport center X | 720 |
| Room Event center Y | 380 |
| Viewport center Y | 484 |
| Reticle center Y | 484 |
| Event X − Viewport X | 0 |
| Event Y − Viewport Y | -104 |

実測対象sourceでは、[`apps/editor-slice/index.html:1367–1370`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/1d9cbb426408e080568a04ea9e44870309339d07/apps/editor-slice/index.html#L1367-L1370)の後段CSSが `.room-events` に `top: calc(50% - 104px)` と `max-height: min(42vh, calc(100% - 354px))` を指定している。直前のコメントは、多商品・多数Entityでも出口パッドを覆わず一覧内でスクロールする意図を示す。

一方、[`scripts/run-owner-ui-review-smoke.mjs:1330–1337`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/1d9cbb426408e080568a04ea9e44870309339d07/scripts/run-owner-ui-review-smoke.mjs#L1330-L1337)は、eventが表示されている場合、X/Yともviewport中心との差が3px以内であることを要求する。今回、X差は0px、Y差は-104pxのためfalseになる。

**実測座標は現行CSSの意図的な上方配置と一致しており、意図した位置からのruntime逸脱を示す観測ではない。** これは実測値とsourceの比較による診断で、修正後の再試験ではない。イベント領域と出口パッドの完全な矩形、相互の非重複、内容が増えた際の収まりは今回の `eventLayout` に収録されておらず、別途実測が必要である。

第11段階の[`scripts/run-dai-100-event-feedback-smoke.mjs:384–394`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/1d9cbb426408e080568a04ea9e44870309339d07/scripts/run-dai-100-event-feedback-smoke.mjs#L384-L394)にも `roomEventIntroPreservesCenter` の旧Y中央±3px期待値が残る。ただしr2では未到達であり、今回観測した追加FAILとして数えない。harness修正とその検証結果は、この歴史的r2結果から分離して記録する。

## ローカルURLとAPIの確認範囲

Browser performanceは `http://127.0.0.1:4184/apps/editor-slice/index.html`、Owner UI失敗snapshotは `http://127.0.0.1:4194/apps/editor-slice/index.html` を記録した。第4段階は12 checksがPASS、最大interactionは **60.5ms**。第4段階とOwner UIそれぞれのconsole / page / request / HTTP error配列はいずれも空だった。未実行段階へこの結果を一般化しない。

Nodeのprovider検査はmock / fixture、Owner UI Generateの `/api/design-intent` は [`page.route` / `route.fulfill` による固定応答](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/1d9cbb426408e080568a04ea9e44870309339d07/scripts/run-owner-ui-review-smoke.mjs#L60-L88)である。fixtureにある `provider: openai`、`model: test-model`、`selectedProvider: cloud` はlive API呼出しの証拠ではない。全通信や実請求を別途監査したものでもない。

`DAI_SMOKE_URL` を参照する複数階browser検査は第7段階で、今回未実行である。環境変数dumpがないため、その変数の設定有無や値は不明。今回のローカルURLから公開deploymentの検証済みとは判断しない。

## Build識別情報と未確定事項

build logの生成日時は `2026-10-04T11:35:47.602Z`。commit識別はr2の対象headと一致する。

| 識別子 | Windows r2 | Windows前回 | 既存の修正統合記録 |
|---|---|---|---|
| runtimeSourceSha256 | `a2097e3c943aeb5899d0e901ae78ede86705ce80321b33152c7ccec6b08c0b5e` | 同値 | 同値 |
| runtimeBundleSha256 | `9aaa00edfb68cb378f9f0e44d948c4de48341b6486ef42668db91330032331c8` | 同値 | `bf3611d6a8e92c5a27962b4892fe3146d9495a60bdd8a715839e49a61c20c123` |

比較元は[Windows前回](WINDOWS_PR75_FINAL_LOCAL_2026-10-04.json)と[修正統合記録](REMEDIATION_FINAL_LOCAL_2026-10-04.json)。Windows r2のruntime source / bundle hashは前回Windowsと一致する。既存の修正統合記録とはsource hashが一致し、bundle hashが異なる。

提出ZIPにdist manifestやbundle本体がないため、bundle差の原因をファイル単位で検証できない。OS、改行、toolchain等の特定原因とは断定せず、**原因未確定**とする。公開deploymentとのcommit / source / bundleの同一性も今回の結果からは証明されていない。

## 未実行と対象外

- 第6〜24段階はNOT_RUN。Owner UI全項目PASS、Windowsでの24段階正式受け入れは未成立
- suite定義上の対象外は、主観的音声レビュー、公開deployment smoke、live-provider意味検証、DAI-090 Final、動画capture/review、freeze/rollback作成の6項目
- 不足証拠は、実行前git status、環境変数dump、失敗時画像、出口パッドとeventの非重複実測、dist manifest / bundle
- 本記録の整理では追加のテスト実行や実API／課金API呼出しを行っていない。元のWindows process全体の環境や通信の監査を意味しない

## 証拠の同一性

- 元ZIP: `dai-100-final-local-pr75-r2-20261004-203508.zip`
- ZIP SHA-256: `a826bf7e8aa7e95f0769e08baffe57b47a8c8355103c24eefccd986b6b48df7d`
- 単体提出 `console(1).log` SHA-256: `2fa869bc7f31483f5ba833ab91f4b896c5b6ea1f1086f598e49fc102f02e4e9c`
- 単体logとZIP内 `console.log` はbyte単位で一致
- ZIP内の8ファイルは、metadata、git-head、git-status、console.log、およびsimulation / browser performance / Owner UI / browser failureの4結果JSON
- console末尾ではstdout / stderrが混在しているため、check値・座標・失敗stateは各結果JSONを優先する

全8ファイルのサイズとSHA-256、元提出ファイルの識別子、24段階、全checks、参照sourceのGit blobを[機械可読記録](WINDOWS_PR75_R2_FINAL_LOCAL_2026-10-04.json)に保存した。大きなlogや個人環境の絶対pathを含む元証拠はリポジトリへ追加しない。

## 後続のharness追随

旧中央条件の更新とfocused検証は[Room Events配置の現行検査条件](ROOM_EVENT_PLACEMENT_CHECKS_2026-10-04.md)へ分離する。本r2の実測FAILは変更しない。
