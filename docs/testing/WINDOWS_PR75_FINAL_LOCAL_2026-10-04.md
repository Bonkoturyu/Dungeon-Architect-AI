# Windows PR75 最終ローカル統合テスト記録 2026年10月4日

## 結論

**FAIL。全24段階のうち4 PASS / 1 FAIL / 19 NOT_RUN。24/24 PASSの証拠は成立していない。**

Windowsで実行された `npm run validate:dai-100-final-local` の提出ログと証拠を記録する。Node tests **606/606**、複数階simulation **18/18**、production hosting build、browser performance **12/12** はPASS。第5段階のOwner UI smokeが30秒の待機timeoutで失敗し、fail-fastにより第6〜24段階は未実行となった。全体の終了コードは `1`。

本記録の実測値は、提出された1回の実行結果から採録した。後続のharness修正や再試験によって、このFAILをPASSへ書き換えない。本記録を追加するcommitと、以下の実測対象commitは別である。

## 対象と実行環境

- Repository: `Bonkoturyu/Dungeon-Architect-AI`
- 実測対象: PR #75、commit [`169518e62015e9f56e7fccd94835ea6e439a728d`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/169518e62015e9f56e7fccd94835ea6e439a728d)
- 対象tree: `2e565e7caa07cce501d945b49a61e38492e603b6`
- 開始: `2026-10-04T19:59:51.2501193+09:00`
- 終了: `2026-10-04T20:01:17.8059636+09:00`
- 所要時間: `86.556秒`。日時はJST（UTC+09:00）
- Node.js `v24.15.0` / npm `11.12.1` / Google Chrome `153.0.8010.55`
- Windowsのbrowser user agentは `Windows NT 10.0; Win64; x64`。OSのeditionや正確なbuild番号は証拠にない
- `run-metadata.json`、`git-head.txt`、build logのcommit SHAはいずれも上記PR75 headと一致
- PR75のtreeと593 tracked filesのGit blobを別途照合した。ただし、これはWindows実行前のworking tree全体の証明ではない

提出された実行後の `git-status.txt` は `?? artifacts/` のみで、tracked fileの変更は報告されていない。実行前のstatusは同梱されていないため、「実行前もcleanだった」とは断定しない。

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

第1段階の `npm test` は24 test group、計606 testsで、fail / cancelled / skipped / todoはすべて0。この24 test groupは上表の24段階とは別の集計である。第2段階の18 checks、第4段階の12 checksは全件trueで、詳細を[機械可読記録](WINDOWS_PR75_FINAL_LOCAL_2026-10-04.json)に保存した。

## Owner UIの実際の停止と静的分析

ログに記録された直接の停止理由は次のとおり。

```text
page.waitForFunction: Timeout 30000ms exceeded.
scripts/run-owner-ui-review-smoke.mjs:284:14
```

該当待機は、`generationBusy === false` かつ `lastGeneration?.roomCount === 5` を条件とする。Owner UI結果JSONと失敗時スクリーンショットは提出ZIPにないため、その時点の画面やstateを直接確認できていない。

PR75 sourceの静的確認では、以下の不整合がtimeoutを説明する有力な要因となる。

1. `apps/editor-slice/index.html:2379` ではManualが初期選択されている
2. `apps/editor-slice/main.js:3119` ではManual時に `await reviewRoomPlan(reviewOptions)` で設定確認を待つ
3. 旧 `scripts/run-owner-ui-review-smoke.mjs:283–287` はGenerateをクリックした直後、設定確認dialogを確定せず生成完了を待っている

これはsourceに基づく診断であり、失敗時のdialog表示をスクリーンショットで実証したものでも、修正後の再現試験でもない。今回の証拠だけでruntime本体の欠陥や修正済みを断定しない。

後続のharness修正とfocused検証は[Manual生成フロー追随](BROWSER_SMOKE_MANUAL_FLOW_2026-10-04.md)に分けて記録する。

