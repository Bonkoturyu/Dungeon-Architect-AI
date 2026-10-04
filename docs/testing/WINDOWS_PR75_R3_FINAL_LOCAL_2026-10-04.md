# Windows PR75 r3 最終ローカル統合テスト記録 2026年10月4日

## 結論

**PASS。全24段階が同じ実行で成功し、FAIL / NOT_RUN は0、終了コードは0。**

PR #75 の実測対象commitは [`8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531)。Node **628/628 tests**、simulation **18/18 checks**、browser **15段階・253 checks**、production build、各監査、syntax / diff checkがすべて成功した。提出ZIPのconsole最終集計と個別20結果JSONを照合した。

過去の[初回Windows FAIL](WINDOWS_PR75_FINAL_LOCAL_2026-10-04.md)と[r2 FAIL](WINDOWS_PR75_R2_FINAL_LOCAL_2026-10-04.md)は変更せず、本r3を別の実測として保存する。本記録の整理で追加試験・コード変更・実API呼出しは行っていない。

## 対象・日時・環境

- 対象commit: `8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531`
- 対象tree: `53c5490510d9746761e4685d8abcf19b3223fea6`。GitHub commitと照合し、診断に使用した603ファイルのsnapshotも各hash一致
- 開始: `2026-10-04T20:58:44.5778340+09:00`
- 終了: `2026-10-04T21:02:12.1168907+09:00`
- 所要時間: **207.539秒**。日時はJST（UTC+09:00）
- Windows / Node.js `v24.15.0` / npm `11.12.1` / Google Chrome `153.0.8010.55`
- Browser viewport: `1440 × 900`。user agentはWindows NT 10.0 / Win64 / x64。正確なOS edition/buildは未収録
- `run-metadata.json`、`git-head.txt`、build logのcommitはすべて対象SHAと一致。buildの `commitSource` は `git`
- 実行後statusは `?? artifacts/` のみ。tracked file変更は報告されていない。実行前statusは同梱されていないため、実行前cleanを独立証明したとはしない

metadataとconsoleで確認した実行scriptは `npm run validate:dai-100-final-local`、labelは `dai-100-final-local-pr75-r3`。既存の証拠収集runnerを使う再現形は次のとおり（この記録作成時には再実行していない）。

```powershell
powershell -NoProfile -File .\scripts\run-logged.ps1 -NpmScript validate:dai-100-final-local -Label dai-100-final-local-pr75-r3
```

## 24段階の結果

[suite定義](../../scripts/run-dai-100-final-local-regression.mjs)の順序・ラベルを保持する。第18段階の「Ten-strategy」は歴史的なscriptラベルで、現行selectorの11方式を10方式と数える意味ではない。

| 段階 | suiteラベル | 結果 | 内訳 |
|---|---|---|---|
| 1 | Full Node regression suite | PASS | 628/628 tests |
| 2 | Multi-floor simulation regression | PASS | 18/18 checks |
| 3 | Production hosting build | PASS | production build完了 |
| 4 | Browser performance regression | PASS | 12/12 checks |
| 5 | Owner UI regression smoke | PASS | 62/62 checks |
| 6 | Room Event gameplay regression | PASS | 16/16 checks |
| 7 | Multi-floor browser regression | PASS | 15/15 checks |
| 8 | Programmatic character regression | PASS | 11/11 checks |
| 9 | Programmatic Audio V2 regression | PASS | 18/18 checks |
| 10 | Motion feedback regression | PASS | 8/8 checks |
| 11 | Event feedback regression | PASS | 9/9 checks |
| 12 | Result / camera-focus regression | PASS | 15/15 checks |
| 13 | DesignIntent atmosphere regression | PASS | 12/12 checks |
| 14 | AI Edit V3 structural regression | PASS | 12/12 checks |
| 15 | Reactive Audio V2 regression | PASS | 14/14 checks |
| 16 | JSON Export regression | PASS | 14/14 checks |
| 17 | JSON Import / round-trip regression | PASS | 14/14 checks |
| 18 | Ten-strategy Generator selector regression | PASS | 21/21 checks |
| 19 | Legal / provenance audit | PASS | 14/14 checks |
| 20 | Secret / privacy audit | PASS | 18/18 checks |
| 21 | Public docs truthfulness audit | PASS | 20/20 checks |
| 22 | Submission metadata audit | PASS | 8/8 checks |
| 23 | Syntax validation | PASS | 338 files |
| 24 | Git whitespace / error-marker check | PASS | origin/main...HEAD diff --check |

Nodeは24 test group、計628 tests。fail / cancelled / skipped / todoはいずれも0。この24 test groupは上表の24段階とは別の集計である。各checkの真偽と証拠hashは[機械可読記録](WINDOWS_PR75_R3_FINAL_LOCAL_2026-10-04.json)に保存した。

## 先行FAILの解消を示す実測

- Owner UI: `manualConfirmation` は `mode: manual`、`dialogObserved: true`、`planSubmitted: true`。Manualの確認UIを通って生成完了した。V3推奨・旧V2/V1の表示と5言語切替も成功
- Owner UI Room Event: 水平中央・viewport内・中心より104px上方の必須検査が成功。実測offsetは `104.00001525878906px`、別の可視出口sampleはoffset `104px` / event下端とexit上端の間隔 **155.5px**
- Event feedback: intro時の実測offsetは `103.99998474121094px`。宝箱と可視出口のsampleはoffset `104px` / 間隔 **127.5px**。intro演出とblocking / treasure / floor / resultの既存feedback検査も成功

