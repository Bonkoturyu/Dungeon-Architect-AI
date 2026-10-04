# 既存browser smokeの現行Manual生成フロー追随（2026-10-04）

## 対象と結論

基準はPR #75の `169518e62015e9f56e7fccd94835ea6e439a728d`、tree `2e565e7caa07cce501d945b49a61e38492e603b6`。593 tracked filesのGit blob/treeを照合した作業コピーで、**harness・fixture応答・回帰テスト・文書だけ**を更新した。runtime、依存関係、罠の確率やダメージ、生成方式本体は変更していない。

[Windowsでの最終統合](WINDOWS_PR75_FINAL_LOCAL_2026-10-04.md)は4 PASS / 1 FAIL / 19 NOT_RUNのまま保持する。本変更のfocused検証は成功したが、変更後のWindows browser smokeや24段階全体のPASSはまだ成立していない。

## 変更理由と範囲

現UIはManualが既定で、Generate後の設定確認dialogを確定してから生成する。旧Owner UIはdialogを確定せず生成完了を待っていた。同じ待機漏れがある以下8本をまとめて修正した。

| 検査 | 対象script |
|---|---|
| Owner UI | `run-owner-ui-review-smoke.mjs` |
| Room Events | `run-dai-087-room-events-smoke.mjs` |
| Programmatic characters | `run-dai-096-programmatic-characters-smoke.mjs` |
| Audio presentation | `run-dai-097-audio-presentation-smoke.mjs` |
| Motion feedback | `run-dai-100-motion-feedback-smoke.mjs` |
| Event feedback | `run-dai-100-event-feedback-smoke.mjs` |
| Result / focus | `run-dai-100-result-focus-smoke.mjs` |
| Atmosphere | `run-dai-100-atmosphere-smoke.mjs` |

いずれも `scripts/` 配下。新しい `browser-smoke-support.mjs` の `confirmManualGeneration` でManual選択を確認し、実dialogの表示・有効なsubmitボタン・クリック後のdialog消滅を検査する。Autoへの切替、DOMの強制close、timeout延長は行わない。

Motion smokeは生成Promiseを直接awaitするとManualの操作を挟めないため、Generateクリック→Manual確定→生成完了待機へ変更した。既存の表示・animation判定は維持する。

Owner UIの5言語チェックは、現仕様のV3 Recommendedへ期待値を更新した。V3既定選択、V1の存在、V2の保持と英語のPrevious spatial version表記も追加で検査する。5部屋生成、Mystery、編集、移動、検証、レイアウト等の既存assertは削除していない。

## Fixtureの意図を保持する境界

8本のGenerate固定応答へ `normalRoomRequests()` を追加した。特殊3種を明示exclude、Start/Goalをnormalにする。元のUI・音・イベント検査は通常の敵／罠／宝箱や、通常Goalへの到達で階が完了することを前提にしており、指定を省くと現仕様ではランダム特殊部屋へ置換され、別のシナリオになるためである。

- intentの各数値、prompt、部屋数、階数、既存strategy選択は保持
- 難易度未指定時の現行Normalを保持。Easy化や敵／罠の削除で成功させない
- 現行の70%回避と失敗時被害を保持。`avoid-trap` は現在も有効な操作であり、旧100%回避への変更は行わない
- 通常部屋でも敵・罠・宝箱が残り、同じSeedで再現し、route witnessが生存することをfocusedテストで確認
- 特殊部屋、特殊Goal、ランダム配置、実providerの受入確認はこの通常部屋fixtureの合格で代用しない

Owner以外7本の既存 `checks` ブロックはPR75とbyte単位で同一。残り7本のbrowser smokeも静的に確認し、今回のManual未確定と同じ修正を必要とする箇所は見つからなかった。

## 失敗証拠

8本には例外時の小さな `browser-smoke-failure.json` とPNGを追加した。JSONはURL、生成busy/status、Manual/Auto、strategy、部屋数、確認dialogのopen/alert/選択値を記録する。診断取得失敗でも元の試験例外を再throwする。

既存 `run-logged.ps1` のZIPには今回生成されたJSONが入る。PNGは既存bundleの収集対象外なので、必要時はartifactから個別取得する。スクリーンショット保存自体が失敗しても試験の失敗を隠さない。

## Focused検証

実行環境: Linux / Node.js `v24.19.0` / npm `11.9.0`。

| コマンド・確認 | 結果 |
|---|---|
| `node --test tests/tooling/browser-smoke-support.test.js` | 9/9 PASS |
| `npm run test:tooling` | 49/49 PASS（新規9件を含む） |
| 変更したJS/MJSの `node --check` | 10/10 PASS |
| 変更fileの末尾空白検査 | PASS |
| PR75の既存593 filesとの比較 | 既存file変更は上記8 smokeのみ、runtime差分0 |
| 独立した差分確認 | 修正範囲に対応が必要な問題なし |

新規9件は、Manualの正常submit順序、Auto／dialog欠如の拒否、無効plan／未終了dialogの拒否、通常部屋の明示設定、V2/V3でのdeterminism・敵/罠/宝箱・70%回避・生存witness、page未生成時の失敗記録、診断取得失敗時の原例外保持、8本のharness接続を検査する。

作業途中の新規テストで、罠の確率をschema上に存在しない `trapRules.successChance` から読んだため2件が失敗した。検査を実Play sessionの `getTrapAvoidanceChance()` へ修正し、上記最終結果を得た。runtimeや確率の期待値は変更していない。

## 実際の8 fixtureを使った追加Node確認

各smoke sourceからprompt・intent・strategy・階数を読み、現行 `generateFloorSet` をDOMを使わない実行環境で評価した。実際の8 fixture / 11階すべてが生成でき、valid、通常Start/Goal、敵・罠・宝箱・回復、生存route witness、現行trap ruleを保持した。087/ResultのV2指定、他のV3、Normal難易度を維持している。

次の4シナリオでは各smokeのBFSと実Play coreで、戦闘・罠回避・必要な宝箱・Goal到達を再生し、階間の実PlayerStateを引き継いでclearを確認した。追加回復・店・無敵化は用いていない。

| シナリオ | 階数 | 最終HP | 結果 |
|---|---:|---:|---|
| Room Events（V2） | 1 | 6 | CLEARED |
| Audio presentation（V3） | 2 | 10 | CLEARED |
| Event feedback（V3） | 2 | 6 | CLEARED |
| Result / focus（V2） | 2 | 4 | CLEARED |

Room Eventsでは罠の回避失敗も観測し、その実ダメージを含めて生存している。この追加確認はpure Nodeの生成・経路確認であり、browser内の操作、描画、イベントの時間条件まで再実行したものではない。

証拠ファイル `fixture-generation-replay.json` SHA-256: `37a65eed922cd8e2cae1f757ce958201846a9cfe1757d927b5bd9726efcb77c5`。実行時刻は `2026-10-04T11:18:00.229Z`。完全な入力値・各階のwitness・再生actionを保存している。

## 未検証・次の確認

クラウド環境では前回Chromium起動がsandbox制約で停止したため、ブラウザの再試行や制限回避を行っていない。今回のNode focused成功は、実DOM、レイアウト、animationの時間条件、Mysteryのランダム地形を実ブラウザで確認したことを意味しない。

修正を含むcommitを固定したWindows Google Chromeで、既存の24段階runnerを1回実行し、ログとZIPで結果を確認する必要がある。公開deployment、live-provider、動画や最終提出の完了をこの修正から推定しない。