また旧harnessのlocalization検査には、V2の選択肢を `Version 2 — Recommended` および各言語の旧「推奨」表記として比較する期待値が残っている。終了時の比較（同ファイル1039行・1048行）には今回到達していないため、これを今回観測した別のFAILとして数えない。

## ローカルURLと確認範囲

Browser performance JSONには `http://127.0.0.1:4184/apps/editor-slice/index.html` が記録されている。12 checksはPASSで、最大interactionは `59.9ms`、console / page / request / HTTP errorの配列は空だった。これらは第4段階の観測であり、第5段階へ一般化しない。

Owner UI sourceはローカルViteを起動し、既定port `4194` を使う。`DAI_OWNER_UI_PORT` による変更が可能だが、今回のOwner UI結果JSONと環境変数dumpはないため、実際のportを独立した実測値としては記録できない。

実行されたNodeのprovider検査はmock、Owner UIの `/api/design-intent` は `page.route` / `route.fulfill` による固定応答である。fixture中の `provider: openai` / `model: test-model` はlive呼出しの証拠ではない。今回のログにlive-provider実行はなく、全通信や実請求を別途監査したものではない。

`DAI_SMOKE_URL` を参照する後続の複数階browser検査は第7段階であり、今回未到達である。環境変数dumpがないので、その変数の設定有無も断定しない。第4段階のローカルURLや第5段階のsourceを根拠に、未実行段階や公開deploymentまで検証済みとは扱わない。

## Build識別情報と未確定事項

build logの `commitSha` はPR75 headと一致し、`commitSource` は `git` だった。

| 識別子 | 今回のWindows build | 既存の修正統合記録 |
|---|---|---|
| runtimeSourceSha256 | `a2097e3c943aeb5899d0e901ae78ede86705ce80321b33152c7ccec6b08c0b5e` | 同値 |
| runtimeBundleSha256 | `9aaa00edfb68cb378f9f0e44d948c4de48341b6486ef42668db91330032331c8` | `bf3611d6a8e92c5a27962b4892fe3146d9495a60bdd8a715839e49a61c20c123` |

比較元は[既存の修正統合記録](REMEDIATION_FINAL_LOCAL_2026-10-04.md)。runtime source hashは一致するが、bundle hashは異なる。提出ZIPにはdistのmanifestやbundle本体がないため、差の原因をファイル単位で検証できない。OS、改行、toolchain等のいずれかが原因とは断定せず、**原因未確定**とする。公開deploymentとの同一性も、このWindows実行からは証明されていない。

## 未実行と対象外

- 第6〜24段階は未実行。過去の別実行でのPASSを今回の結果へ補完しない
- Owner UI全項目のPASS、Windowsでの24段階正式受け入れは未成立
- suite定義上の対象外は、主観的音声レビュー、公開deployment smoke、live-provider意味検証、DAI-090 Final、動画capture/review、freeze/rollback作成の6項目
- 実行前git status、環境変数dump、Owner UI結果JSON／失敗時画像、dist manifest／bundleが不足している
- 本記録の整理では追加の実API／課金API呼出しを行っていない。Windows process全体の環境や通信を監査したという意味ではない

## 証拠の同一性

- 元ZIP: `dai-100-final-local-pr75-20261004-195951.zip`
- ZIP SHA-256: `232173371d17b5193f0d13c846af2cc0dad126ef257538fea98bb0fd814786ec`
- 単体提出 `console.log` SHA-256: `66bc3b2742b5f644ec141b487d49304088ffcd4711cfab7388f5ba2fccd53028`
- 単体logとZIP内 `console.log` はbyte単位で一致
- ZIP内の結果JSONは `evidence/artifacts/dai-098/dai-098-multi-floor-simulation.json` と `evidence/artifacts/browser-performance/dai-071-browser-performance.json` の2件

全6同梱ファイルのサイズとSHA-256、元提出ファイルの識別子、24段階、全checks、source参照のGit blobは[機械可読記録](WINDOWS_PR75_FINAL_LOCAL_2026-10-04.json)に保存した。大きなlogや個人環境の絶対pathを含む元証拠はリポジトリへ追加しない。