Ownerの `eventPlacement` とEventの `introPlacement` にある補助診断 `passed: false` は、blocking中に出口パッドが非表示で `clearOfExitPad: false` になるため。非表示のzero rectを「重なりなし」と誤判定しない設計である。この時点の必須検査は水平中央・104px上方・viewport内の3条件で、すべてtrue。**可視出口との非重複は別の必須sampleで測定し、両方とも4条件すべてtrue**。補助診断のfalseを隠さず、stage失敗と混同しない。

比較対象は[現行配置の検査条件](ROOM_EVENT_PLACEMENT_CHECKS_2026-10-04.md)。実測に合わせてruntimeを変更した結果ではなく、既存CSSの意図と独立した104px / geometry条件をWindows browserで確認した結果である。

## Browser・API・URLの範囲

browser15本すべてで `consoleErrors` / `pageErrors` / `failedRequests` / `httpErrors` は空。performanceは12/12 checks成功し、最大interactionは **69.3ms**、cadence p95は **31.6ms**。

- performance実測URL: `http://127.0.0.1:4184/apps/editor-slice/index.html`
- multi-floor実測URL: `http://127.0.0.1:4195/apps/editor-slice/index.html`

`DAI_SMOKE_URL` のoverrideに対応するmulti-floorも、今回は上記ローカルURLで実行された。他13本のJSONはURLを記録しないが、照合済みsourceの接続先はローカルVite。環境変数dumpはなく、「すべてのoverride変数が未設定」とは断定しない。

生成・AI Editを行うbrowser harnessは `page.route` / `route.fulfill` の固定応答を使用し、Nodeのprovider / handler検査はmock / fixtureを使用する。fixtureの `provider: openai`、`selectedProvider: cloud`、model名はlive API成功の証拠ではない。今回のsourceと証拠には課金provider呼出しを要求する経路を認めていないが、全通信traceや実請求の監査ではない。

BrowserはローカルVite sourceに対する回帰試験であり、production build完了とは別の検査。公開backendの限定live確認や公開deploymentのbuild同一性は、このローカルsuiteの24/24から推論しない。

## Fingerprint

build info生成日時: `2026-10-04T11:59:24.986Z`。

- runtime source SHA-256: `a2097e3c943aeb5899d0e901ae78ede86705ce80321b33152c7ccec6b08c0b5e`
- runtime bundle SHA-256: `9aaa00edfb68cb378f9f0e44d948c4de48341b6486ef42668db91330032331c8`

両hashはWindows r1 / r2と一致。runtime source hashは以前のcloud修正統合記録とも一致する。cloud側bundleは `bf3611d6a8e92c5a27962b4892fe3146d9495a60bdd8a715839e49a61c20c123` で異なる。ZIPにはdist manifest / bundle本体がないため、差の原因は未確定とする。公開deploymentとのcommit / source / bundle同一性は今回の証拠では未検証。

## 対象外・証拠の限界

24段階内の未実行はない。suite定義上、主観的音声レビュー、公開deployment smoke、live-provider意味検証、DAI-090 Final、動画capture/review、freeze/rollback作成は対象外。

生成smokeの通常部屋fixtureは `monster-house` / `trap-house` / `shop` を明示除外しており、特殊部屋の全組合せを網羅するものではない。またResultの800×600・5言語sampleではmetrics下端が943〜962pxで、既存検査はwidth<=800の縦方向viewport内条件を免除する。1440×900 / 1024×768の配置と拡大文字の到達性はPASSだが、全画面サイズに収まる証拠とはしない。desktop-onlyの現行対象範囲とこの既存条件を区別する。

secret / privacy auditは603 tracked files、dist7 files、18 checksでPASS。ただし、履歴commit数や `git log` の走査完了はJSONへ記録されず、scriptは `git log` 失敗時に空文字へフォールバックする。今回のPASSだけで過去の1,805 commits監査を置き換えたり、全履歴監査完了を断定したりしない。

実行前git status、全環境変数dump、画像、dist manifest / bundle本体は未収録。画像を目視確認したとは扱わない。第24段階は `git diff --check origin/main...HEAD` が成功した証拠で、当時の `origin/main` ref SHAはZIPにない。

本記録を追加する後続commitと実測SHAは区別する。docs-onlyの記録追加を含む後続commitそのものに、今回の実行SHAを書き換えて適用しない。

## 証拠の同一性

- 元ZIP: `dai-100-final-local-pr75-r3-20261004-205844.zip`（113,298 bytes）
- ZIP SHA-256: `f867657c66df2be977993260b4e0b84b4a872983f9c5ae99ea35ae3ab76aad25`
- ZIP内console SHA-256: `39096fde4b8282298e54897a4b83ef7e4ed96e9b4a7d7d29ee9174ae1b0dc972`
- ZIP内容: console、run metadata、git head、git status、今回生成された20結果JSONの計24証拠ファイル。ほかに0-byteの空ディレクトリmarkerが1件あり、ZIP entry総数は25

ZIP内の各ファイルサイズ・SHA-256、対象source、全24段階とcheck値を[機械可読記録](WINDOWS_PR75_R3_FINAL_LOCAL_2026-10-04.json)へ保存した。大きな全logと個人環境の絶対pathを含む元証拠は、この記録へ転載しない。
